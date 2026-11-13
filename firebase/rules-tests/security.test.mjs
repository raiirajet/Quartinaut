import {after, before, beforeEach, test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';
import {ref, uploadBytes} from 'firebase/storage';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const alice='alice_user_000000000001';
const bob='bob_user_0000000000002';
const mallory='mallory_user_000000001';
const chatId=`chat_request1_${alice}_${bob}`;
let env;

const profile=(uid)=>({
  uid,role:'resident',accountType:'resident',accountStatus:'active',
  verified:false,area:'Bern (BE)',areaKey:'bern (be)',cantonCode:'BE'
});
const chat=()=>({
  id:chatId,requestId:'request1',requestTitle:'Bohrmaschine',
  requestOwnerUid:bob,participants:[alice,bob],
  participantLabels:{[alice]:'Alice',[bob]:'Bob'},
  mutedBy:[],readBy:{[alice]:'2026-11-13T10:00:00Z'},
  createdAt:'2026-11-13T10:00:00Z',lastMessageAt:'2026-11-13T10:00:00Z',
  lastMessagePreview:'',lastSenderUid:''
});
const message=()=>({
  id:'msg_alice_operation0001',chatId,requestId:'request1',
  requestTitle:'Bohrmaschine',requestOwnerUid:bob,senderUid:alice,
  recipientUid:bob,participants:[alice,bob],
  participantLabels:{[alice]:'Alice',[bob]:'Bob'},text:'Hallo',
  createdAt:'2026-11-13T10:01:00Z',readAt:'',deliveryStatus:'sent'
});

before(async()=>{
  env=await initializeTestEnvironment({
    projectId:'demo-quartinaut-rules',
    firestore:{
      host:'127.0.0.1',port:8088,
      rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')
    },
    storage:{
      host:'127.0.0.1',port:9198,
      rules:fs.readFileSync(path.join(root,'storage.rules'),'utf8')
    }
  });
});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    for(const uid of [alice,bob,mallory]) await setDoc(doc(db,'users',uid),profile(uid));
    await setDoc(doc(db,'requests','request1'),{
      uid:bob,title:'Bohrmaschine',status:'offen',tenantId:'quartinaut',
      areaKey:'bern (be)',cantonCode:'BE'
    });
    await setDoc(doc(db,'chats',chatId),chat());
  });
});
after(async()=>{await env?.cleanup();});

test('owner can create a bounded Android device token',async()=>{
  const db=env.authenticatedContext(alice).firestore();
  await assertSucceeds(setDoc(doc(db,'deviceTokens','tokenhash1'),{
    id:'tokenhash1',token:'fcm_token_value_1234567890',uid:alice,active:true,
    platform:'android',area:'Bern (BE)',areaKey:'bern (be)',cantonCode:'BE',
    appVersion:'5.5.1-native-preview',updatedAt:'2026-11-13T10:00:00Z'
  }));
});

test('another user cannot hijack an existing device token',async()=>{
  await env.withSecurityRulesDisabled(async context=>setDoc(
    doc(context.firestore(),'deviceTokens','tokenhash2'),{
      id:'tokenhash2',token:'fcm_token_value_1234567890',uid:alice,active:true,
      area:'Bern (BE)',areaKey:'bern (be)',cantonCode:'BE',updatedAt:'2026-11-13T10:00:00Z'
    }
  ));
  const db=env.authenticatedContext(mallory).firestore();
  await assertFails(updateDoc(doc(db,'deviceTokens','tokenhash2'),{uid:mallory}));
});

test('device token rejects schema pollution and oversized values',async()=>{
  const db=env.authenticatedContext(alice).firestore();
  const base={
    id:'tokenhash3',token:'fcm_token_value_1234567890',uid:alice,active:true,
    platform:'android',area:'Bern (BE)',areaKey:'bern (be)',cantonCode:'BE',
    updatedAt:'2026-11-13T10:00:00Z'
  };
  await assertFails(setDoc(doc(db,'deviceTokens','tokenhash3'),{...base,extraData:'x'}));
  await assertFails(setDoc(doc(db,'deviceTokens','tokenhash3'),{...base,token:'x'.repeat(4097)}));
});

test('participant can send a message only with the exact chat binding',async()=>{
  const db=env.authenticatedContext(alice).firestore();
  await assertSucceeds(setDoc(doc(db,'chatMessages','msg_alice_operation0001'),message()));
  await assertFails(setDoc(doc(db,'chatMessages','msg_alice_operation0002'),{
    ...message(),id:'msg_alice_operation0002',recipientUid:mallory,
    participants:[alice,mallory]
  }));
});

test('non-participant cannot inject a message into a chat',async()=>{
  const db=env.authenticatedContext(mallory).firestore();
  await assertFails(setDoc(doc(db,'chatMessages','msg_mallory_operation1'),{
    ...message(),id:'msg_mallory_operation1',senderUid:mallory,
    recipientUid:bob,participants:[mallory,bob]
  }));
});

test('participant can update own read state but not another participant state',async()=>{
  const db=env.authenticatedContext(alice).firestore();
  const own={...chat(),lastMessageAt:'2026-11-13T10:01:00Z',
    lastMessagePreview:'Hallo',lastSenderUid:alice,
    readBy:{[alice]:'2026-11-13T10:01:00Z'}};
  await assertSucceeds(setDoc(doc(db,'chats',chatId),own));
  await assertFails(updateDoc(doc(db,'chats',chatId),{
    [`readBy.${bob}`]:'2026-11-13T10:02:00Z',
    lastMessageAt:'2026-11-13T10:02:00Z',lastMessagePreview:'Manipuliert',lastSenderUid:alice
  }));
});

test('unauthenticated client cannot read a private chat',async()=>{
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'chats',chatId)));
});

test('verification photo accepts one immutable JPEG only',async()=>{
  const storage=env.authenticatedContext(alice).storage();
  const object=ref(storage,`verification-photos/${alice}/verification1.jpg`);
  await assertSucceeds(uploadBytes(object,new Uint8Array([255,216,255]),{contentType:'image/jpeg'}));
  await env.withSecurityRulesDisabled(async context=>uploadBytes(
    ref(context.storage(),`verification-photos/${alice}/existing.jpg`),
    new Uint8Array([255,216,255]),{contentType:'image/jpeg'}
  ));
  await assertFails(uploadBytes(
    ref(storage,`verification-photos/${alice}/existing.jpg`),
    new Uint8Array([255,216,255]),{contentType:'image/jpeg'}
  ));
  await assertFails(uploadBytes(
    ref(storage,`verification-photos/${alice}/verification2.jpg`),
    new TextEncoder().encode('<svg/>'),{contentType:'image/svg+xml'}
  ));
});
