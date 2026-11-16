'use strict';
const CANTONS=new Set('AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH'.split(' '));
const SCOPES=new Set(['radius','municipality','canton','country']);
const RADII=new Set([5,10,25,50]);
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const bounded=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max;
const only=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k));
function center(value){
 if(!only(value,['lat','lng'])||Object.keys(value).length!==2)throw Error('Ungültiger Mittelpunkt.');
 const {lat,lng}=value;
 if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<45||lat>48||lng<5||lng>11||
    Math.abs(lat*100-Math.round(lat*100))>1e-7||Math.abs(lng*100-Math.round(lng*100))>1e-7)
  throw Error('Nur ein ungefährer Schweizer Mittelpunkt ist erlaubt.');
 return {lat,lng};
}
function distanceKm(a,b){
 const r=Math.PI/180,dl=(b.lat-a.lat)*r,dg=(b.lng-a.lng)*r;
 const h=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dg/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
function moderator(ctx,item){
 return ctx.claims.admin===true||ctx.claims.role==='admin'||
  (ctx.claims.role==='area_admin'&&!!norm(ctx.claims.adminScopeArea)&&norm(ctx.claims.adminScopeArea)===norm(item.areaKey||item.area));
}
function canView(item,ctx,now=Date.now()){
 if(!ctx.uid||!ctx.profile||!['active',undefined,null].includes(ctx.profile.accountStatus))return false;
 if(item.tenantId!=='quartinaut'||item.status==='gelöscht')return false;
 if(item.uid===ctx.uid||moderator(ctx,item))return true;
 if(item.status!=='offen'||!Number.isFinite(Date.parse(item.expiresAt))||Date.parse(item.expiresAt)<=now)return false;
 const canton=ctx.profile.cantonCode;
 if(!CANTONS.has(canton))return false;
 if(item.audienceLevel==='country')return true;
 if(item.audienceLevel==='canton')return canton===item.cantonCode;
 if(item.audienceLevel==='municipality')return !!norm(ctx.profile.areaKey||ctx.profile.area)&&
  canton===item.cantonCode&&norm(ctx.profile.areaKey||ctx.profile.area)===norm(item.areaKey||item.area);
 if(item.audienceLevel==='radius'){
  if(!ctx.location||ctx.location.validUntil.toMillis()<=now||!RADII.has(item.radiusKm))return false;
  try{return distanceKm(center(item.center),center(ctx.location.center))<=item.radiusKm;}catch{return false;}
 }
 return false;
}
function validateCreate(input,profile,uid){
 const allowed=['title','text','category','type','urgency','audienceLevel','radiusKm','center','photoPaths'];
 if(!only(input,allowed)||!bounded(input.title,4,100)||!bounded(input.text,5,1200)||
    !bounded(input.category,1,60)||!['Suche','Biete'].includes(input.type)||!bounded(input.urgency,1,40)||!SCOPES.has(input.audienceLevel))
  throw Error('Bitte Titel, Beschreibung und Reichweite prüfen.');
 if(!CANTONS.has(profile.cantonCode)||!bounded(profile.areaKey,1,180)||!bounded(profile.area,1,180))throw Error('Gemeinde im Profil fehlt.');
 if(!Array.isArray(input.photoPaths)||input.photoPaths.length>3)throw Error('Höchstens drei Fotos erlaubt.');
 const photoPaths=input.photoPaths.map(path=>{
  if(typeof path!=='string'||path.length>320||!path.startsWith('post-photos/requests/'+uid+'/')||
     !/^post-photos\/requests\/[A-Za-z0-9_-]{5,128}\/[A-Za-z0-9_-]{5,128}\/[0-2]\.jpg$/.test(path))throw Error('Foto gehört nicht zu deinem Konto.');
  return path;
 });
 if(new Set(photoPaths).size!==photoPaths.length)throw Error('Doppelte Fotos.');
 const result={title:input.title.trim(),text:input.text.trim(),category:input.category.trim(),type:input.type,
  urgency:input.urgency.trim(),audienceLevel:input.audienceLevel,photoPaths};
 if(input.audienceLevel==='radius'){
  if(!RADII.has(input.radiusKm))throw Error('Ungültiger Umkreis.');
  result.radiusKm=input.radiusKm;result.center=center(input.center);
 }else if(input.center!=null)throw Error('Diese Reichweite benötigt keinen Standort.');
 return result;
}
function publicFields(id,item){
 const out={id,tenantId:'quartinaut',uid:item.uid,authorId:item.uid,title:item.title,text:item.text,
  description:item.text,category:item.category,type:item.type,urgency:item.urgency,area:item.area,
  areaKey:item.areaKey,cantonCode:item.cantonCode,authorName:item.authorName,status:item.status,
  audienceLevel:item.audienceLevel,createdAt:item.createdAt,updatedAt:item.updatedAt,
  expiresAt:item.expiresAt,photoPaths:item.photoPaths||[],radiusKm:item.radiusKm||0};
 return out;
}
module.exports={CANTONS,SCOPES,RADII,norm,center,distanceKm,moderator,canView,validateCreate,publicFields};
