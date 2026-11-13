'use strict';
// Quartinaut optional features: additive Cloud Function; never changes the
// existing web schema, production Firestore rules or Storage rules.
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const crypto=require('node:crypto');
const sharp=require('sharp');
const {PUBLIC_KINDS,REMINDER_KINDS,safeId,text,validMoney,own,cantonAllowed,
  safeTags,boundedPhoto}=require('./validators');

if(!getApps().length)initializeApp();
const db=getFirestore(),bucket=getStorage().bucket('quartinaut.firebasestorage.app');
const users=db.collection('users'),hub=db.collection('communityHubItems'),requests=db.collection('requests');
const cal=db.collection('communityCalendar'),favorites=db.collection('communityUserSettings');
const notes=db.collection('quartinautUserReminders'),reviews=db.collection('quartinautTrustReviews');
const share=db.collection('quartinautLoanHandover'),rate=db.collection('quartinautEnhancementRate');
const now=()=>new Date().toISOString(),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const error=(code,detail)=>{throw new HttpsError(code,detail);};
const cleanInput=(fn)=>{try{return fn();}catch(e){error('invalid-argument',e.message)}};
const stamp=()=>({updatedAt:now()});
const setLimit=(s,n=120)=>String(s||'').slice(0,n);
const filterId=value=>cleanInput(()=>safeId(value));
const options={region:'europe-west6',memory:'512MiB',timeoutSeconds:60,maxInstances:8};

