'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');
const {getStorage}=require('firebase-admin/storage');
const {randomUUID}=require('node:crypto');
const {
  safeId,cleanText,cleanCaption,safeMedia,reportReason,
  participants,safeChat,safeMessage
}=require('./validation');
if(!getApps().length)initializeApp();
const db=getFirestore();
const options={region:'europe-west6',memory:'256MiB',maxInstances:8,timeoutSeconds:45};
const fail=(code,msg)=>{throw new HttpsError(code,msg)};
const docChats=db.collection('chats');
const blocks=db.collection('userBlocks');
const blockId=(blockerUid,blockedUid)=>blockerUid+'_'+blockedUid;
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
async function verifiedMedia(chatId,uid,messageId,raw) {
  const media=safeMedia(raw);
  const expected=`chat-media/${chatId}/${uid}/${messageId}.jpg`;
  if(media.storagePath!==expected)fail('invalid-argument','Bild ist nicht diesem Chat zugeordnet.');
  let metadata;
  try {[metadata]=await getStorage().bucket().file(expected).getMetadata();}
  catch(e){fail('failed-precondition','Das Chatbild wurde nicht vollständig hochgeladen.');}
  const size=Number(metadata.size||0);
  if(metadata.contentType!=='image/jpeg'||size<1||size>2500000)
    fail('failed-precondition','Das Chatbild erfüllt die Sicherheitsvorgaben nicht.');
  const custom=metadata.metadata||{};
  if(custom.chatId!==chatId||custom.senderUid!==uid||custom.messageId!==messageId)
    fail('permission-denied','Die Bildmetadaten passen nicht zur Nachricht.');
  return {storagePath:expected,contentType:'image/jpeg',size};
}

async function notifyRecipient(recipient,chat,senderName,messageType) {
  if((chat.mutedBy||[]).includes(recipient))return;
  const snap=await db.collection('deviceTokens')
    .where('uid','==',recipient).where('active','==',true).limit(20).get();
  const records=snap.docs.filter(x=>typeof x.data().token==='string'&&x.data().token.length>=20);
  if(!records.length)return;
  const response=await getMessaging().sendEachForMulticast({
    tokens:records.map(x=>x.data().token),
    notification:{
      title:'Neue private Nachricht',
      body:`${String(senderName||'Quartiermitglied').slice(0,80)} hat ${messageType==='image'?'ein Foto':'eine Nachricht'} gesendet.`
    },
    data:{route:'chats',chatId:String(chat.id||''),type:'private_chat'},
    android:{priority:'high',notification:{channelId:'quartinaut_updates',visibility:'private'}}
  });
  const invalid=[];
  response.responses.forEach((item,index)=>{
    const code=item.error?.code||'';
    if(!item.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')))
      invalid.push(records[index].ref);
  });
  await Promise.all(invalid.map(ref=>ref.update({active:false,updatedAt:new Date().toISOString()})));
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
      readBy:{[uid]:now},mutedBy:[],blockedBy:[],createdAt:now,lastMessageAt:now,
      lastMessagePreview:'',lastSenderUid:''
    });
  });
  const snap=await ref.get();
  return {chat:safeChat(chatId,snap.data())};
}
async function sendMessage(uid,body) {
  const {id,c}=await assertChat(body.chatId,uid);
  const messageType=body.messageType==='image'?'image':'text';
  let text;
  try{text=messageType==='image'?cleanCaption(body.text):cleanText(body.text);}
  catch(e){fail('invalid-argument',e.message);}
  let nonce;
  try{nonce=safeId(body.operationId,90);}catch(e){fail('invalid-argument','Sende-ID ungültig.');}
  const recipient=c.participants.find(x=>x!==uid);
  const messageId='msg_'+uid+'_'+nonce;
  const media=messageType==='image'?await verifiedMedia(id,uid,messageId,body.media):null;
  const msgRef=db.collection('chatMessages').doc(messageId);
  const chatRef=docChats.doc(id);
  const quota=db.collection('chatSendRateLimits').doc(uid);
  const now=new Date().toISOString(),day=now.slice(0,10);
  let existing=false;
  await db.runTransaction(async tx=>{
    const directBlock=blocks.doc(blockId(uid,recipient));
    const reverseBlock=blocks.doc(blockId(recipient,uid));
    const [cSnap,msgSnap,qSnap,directBlockSnap,reverseBlockSnap]=await Promise.all([
      tx.get(chatRef),tx.get(msgRef),tx.get(quota),tx.get(directBlock),tx.get(reverseBlock)
    ]);
    if(!cSnap.exists||!participants(cSnap.data(),uid))
      fail('permission-denied','Chat-Mitgliedschaft ist nicht mehr gültig.');
    if(msgSnap.exists){existing=true;return;}
    if(directBlockSnap.exists||reverseBlockSnap.exists||(cSnap.data().blockedBy||[]).length)
      fail('failed-precondition','Nachrichten sind für diese Unterhaltung blockiert.');
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
      deliveryStatus:'sent',messageType,
      ...(media?{media}: {})
    });
    tx.update(chatRef,{lastMessageAt:now,lastMessagePreview:(text||'Foto').slice(0,120),
      lastSenderUid:uid,['readBy.'+uid]:now});
  });
  if(!existing) {
    const senderName=c.participantLabels?.[uid]||'Quartiermitglied';
    await notifyRecipient(recipient,{...c,id},senderName,messageType).catch(error=>
      console.error('chat push failed',{chatId:id,recipient,error:error?.code||error?.message}));
  }
  return {ok:true,messageId,existing};
}

