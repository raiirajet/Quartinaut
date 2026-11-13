'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {safeId,cleanText,participants,safeChat,safeMessage}=require('../validation');
test('rejects unsafe Firestore IDs',()=>{
  assert.equal(safeId('chat_12'), 'chat_12');
  for(const s of ['','a','../owner','owner/chat','x'.repeat(400)])assert.throws(()=>safeId(s));
});
test('only exact 1:1 participants may read a chat',()=>{
  assert.equal(participants({participants:['user_A','user_B']},'user_A'),true);
  assert.equal(participants({participants:['user_A','user_B']},'other'),false);
  assert.equal(participants({participants:['user_A','user_A']},'user_A'),false);
  assert.equal(participants({participants:['user_A','user_B','other']},'user_A'),false);
});
test('message fields are length bounded',()=>{
  assert.equal(cleanText(' Hi '),'Hi');
  assert.throws(()=>cleanText(' '.repeat(20)));
  assert.throws(()=>cleanText('x'.repeat(501)));
});
test('public serialized chat excludes unneeded internal fields',()=>{
  const x=safeChat('chat_12',{requestId:'req123',requestTitle:'Hello',
    participants:['a','b'],privateUserNotes:'SECRET'});
  assert.equal(x.privateUserNotes,undefined);
  const m=safeMessage('msg_123',{chatId:'chat_12',text:'Hi',internalDebug:'SECRET'});
  assert.equal(m.internalDebug,undefined);
});