async function context(req){
 const uid=req.auth?.uid;
 if(!uid)error('unauthenticated','Bitte anmelden.');
 const snap=await users.doc(uid).get(),profile=snap.data();
 if(!profile || !['active',undefined,null].includes(profile.accountStatus))
   error('permission-denied','Konto nicht aktiviert.');
 return {uid,profile,claims:req.auth.token||{},canton:setLimit(profile.cantonCode,2),
   municipality:setLimit(profile.areaKey||profile.area,180).toLowerCase()};
}
function publicHub(ctx,data) {
 return data && PUBLIC_KINDS.includes(data.kind) &&
   data.status==='published' && data.cantonCode===ctx.canton;
}
function publicRequest(ctx,data){
 return data && data.status==='offen' && data.cantonCode===ctx.canton;
}
const asDoc=(snap,kind)=>({
 id:snap.id,kind,title:setLimit(snap.data().title,100),
 description:setLimit(snap.data().description||snap.data().text,1200),
 category:setLimit(snap.data().category,60),area:setLimit(snap.data().area,140),
 cantonCode:setLimit(snap.data().cantonCode,2),
 createdAt:setLimit(snap.data().createdAt,50),
 status:setLimit(snap.data().status,30),
 photoPaths:Array.isArray(snap.data().photoPaths)?snap.data().photoPaths.slice(0,3):[]
});
async function postRef(ctx,data) {
 const collection=data.collection;
 if(!['requests','communityHubItems'].includes(collection))error('invalid-argument','Bereich ungültig.');
 const ref=(collection==='requests'?requests:hub).doc(filterId(data.id));
 const snap=await ref.get();
 if(!snap.exists)error('not-found','Beitrag nicht gefunden.');
 const value=snap.data();
 if((collection==='requests'?value.uid:value.ownerUid)!==ctx.uid)
   error('permission-denied','Nur eigene Beiträge können verändert werden.');
 return {ref,value,collection};
}
async function postMine(ctx) {
 const [req,item]=await Promise.all([
   requests.where('uid','==',ctx.uid).limit(140).get(),
   hub.where('ownerUid','==',ctx.uid).limit(140).get()]);
 return [...req.docs.map(d=>asDoc(d,'request')),
   ...item.docs.map(d=>asDoc(d,d.data().kind))]
   .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,180);
}
async function managePost(ctx,data){
 const {ref,value,collection}=await postRef(ctx,data);
 const action=data.action;
 const updates={updatedAt:now()};
 if(action==='post.edit') {
   if(!['wartet_freigabe','offen','pending','published','paused'].includes(value.status))
     error('failed-precondition','Abgeschlossene Beiträge können nicht mehr bearbeitet werden.');
   updates.title=cleanInput(()=>text(data.title,5,100,'Titel'));
   const description=cleanInput(()=>text(data.description,12,1200,'Beschreibung'));
   updates[collection==='requests'?'text':'description']=description;
   if(collection==='requests') {
     // Edits of published requests must go through review again.
     if(value.status==='offen')updates.status='wartet_freigabe';
   } else {
     if(['market','lend'].includes(value.kind) && data.priceChf!==undefined)
       updates.priceChf=cleanInput(()=>validMoney(data.priceChf));
     if(value.status==='published')updates.status='pending';
   }
 } else if(action==='post.status') {
   const status=setLimit(data.status,35);
   if(collection==='requests'){
     if(!['archiviert','erledigt','wartet_freigabe'].includes(status))
       error('invalid-argument','Unzulässiger Status.');
     if(!['offen','wartet_freigabe'].includes(value.status) &&
        status!=='archiviert')error('failed-precondition','Beitrag ist nicht mehr aktiv.');
     updates.status=status;
   } else {
     // Never permit approval via this owner-only endpoint.
     if(status==='paused'){
       if(value.status!=='published')error('failed-precondition','Nur veröffentlichte Beiträge pausieren.');
       updates.status='paused';updates.statusBeforePause='published';
     } else if(status==='published'){
       if(value.status!=='paused'||value.statusBeforePause!=='published')
         error('permission-denied','Freigabe kann nicht umgangen werden.');
       updates.status='published';
     } else if(status==='archived'){
       if(value.status==='completed')error('failed-precondition','Bereits abgeschlossen.');
       updates.status='archived';
     } else if(status==='completed'){
       if(!['market','lend','lost'].includes(value.kind))
         error('failed-precondition','Nur Verkaufs-/Leihangebote und Fundstücke können abgeschlossen werden.');
       updates.status='completed';updates.availability='completed';
     } else error('invalid-argument','Unzulässiger Status.');
   }
 } else error('invalid-argument','Unbekannte Beitragsaktion.');
 await db.runTransaction(async tx=>{
   const current=await tx.get(ref);
   if(!current.exists || (collection==='requests'?current.data().uid:current.data().ownerUid)!==ctx.uid)
     error('permission-denied','Beitrag nicht mehr zugänglich.');
   if(current.data().updatedAt!==value.updatedAt)
     error('aborted','Beitrag wurde inzwischen geändert. Bitte neu laden.');
   tx.update(ref,updates);
 });
 return {ok:true,id:ref.id,status:updates.status||value.status};
}
async function targetForFavorite(ctx,data){
 const collection=data.collection;
 if(!['requests','communityHubItems'].includes(collection))
   error('invalid-argument','Ungültiger Favoritentyp.');
 const snap=await (collection==='requests'?requests:hub).doc(filterId(data.id)).get();
 if(!snap.exists)error('not-found','Eintrag nicht gefunden.');
 const val=snap.data();
 if(!(collection==='requests'?publicRequest(ctx,val):publicHub(ctx,val)))
   error('permission-denied','Nicht öffentlich oder ausserhalb deines Kantons.');
 return {collection,ref:snap,kind:collection==='requests'?'request':val.kind};
}
async function setFavorite(ctx,data){
 const target=await targetForFavorite(ctx,data);
 const hash=sha(target.collection+'|'+target.ref.id).slice(0,36);
 const ref=favorites.doc(ctx.uid).collection('favorites').doc(hash);
 const present=(await ref.get()).exists;
 if(present)await ref.delete();
 else await ref.set({uid:ctx.uid,kind:target.kind,collection:target.collection,
   itemId:target.ref.id,title:setLimit(target.ref.data().title,100),
   createdAt:now()});
 return {ok:true,saved:!present};
}
async function listFavorites(ctx){
 const records=await favorites.doc(ctx.uid).collection('favorites').limit(150).get();
 const visible=[];
 for(const x of records.docs){
   const d=x.data(),collection=d.collection;
   if(!['requests','communityHubItems'].includes(collection))continue;
   const ref=await (collection==='requests'?requests:hub).doc(setLimit(d.itemId)).get();
   if(ref.exists&&(collection==='requests'?publicRequest(ctx,ref.data()):publicHub(ctx,ref.data()))) {
     visible.push({id:x.id,itemId:d.itemId,collection,title:setLimit(ref.data().title,100),
       kind:collection==='requests'?'request':ref.data().kind,createdAt:d.createdAt});
   }
 }
 return visible.slice(0,100);
}
async function radar(ctx,data){
 const tags=cleanInput(()=>safeTags(data.tags||[]));
 const scope=data.scope==='municipality'?'municipality':'canton';
 const limit=Number.isInteger(data.limit)&&data.limit>=1&&data.limit<=100?data.limit:60;
 const [req,hubs]=await Promise.all([
  requests.where('cantonCode','==',ctx.canton).where('status','==','offen').limit(140).get(),
  hub.where('cantonCode','==',ctx.canton).limit(180).get()
 ]);
 let results=[
   ...req.docs.filter(d=>publicRequest(ctx,d.data())).map(d=>asDoc(d,'request')),
   ...hubs.docs.filter(d=>publicHub(ctx,d.data())).map(d=>asDoc(d,d.data().kind))
 ];
 if(scope==='municipality') results=results.filter(row=>
   row.area.toLocaleLowerCase('de-CH')===setLimit(ctx.profile.area,140).toLocaleLowerCase('de-CH'));
 if(tags.length)results=results.filter(row=>
   tags.includes(row.kind)||tags.includes(row.category));
 return {items:results.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))
   .slice(0,limit),scope,kind:'region',canton:ctx.canton};
}
async function trust(ctx,data) {
 const item=await targetForFavorite(ctx,data);
 const profileUid=item.ref.data()[item.collection==='requests'?'uid':'ownerUid'];
 if(!profileUid)error('not-found','Kein Anbieterprofil gefunden.');
 const p=(await users.doc(profileUid).get()).data()||{};
 const reviewsSnap=await reviews.where('toUid','==',profileUid).limit(150).get();
 const scores=reviewsSnap.docs.map(x=>Number(x.data().score||0)).filter(x=>x>=1&&x<=5);
 return {verified:p.verified===true,accountType:setLimit(p.accountType||'resident',25),
   displayName:setLimit(p.displayName||'Quartiermitglied',70),
   totalReviews:scores.length,averageRating:scores.length?
   Math.round(scores.reduce((a,b)=>a+b,0)*10/scores.length)/10:0,
   since:p.createdAt||null};
}
async function addReview(ctx,data){
 const type=data.type;
 if(!['market','loan'].includes(type))error('invalid-argument','Transaktionstyp ungültig.');
 const id=filterId(data.transactionId);
 const collection=type==='market'?'marketplaceHolds':'loanReservations';
 const doc=await db.collection(collection).doc(id).get();
 if(!doc.exists)error('not-found','Transaktion nicht gefunden.');
 const row=doc.data();
 const from=type==='market'?row.buyerUid:row.borrowerUid;
 const to=type==='market'?row.sellerUid:row.ownerUid;
 if(from!==ctx.uid||!to||to===ctx.uid ||
    row.status!==(type==='market'?'completed':'returned'))
   error('permission-denied','Nur abgeschlossene eigene Transaktionen dürfen bewertet werden.');
 const score=Number(data.score);
 if(!Number.isInteger(score)||score<1||score>5)error('invalid-argument','Sterne 1–5 eingeben.');
 const comment=cleanInput(()=>text(data.comment,5,300,'Bewertung'));
 const ref=reviews.doc(sha(collection+'|'+id+'|'+ctx.uid).slice(0,48));
 await ref.create({fromUid:ctx.uid,toUid:to,transactionId:id,type,score,comment,
   createdAt:now()}).catch(e=>{
    if(e.code===6||e.code==='already-exists')error('already-exists','Diese Transaktion wurde bereits bewertet.');
    throw e;
   });
 return {ok:true};
}
async function calendarReminders(ctx,data){
 const ref=notes.doc(ctx.uid).collection('calendarReminders');
 if(data.action==='reminders.list'){
   const snap=await ref.limit(100).get();return snap.docs.map(x=>({id:x.id,...x.data()}));
 }
 const eventId=filterId(data.id),event=(await cal.doc(eventId).get());
 if(!event.exists||!event.data().published||
    !cantonAllowed(ctx.uid,ctx.profile,event.data()))
   error('permission-denied','Gemeindetermin nicht erreichbar.');
 const key=sha(eventId).slice(0,36);
 if(data.action==='reminders.remove'){
   await ref.doc(key).delete();return {ok:true};
 }
 const ahead=Number(data.hoursBefore);
 if(![1,3,12,24,48,72].includes(ahead))
   error('invalid-argument','Ungültiger Erinnerungsvorlauf.');
 await ref.doc(key).set({eventId,kind:event.data().kind,
   title:setLimit(event.data().title,100),date:setLimit(event.data().date,10),
   hoursBefore:ahead,updatedAt:now()},{merge:true});
 return {ok:true};
}
async function handover(ctx,data){
 const action=data.action;
 if(action==='handover.confirm'){
   const token=setLimit(data.token,200);
   if(!/^[A-Za-z0-9_-]{36,120}$/.test(token))
     error('invalid-argument','Ungültiger QR-Code.');
   const id=sha(token).slice(0,48),ref=share.doc(id);
   await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists)error('not-found','QR-Code abgelaufen oder ungültig.');
    const v=snap.data();
    if(v.expiresAt<now()||v.usedAt)error('failed-precondition','Code ist abgelaufen oder benutzt.');
    if(v.issuerUid===ctx.uid||![v.ownerUid,v.borrowerUid].includes(ctx.uid))
      error('permission-denied','QR-Code muss von der anderen beteiligten Person bestätigt werden.');
    const loan=await tx.get(db.collection('loanReservations').doc(v.loanId));
    if(!loan.exists||loan.data().status!=='accepted' ||
        loan.data().ownerUid!==v.ownerUid||loan.data().borrowerUid!==v.borrowerUid)
      error('failed-precondition','Diese Ausleihe ist nicht mehr aktiv.');
    tx.update(ref,{usedAt:now(),confirmedBy:ctx.uid});
    tx.update(loan.ref,{handoverConfirmedAt:now(),handoverBy:ctx.uid});
   });
   return {ok:true,confirmed:true};
 }
 const loanId=filterId(data.loanId),snap=await db.collection('loanReservations').doc(loanId).get();
 if(!snap.exists||snap.data().status!=='accepted')error('failed-precondition','Ausleihe ist nicht bestätigt.');
 const val=snap.data();
 if(![val.ownerUid,val.borrowerUid].includes(ctx.uid))
   error('permission-denied','Nur Beteiligte dürfen einen Übergabecode erzeugen.');
 const token=crypto.randomBytes(30).toString('base64url'),id=sha(token).slice(0,48);
 const expires=new Date(Date.now()+10*60*1000).toISOString();
 await share.doc(id).create({loanId,issuerUid:ctx.uid,
   ownerUid:val.ownerUid,borrowerUid:val.borrowerUid,
   createdAt:now(),expiresAt:expires,usedAt:null});
 return {ok:true,token,expiresAt:expires};
}
async function photo(ctx,data){
 const mode=data.action,ns=data.namespace;
 if(!['requests','community','groups'].includes(ns))
   error('invalid-argument','Ungültiger Fotobereich.');
 const token=filterId(data.token),idx=Number(data.index);
 if(!Number.isInteger(idx)||idx<0||idx>2)
   error('invalid-argument','Höchstens 3 Bilder erlaubt.');
 const path=['post-photos',ns,ctx.uid,token,idx+'.jpg'].join('/');
 const file=bucket.file(path);
 if(mode==='photo.remove'){
   await file.delete({ignoreNotFound:true});return {ok:true,path};
 }
 const binary=cleanInput(()=>boundedPhoto(data.jpegBase64));
 // Shared global safety cap. Each user can attempt no more than 35 photo uploads per day.
 const rateRef=rate.doc(ctx.uid),day=now().slice(0,10);
 await db.runTransaction(async tx=>{
  const old=await tx.get(rateRef),count=old.data()?.day===day?Number(old.data().count||0):0;
  if(count>=35)error('resource-exhausted','Foto-Tageslimit erreicht.');
  tx.set(rateRef,{uid:ctx.uid,day,count:count+1,updatedAt:now()});
 });
 let jpeg;
 try {
   jpeg=await sharp(binary,{limitInputPixels:24000000,failOn:'error'})
    .rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true})
    .jpeg({quality:75,mozjpeg:true}).toBuffer();
 } catch(e){error('invalid-argument','Foto ist beschädigt oder hat eine nicht unterstützte Auflösung.');}
 if(jpeg.length>850000)error('resource-exhausted','Bild kann nicht ausreichend komprimiert werden.');
 await file.save(jpeg,{resumable:false,metadata:{contentType:'image/jpeg',
   cacheControl:'private,no-store',metadata:{uploadedBy:ctx.uid}}});
 return {ok:true,path,size:jpeg.length};
}
exports.quartinautEnhancements=onCall(options,async request=>{
 try {
  const ctx=await context(request),d=request.data||{};
  switch(d.action){
    case 'radar.list':return {ok:true,...await radar(ctx,d)};
    case 'posts.mine':return {ok:true,items:await postMine(ctx)};
    case 'post.edit':case 'post.status':return await managePost(ctx,d);
    case 'favorite.toggle':return await setFavorite(ctx,d);
    case 'favorites.list':return {ok:true,items:await listFavorites(ctx)};
    case 'trust.profile':return {ok:true,profile:await trust(ctx,d)};
    case 'trust.review':return await addReview(ctx,d);
    case 'reminders.list':case 'reminders.save':case 'reminders.remove':
      return {ok:true,items:await calendarReminders(ctx,d)};
    case 'handover.create':case 'handover.confirm':return await handover(ctx,d);
    case 'photo.put':case 'photo.remove':return await photo(ctx,d);
    default:error('invalid-argument','Unbekannte Erweiterungsaktion.');
  }
 } catch(e) {
  if(e instanceof HttpsError)throw e;
  console.error('[Quartinaut enhancements]',e?.code||'unexpected');
  throw new HttpsError('internal','Aktion konnte nicht abgeschlossen werden.');
 }
});
