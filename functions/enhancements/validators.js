'use strict';
const PUBLIC_KINDS = Object.freeze(['lend','market','lost','group','project','calendar']);
const REMINDER_KINDS = Object.freeze(['event','waste','municipality','association']);
const POST_STATUSES = Object.freeze(['paused','archived','completed','pending','published']);
const ID=/^[A-Za-z0-9_-]{5,150}$/;
function safeId(x){if(typeof x!=='string'||!ID.test(x))throw new Error('Ungültige Kennung.');return x;}
function text(x,min,max,label){if(typeof x!=='string')throw new Error(label+' fehlt.');const s=x.trim();if(s.length<min||s.length>max)throw new Error(label+' muss '+min+'–'+max+' Zeichen haben.');return s;}
function validMoney(x){const n=Number(x);if(!Number.isFinite(n)||n<0||n>100000||Math.round(n*100)!==n*100)throw new Error('Ungültiger CHF-Betrag.');return n;}
function own(uid,data,field){return typeof uid==='string'&&!!uid&&data&&data[field]===uid;}
function cantonAllowed(uid,profile,data){return !!uid&&!!profile&&!!data&&profile.cantonCode&&data.cantonCode===profile.cantonCode;}
function safeTags(tags){
 if(!Array.isArray(tags)||tags.length>10)throw new Error('Zu viele Radar-Themen.');
 return [...new Set(tags.map(t=>text(t,2,40,'Kategorie')))];
}
function boundedPhoto(x) {
 if(typeof x!=='string'||x.length>3_900_000||x.length<44)throw new Error('Foto zu gross oder leer.');
 const b64=x.replace(/^data:image\/jpeg;base64,/,'');
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))throw new Error('Ungültiger Bildcode.');
 const data=Buffer.from(b64,'base64');
 if(data.length>2_850_000||data.length<64 || data[0]!==255||data[1]!==216||data[2]!==255)
  throw new Error('Nur JPEG mit maximal 2.85 MB erlaubt.');
 return data;
}
const terminalStatus=s=>['completed','returned'].includes(s);
module.exports={PUBLIC_KINDS,REMINDER_KINDS,POST_STATUSES,safeId,text,validMoney,own,cantonAllowed,safeTags,boundedPhoto,terminalStatus};
