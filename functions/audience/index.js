'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp,getApps}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const crypto=require('node:crypto');
const p=require('./policy');
if(!getApps().length)initializeApp();
const db=getFirestore(),posts=db.collection('quartinautScopedRequests');
const locations=db.collection('quartinautAudienceLocations'),settings=db.collection('quartinautAudienceSettings');
const quotas=db.collection('quartinautAudienceQuotas'),social=db.collection('quartinautAudienceSocial');
const fail=(code,text)=>{throw new HttpsError(code,text);};
const now=()=>new Date().toISOString(),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const idOf=x=>{if(typeof x!=='string'||!/^arq_[a-f0-9]{32}$/.test(x))fail('invalid-argument','Anliegenkennung ungültig.');return x;};
const clean=(s,min,max)=>{if(typeof s!=='string'||s.trim().length<min||s.trim().length>max)fail('invalid-argument','Textlänge ungültig.');return s.trim();};
async function context(req){
 const uid=req.auth?.uid;if(!uid)fail('unauthenticated','Bitte anmelden.');
 const [user,location]=await Promise.all([db.collection('users').doc(uid).get(),locations.doc(uid).get()]);
 const profile=user.data();
 if(!profile||!['active',undefined,null].includes(profile.accountStatus))fail('permission-denied','Konto nicht aktiv.');
 return {uid,profile,location:location.data(),claims:req.auth.token||{}};
}
async function quota(ctx,key,limit){
 const ref=quotas.doc(hash(ctx.uid+'|'+key+'|'+now().slice(0,10)));
 await db.runTransaction(async tx=>{
  const old=await tx.get(ref),count=Number(old.data()?.count||0);
  if(count>=limit)fail('resource-exhausted','Tageslimit erreicht.');
  tx.set(ref,{uid:ctx.uid,count:count+1,updatedAt:now()});
 });
}
async function authorized(ctx,id){
 const ref=posts.doc(idOf(id)),snap=await ref.get(),item=snap.data();
 if(!item||!p.canView(item,ctx))fail('not-found','Anliegen nicht verfügbar.');
 return {ref,item,id:ref.id};
}
async function visible(ctx){
 const [open,own]=await Promise.all([
  posts.orderBy('createdAt','desc').limit(600).get(),posts.where('uid','==',ctx.uid).limit(100).get()
 ]);
 const all=new Map([...open.docs,...own.docs].map(d=>[d.id,d]));
 if(ctx.claims.admin===true||['admin','area_admin'].includes(ctx.claims.role)){
  const pending=await posts.where('status','==','wartet_freigabe').limit(200).get();
  pending.docs.forEach(d=>all.set(d.id,d));
 }
 return [...all.values()].filter(d=>p.canView(d.data(),ctx))
  .sort((a,b)=>String(b.data().createdAt).localeCompare(String(a.data().createdAt))).slice(0,200);
}
async function feed(ctx){
 await quota(ctx,'feed',500);
 const docs=await visible(ctx),batch=db.batch(),refs=[];
 for(const doc of docs){
  const x=doc.data(),mine=x.uid===ctx.uid,mod=p.moderator(ctx,x);
  const ref=db.collection('quartinautAudienceFeeds').doc(ctx.uid).collection('items').doc(doc.id);
  const requiresLocation=x.audienceLevel==='radius'&&!mine&&!mod;
  batch.set(ref,{...p.publicFields(doc.id,x),sourceUpdatedAt:x.updatedAt,
   viewerAreaKey:ctx.profile.areaKey||'',viewerCantonCode:ctx.profile.cantonCode||'',
   viewerRole:ctx.claims.role||'',viewerAdmin:ctx.claims.admin===true,
   viewerAdminScopeArea:ctx.claims.adminScopeArea||'',
   requiresLocation,viewerLocationUpdatedAt:requiresLocation?ctx.location.updatedAt:null,
   validUntil:Timestamp.fromMillis(Math.min(Date.now()+5*60_000,
    requiresLocation?ctx.location.validUntil.toMillis():Infinity,
    mine||mod?Infinity:Date.parse(x.expiresAt)))});
  refs.push(doc.id);
 }
 if(docs.length)await batch.commit();
 return {ok:true,ids:refs,hasLocation:!!ctx.location&&ctx.location.validUntil.toMillis()>Date.now()};
}
async function create(ctx,data){
 let safe;try{safe=p.validateCreate(data.item,ctx.profile,ctx.uid);}catch(e){fail('invalid-argument',e.message);}
 if(typeof data.opId!=='string'||!/^req_[a-f0-9]{32}$/.test(data.opId))fail('invalid-argument','Vorgangskennung fehlt.');
 const id='arq_'+hash(ctx.uid+'|'+data.opId).slice(0,32),ref=posts.doc(id),digest=hash(JSON.stringify(safe));
 const at=now(),hours=({'Heute':24,'Morgen':48,'Diese Woche':168})[safe.urgency]||336;
 const item={...safe,tenantId:'quartinaut',uid:ctx.uid,authorId:ctx.uid,
  authorName:String(ctx.profile.displayName||'Quartiermitglied').slice(0,80),
  area:ctx.profile.area,areaKey:ctx.profile.areaKey,cantonCode:ctx.profile.cantonCode,
  status:ctx.claims.admin===true||ctx.claims.role==='admin'?'offen':'wartet_freigabe',
  createdAt:at,updatedAt:at,expiresAt:new Date(Date.now()+hours*3600_000).toISOString(),operationHash:digest};
 await quota(ctx,'create',20);
 await db.runTransaction(async tx=>{
  const old=await tx.get(ref);
  if(old.exists){if(old.data().uid!==ctx.uid||old.data().operationHash!==digest)fail('already-exists','Vorgangskennung bereits verwendet.');return;}
  tx.create(ref,item);
 });
 return {ok:true,id,status:item.status};
}
async function manage(ctx,data){
 const id=idOf(data.id),ref=posts.doc(id);
 let result;
 await db.runTransaction(async tx=>{
  const doc=await tx.get(ref),x=doc.data();if(!x)fail('not-found','Anliegen fehlt.');
  const action=data.action,mod=p.moderator(ctx,x);
  if(['approve','reject'].includes(action)){
   if(!mod)fail('permission-denied','Keine Moderationsberechtigung.');
   if(x.status!=='wartet_freigabe')fail('failed-precondition','Anliegen wurde bereits geprüft.');
   result=action==='approve'?'offen':'abgelehnt';
   tx.update(ref,{status:result,updatedAt:now(),reviewedAt:now(),reviewedBy:ctx.uid});
  }else{
   if(x.uid!==ctx.uid)fail('permission-denied','Nur eigene Anliegen bearbeiten.');
   const changes={updatedAt:now()};
   if(action==='post.delete')Object.assign(changes,{status:'gelöscht',title:'Gelöschtes Anliegen',text:'',photoPaths:[]});
   else if(action==='post.edit'){
    if(!['offen','wartet_freigabe'].includes(x.status))fail('failed-precondition','Anliegen ist abgeschlossen.');
    changes.title=clean(data.title,4,100);changes.text=clean(data.description,5,1200);changes.status='wartet_freigabe';
   }else if(action==='post.status'){
    if(!['archiviert','erledigt','wartet_freigabe'].includes(data.status))fail('invalid-argument','Status ungültig.');
    if(!['offen','wartet_freigabe'].includes(x.status)&&data.status!=='archiviert')fail('failed-precondition','Anliegen ist abgeschlossen.');
    changes.status=data.status;
   }else fail('invalid-argument','Aktion unbekannt.');
   result=changes.status||x.status;tx.update(ref,changes);
  }
 });
 return {ok:true,id,status:result};
}
function compact(doc){const x=doc.data();return {...p.publicFields(doc.id,x),kind:'request',collection:'requests',description:x.text};}
async function photo(ctx,path){
 if(typeof path!=='string'||path.length>320||!/^post-photos\/requests\/[A-Za-z0-9_-]{5,128}\/[A-Za-z0-9_-]{5,128}\/[0-2]\.jpg$/.test(path))fail('invalid-argument','Fotopfad ungültig.');
 const docs=await posts.where('photoPaths','array-contains',path).limit(2).get();
 if(!docs.docs.some(d=>p.canView(d.data(),ctx)&&path.split('/')[2]===d.data().uid))fail('permission-denied','Foto nicht verfügbar.');
 await quota(ctx,'photo',250);
 const file=getStorage().bucket('quartinaut.firebasestorage.app').file(path),[meta]=await file.getMetadata();
 if(meta.contentType!=='image/jpeg'||Number(meta.size)>900*1024)fail('failed-precondition','Foto ungültig.');
 const [bytes]=await file.download();
 if(bytes.length>900*1024||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)fail('failed-precondition','Foto ungültig.');
 return {mime:'image/jpeg',base64:bytes.toString('base64')};
}
async function startChat(ctx,id){
 const {item}=await authorized(ctx,id);
 if(item.uid===ctx.uid||item.status!=='offen')fail('failed-precondition','Kein Kontakt zu diesem Anliegen möglich.');
 const blocks=await Promise.all([db.collection('userBlocks').doc(ctx.uid+'_'+item.uid).get(),db.collection('userBlocks').doc(item.uid+'_'+ctx.uid).get()]);
 if(blocks.some(x=>x.exists))fail('permission-denied','Kontakt blockiert.');
 const participants=[ctx.uid,item.uid].sort(),chatId='chat_'+id+'_'+participants.join('_'),ref=db.collection('chats').doc(chatId);
 await db.runTransaction(async tx=>{
  const existing=await tx.get(ref);
  if(existing.exists){
   const members=existing.data().participants;
   if(!Array.isArray(members)||members.length!==2||!participants.every(x=>members.includes(x)))fail('permission-denied','Chatbindung ungültig.');
   return;
  }
  const at=now();
  tx.create(ref,{id:chatId,requestId:id,requestTitle:item.title,requestOwnerUid:item.uid,participants,
   participantLabels:{[ctx.uid]:String(ctx.profile.displayName||'Quartiermitglied').slice(0,80),[item.uid]:item.authorName},
   mutedBy:[],blockedBy:[],readBy:{[ctx.uid]:at},createdAt:at,lastMessageAt:at,lastMessagePreview:'',lastSenderUid:''});
 });
 return {ok:true,chat:{id:chatId}};
}
async function reactions(ctx,data){
 const {id}=await authorized(ctx,data.id),root=social.doc(id),at=now();
 await quota(ctx,'social',250);
 if(data.action==='social.comments.list'){
  const rows=await root.collection('comments').limit(70).get();
  return {comments:rows.docs.map(d=>({id:d.id,...d.data()})),summary:await summary()};
 }
 async function summary(){const [r,like]=await Promise.all([root.get(),root.collection('likes').doc(ctx.uid).get()]);return {likes:Number(r.data()?.likes||0),comments:Number(r.data()?.comments||0),liked:like.exists};}
 if(data.action==='social.like.toggle'){
  await db.runTransaction(async tx=>{
   const like=root.collection('likes').doc(ctx.uid),[r,old]=await Promise.all([tx.get(root),tx.get(like)]);
   tx.set(root,{likes:Math.max(0,Number(r.data()?.likes||0)+(old.exists?-1:1)),updatedAt:at},{merge:true});
   if(old.exists)tx.delete(like);else tx.create(like,{uid:ctx.uid,createdAt:at});
  });return {summary:await summary()};
 }
 if(data.action==='social.comment.create'){
  const text=clean(data.text||data.message,2,500),op=clean(data.opId,8,100),ref=root.collection('comments').doc(hash(ctx.uid+'|'+op).slice(0,40));
  await db.runTransaction(async tx=>{
   const [old,r]=await Promise.all([tx.get(ref),tx.get(root)]);
   if(old.exists){if(old.data().uid!==ctx.uid||old.data().text!==text)fail('already-exists','Vorgangskennung bereits verwendet.');return;}
   tx.create(ref,{uid:ctx.uid,authorUid:ctx.uid,authorName:String(ctx.profile.displayName||'Quartiermitglied').slice(0,80),text,createdAt:at});
   tx.set(root,{comments:Number(r.data()?.comments||0)+1,updatedAt:at},{merge:true});
  });return {ok:true};
 }
 fail('invalid-argument','Reaktion unbekannt.');
}
exports.quartinautAudience=onCall({region:'europe-west6',memory:'512MiB',timeoutSeconds:60,maxInstances:8},async req=>{
 const ctx=await context(req),d=req.data||{},action=d.action;
 if(action==='capabilities')return {ok:true,version:1,requests:true,scopes:[...p.SCOPES]};
 if(action==='location.set'){
  let value;try{value=p.center(d.center);}catch(e){fail('invalid-argument',e.message);}
  await quota(ctx,'location',100);
  await locations.doc(ctx.uid).set({uid:ctx.uid,center:value,updatedAt:Timestamp.now(),validUntil:Timestamp.fromMillis(Date.now()+2*3600_000)});
  return {ok:true};
 }
 if(action==='feed')return feed(ctx);
 if(action==='create')return create(ctx,d);
 if(['approve','reject','post.delete','post.edit','post.status'].includes(action))return manage(ctx,d);
 if(action==='posts.mine'){
  const rows=await posts.where('uid','==',ctx.uid).limit(140).get();
  return {items:rows.docs.filter(x=>x.data().status!=='gelöscht').map(compact)};
 }
 if(action==='radar.list'){
  let docs=(await visible(ctx)).filter(x=>x.data().status==='offen');
  if(d.scope==='municipality')docs=docs.filter(x=>p.norm(x.data().areaKey)===p.norm(ctx.profile.areaKey));
  const tags=Array.isArray(d.tags)?d.tags.filter(x=>typeof x==='string').slice(0,10):[];
  if(tags.length)docs=docs.filter(x=>tags.includes('request')||tags.includes(x.data().category));
  return {items:docs.map(compact).slice(0,100)};
 }
 if(action==='favorite.toggle'){
  const {id}=await authorized(ctx,d.id),ref=settings.doc(ctx.uid).collection('favorites').doc(id),old=await ref.get();
  if(old.exists)await ref.delete();else await ref.set({itemId:id,createdAt:now()});
  return {ok:true,saved:!old.exists};
 }
 if(action==='favorites.list'){
  const saved=await settings.doc(ctx.uid).collection('favorites').limit(100).get(),items=[];
  for(const f of saved.docs){const row=await posts.doc(f.id).get();if(row.exists&&p.canView(row.data(),ctx))items.push({...compact(row),itemId:row.id});}
  return {items};
 }
 if(action==='photo.read')return photo(ctx,d.path);
 if(action==='trust.profile'){
  const {item}=await authorized(ctx,d.id),owner=(await db.collection('users').doc(item.uid).get()).data()||{};
  const reviews=await db.collection('quartinautTrustReviews').where('toUid','==',item.uid).limit(150).get();
  const scores=reviews.docs.map(x=>Number(x.data().score)).filter(x=>x>=1&&x<=5);
  return {ok:true,profile:{displayName:String(owner.displayName||'Quartiermitglied').slice(0,80),
   accountType:String(owner.accountType||'resident').slice(0,25),verified:owner.verified===true,
   totalReviews:scores.length,averageRating:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10:0}};
 }
 if(action==='chat.start')return startChat(ctx,idOf(d.id));
 if(typeof action==='string'&&action.startsWith('social.'))return reactions(ctx,d);
 fail('invalid-argument','Aktion unbekannt.');
});