async function setMuted(uid,body) {
  const {id,c}=await assertChat(body.chatId,uid);
  const muted=body.muted===true;
  await docChats.doc(id).update({
    mutedBy:muted?FieldValue.arrayUnion(uid):FieldValue.arrayRemove(uid),
    updatedAt:new Date().toISOString()
  });
  return {ok:true,muted,chat:safeChat(id,{...c,mutedBy:muted?
    [...new Set([...(c.mutedBy||[]),uid])]:(c.mutedBy||[]).filter(x=>x!==uid)})};
}

async function setBlocked(uid,body) {
  const {id,c}=await assertChat(body.chatId,uid);
  const other=c.participants.find(x=>x!==uid);
  const blocked=body.blocked===true;
  const ref=blocks.doc(blockId(uid,other));
  const now=new Date().toISOString();
  await db.runTransaction(async tx=>{
    if(blocked)tx.set(ref,{id:ref.id,blockerUid:uid,blockedUid:other,chatId:id,createdAt:now});
    else tx.delete(ref);
    tx.update(docChats.doc(id),{
      blockedBy:blocked?FieldValue.arrayUnion(uid):FieldValue.arrayRemove(uid),updatedAt:now
    });
  });
  return {ok:true,blocked};
}

async function reportChat(uid,body) {
  const {id,c}=await assertChat(body.chatId,uid);
  let operationId,reason;
  try{operationId=safeId(body.operationId,90);reason=reportReason(body.reason);}
  catch(e){fail('invalid-argument',e.message);}
  const note=cleanCaption(body.note);
  const reportedUid=c.participants.find(x=>x!==uid);
  let messageId='';
  try{messageId=body.messageId?safeId(body.messageId,150):'';}
  catch(e){fail('invalid-argument','Nachrichtenkennung ist ungültig.');}
  let messageSnapshot=null;
  if(messageId){
    const snap=await db.collection('chatMessages').doc(messageId).get();
    if(!snap.exists||snap.data().chatId!==id)fail('invalid-argument','Gemeldete Nachricht gehört nicht zum Chat.');
    messageSnapshot=safeMessage(snap.id,snap.data());
  }
  const caseId='chatreport_'+uid+'_'+operationId;
  await db.collection('moderationCases').doc(caseId).create({
    id:caseId,type:'Privater Chat',status:'offen',reporterUid:uid,reportedUid,
    chatId:id,messageId,reason,note,requestId:String(c.requestId||''),
    messageSnapshot,createdAt:new Date().toISOString()
  }).catch(error=>{if(error.code!==6&&error.code!=='already-exists')throw error;});
  return {ok:true,caseId};
}

async function markRead(uid,body) {
  const {id}=await assertChat(body.chatId,uid);
  const now=new Date().toISOString();
  await docChats.doc(id).update({['readBy.'+uid]:now,updatedAt:now});
  return {ok:true,readAt:now};
}
exports.quartinautPrivateChats=onCall(options,async request=>{
  const {uid,user}=await who(request);
  const data=request.data||{};
  switch(data.action){
    case 'list': return {ok:true,chats:await listChats(uid)};
    case 'messages': return {ok:true,messages:await listMessages(String(data.chatId||''),uid)};
    case 'start': return {ok:true,...await startChat(uid,user,data)};
    case 'send': return await sendMessage(uid,data);
    case 'read': return await markRead(uid,data);
    case 'mute': return await setMuted(uid,data);
    case 'block': return await setBlocked(uid,data);
    case 'report': return await reportChat(uid,data);
    default: fail('invalid-argument','Unbekannte Chat-Aktion.');
  }
});
