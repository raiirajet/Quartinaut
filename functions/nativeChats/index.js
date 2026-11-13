'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {randomUUID}=require('node:crypto');
const {safeId,cleanText,participants,safeChat,safeMessage}=require('./validation');
if(!getApps().length)initializeApp();
const db=getFirestore();
const options={region:'europe-west6',memory:'256MiB',maxInstances:8,timeoutSeconds:45};
const fail=(code,msg)=>{throw new HttpsError(code,msg)};
const docChats=db.collection('chats');
async function who(request) {
  const uid=request.auth?.uid;
  if(!uid)fail('unauthenticated','Bitte anmelden.');
  const snap=await db.collection('users').doc(uid).get();
  // Existing Quartinaut Firestore rules treat a missing legacy status as active.
  const accountStatus=snap.data()?.accountStatus || 'active';
  if(!snap.exists||accountStatus!=='active') {
    fail('permission-denied','Das Benutzerkonto ist nicht aktiv.');
  }
  return {uid,user:snap.data()};
}
const assertChat=async(id,uid)=>{
  let chatId;
  try {chatId=safeId(id,340);}catch(e){fail('invalid-argument','Chatkennung ungültig.');}
  const doc=await docChats.doc(chatId).get();
  if(!doc.exists)fail('not-found','Unterhaltung nicht gefunden.');
  const c=doc.data();
  if(!participants(c,uid))fail('permission-denied','Kein Mitglied dieser Unterhaltung.');
  return {id:chatId,doc,c};
};

async function listChats(uid) {
  // Query runs on the server, but each result is filtered again before return.
  const snaps=await docChats.where('participants','array-contains',uid).limit(150).get();
  return snaps.docs.filter(x=>participants(x.data(),uid))
    .map(x=>safeChat(x.id,x.data()))
    .sort((a,b)=>b.lastMessageAt.localeCompare(a.lastMessageAt))
    .slice(0,100);
}
async function listMessages(id,uid) {
  const {c}=await assertChat(id,uid);
  const snaps=await db.collection('chatMessages').where('chatId','==',id)
    .limit(300).get();
  return snaps.docs.filter(x=>{
    const m=x.data();
    return m.chatId===id && m.requestId===c.requestId &&
      Array.isArray(m.participants) &&
      m.participants.length===2 &&
      m.participants.every(v=>c.participants.includes(v));
  }).sort((a,b)=>String(a.data().createdAt||'').localeCompare(String(b.data().createdAt||'')))
    .slice(-200).map(x=>safeMessage(x.id,x.data()));
}
async function startChat(uid,user,body) {
  let requestId;
  try{requestId=safeId(body.requestId);}catch(e){fail('invalid-argument','Anliegen-ID ungültig.');}
  const req=await db.collection('requests').doc(requestId).get();
  if(!req.exists)fail('not-found','Anliegen wurde nicht gefunden.');
  const item=req.data();
  const owner=String(item.uid||item.authorId||'');
  if(!owner||owner===uid||!['offen','online'].includes(String(item.status||'')))
    fail('failed-precondition','Anliegen ist nicht für einen neuen Chat verfügbar.');
  if(item.cantonCode && item.cantonCode!==user.cantonCode &&
     (!item.areaKey||item.areaKey!==user.areaKey))
    fail('permission-denied','Das Anliegen liegt ausserhalb deiner Region.');
  const users=[uid,owner].sort();
  const chatId='chat_'+requestId+'_'+users.join('_');
  if(chatId.length>340)fail('invalid-argument','Chatkennung zu lang.');
  const ref=docChats.doc(chatId);
  const now=new Date().toISOString();
  await db.runTransaction(async tx=>{
    const old=await tx.get(ref);
    if(old.exists){
      if(!participants(old.data(),uid))fail('permission-denied','Chat nicht zugänglich.');
      return;
    }
    tx.set(ref,{
      id:chatId,requestId,requestTitle:String(item.title||'Anliegen').slice(0,140),
      requestOwnerUid:owner,participants:users,
      participantLabels:{[uid]:String(user.displayName||'Quartiermitglied').slice(0,80),
        [owner]:String(item.authorName||'Quartiermitglied').slice(0,80)},
      readBy:{[uid]:now},mutedBy:[],createdAt:now,lastMessageAt:now,
      lastMessagePreview:'',lastSenderUid:''
    });
  });
  const snap=await ref.get();
  return {chat:safeChat(chatId,snap.data())};
}
async function sendMessage(uid,body) {
  const {id,c}=await assertChat(body.chatId,uid);
  let text;
  try{text=cleanText(body.text);}catch(e){fail('invalid-argument',e.message);}
  let nonce;
  try{nonce=safeId(body.operationId,90);}catch(e){fail('invalid-argument','Sende-ID ungültig.');}
  const recipient=c.participants.find(x=>x!==uid);
  const messageId='msg_'+uid+'_'+nonce;
  const msgRef=db.collection('chatMessages').doc(messageId);
  const chatRef=docChats.doc(id);
  const quota=db.collection('chatSendRateLimits').doc(uid);
  const now=new Date().toISOString(),day=now.slice(0,10);
  let existing=false;
  await db.runTransaction(async tx=>{
    const [cSnap,msgSnap,qSnap]=await Promise.all([
      tx.get(chatRef),tx.get(msgRef),tx.get(quota)
    ]);
    if(!cSnap.exists||!participants(cSnap.data(),uid))
      fail('permission-denied','Chat-Mitgliedschaft ist nicht mehr gültig.');
    if(msgSnap.exists){existing=true;return;}
    const q=qSnap.data()||{},daily=q.day===day?(q.count||0):0;
    if(daily>=180)fail('resource-exhausted','Tageslimit für Nachrichten erreicht.');
    if(Date.now()-Number(q.lastAt||0)<500)
      fail('resource-exhausted','Bitte Nachrichten nicht zu schnell senden.');
    tx.set(quota,{uid,day,count:daily+1,lastAt:Date.now(),updatedAt:now},{merge:true});
    tx.set(msgRef,{
      id:messageId,chatId:id,requestId:String(c.requestId||''),
      requestTitle:String(c.requestTitle||''),requestOwnerUid:String(c.requestOwnerUid||''),
      senderUid:uid,recipientUid:recipient,participants:c.participants,
      participantLabels:c.participantLabels||{},text,createdAt:now,readAt:'',
      deliveryStatus:'sent',messageType:'text'
    });
    tx.update(chatRef,{lastMessageAt:now,lastMessagePreview:text.slice(0,120),
      lastSenderUid:uid,['readBy.'+uid]:now});
  });
  return {ok:true,messageId,existing};
}
exports.quartinautPrivateChats=onCall(options,async request=>{
  const {uid,user}=await who(request);
  const data=request.data||{};
  switch(data.action){
    case 'list': return {ok:true,chats:await listChats(uid)};
    case 'messages': return {ok:true,messages:await listMessages(String(data.chatId||''),uid)};
    case 'start': return {ok:true,...await startChat(uid,user,data)};
    case 'send': return await sendMessage(uid,data);
    default: fail('invalid-argument','Unbekannte Chat-Aktion.');
  }
});
