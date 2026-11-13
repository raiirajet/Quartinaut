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
const participants=(chat,uid)=>Array.isArray(chat?.participants)&&
  chat.participants.length===2&&new Set(chat.participants).size===2&&chat.participants.includes(uid);
const safeChat=(id,raw)=>({
  id,requestId:String(raw.requestId||''),requestTitle:String(raw.requestTitle||'Privater Chat').slice(0,140),
  requestOwnerUid:String(raw.requestOwnerUid||''),
  participants:raw.participants,participantLabels:raw.participantLabels||{},
  lastMessageAt:String(raw.lastMessageAt||''),lastMessagePreview:String(raw.lastMessagePreview||'').slice(0,130),
  lastSenderUid:String(raw.lastSenderUid||''),readBy:raw.readBy||{},createdAt:String(raw.createdAt||'')
});
const safeMessage=(id,m)=>({
  id,chatId:String(m.chatId||''),senderUid:String(m.senderUid||''),
  text:String(m.text||'').slice(0,500),createdAt:String(m.createdAt||''),
  readAt:String(m.readAt||''),messageType:String(m.messageType||'text')
});
module.exports={safeId,cleanText,participants,safeChat,safeMessage};
