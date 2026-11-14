'use strict';
const safeId=(s,max=150)=>{
  if(typeof s!=='string'||s.length<5||s.length>max||!/^[A-Za-z0-9_-]+$/.test(s))
    throw new Error('Ungültige Kennung.');
  return s;
};
const cleanText=(s)=>{
  if(typeof s!=='string')throw new Error('Nachricht fehlt.');
  const out=s.trim();
  if(!out || out.length>500)throw new Error('Nachricht muss 1 bis 500 Zeichen enthalten.');
  return out;
};
const cleanCaption=(s)=>{
  if(s===undefined||s===null)return '';
  if(typeof s!=='string')throw new Error('Bildtext ist ungültig.');
  const out=s.trim();
  if(out.length>500)throw new Error('Bildtext darf höchstens 500 Zeichen enthalten.');
  return out;
};
const safeMedia=(raw)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Medienangaben fehlen.');
  const storagePath=String(raw.storagePath||'');
  const contentType=String(raw.contentType||'');
  const size=Number(raw.size||0);
  if(!/^chat-media\/[A-Za-z0-9_-]{8,340}\/[A-Za-z0-9_-]{20,128}\/[A-Za-z0-9_-]{8,150}\.jpg$/.test(storagePath))
    throw new Error('Ungültiger Medienpfad.');
  if(contentType!=='image/jpeg')throw new Error('Nur JPEG-Bilder sind erlaubt.');
  if(!Number.isInteger(size)||size<1||size>2500000)throw new Error('Bildgrösse ist ungültig.');
  return {storagePath,contentType,size};
};
const reportReason=(value)=>{
  const reason=String(value||'');
  if(!['spam','harassment','fraud','unsafe','other'].includes(reason))
    throw new Error('Ungültiger Meldegrund.');
  return reason;
};
const participants=(chat,uid)=>Array.isArray(chat?.participants)&&
  chat.participants.length===2&&new Set(chat.participants).size===2&&chat.participants.includes(uid);
const safeChat=(id,raw)=>({
  id,requestId:String(raw.requestId||''),requestTitle:String(raw.requestTitle||'Privater Chat').slice(0,140),
  requestOwnerUid:String(raw.requestOwnerUid||''),
  participants:raw.participants,participantLabels:raw.participantLabels||{},
  lastMessageAt:String(raw.lastMessageAt||''),lastMessagePreview:String(raw.lastMessagePreview||'').slice(0,130),
  lastSenderUid:String(raw.lastSenderUid||''),readBy:raw.readBy||{},createdAt:String(raw.createdAt||''),
  mutedBy:Array.isArray(raw.mutedBy)?raw.mutedBy.slice(0,2):[],
  blockedBy:Array.isArray(raw.blockedBy)?raw.blockedBy.slice(0,2):[]
});
const safeMessage=(id,m)=>({
  id,chatId:String(m.chatId||''),senderUid:String(m.senderUid||''),
  text:String(m.text||'').slice(0,500),createdAt:String(m.createdAt||''),
  readAt:String(m.readAt||''),messageType:String(m.messageType||'text'),
  media:m.media&&typeof m.media==='object'?{
    storagePath:String(m.media.storagePath||''),contentType:String(m.media.contentType||''),
    size:Number(m.media.size||0)
  }:null
});
module.exports={safeId,cleanText,cleanCaption,safeMedia,reportReason,participants,safeChat,safeMessage};
