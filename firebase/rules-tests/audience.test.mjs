import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,getDocs,query,collection,where,Timestamp as ClientTimestamp} from 'firebase/firestore';
const require=createRequire(import.meta.url);
const admin=require('../../functions/audience/node_modules/firebase-admin');
if(!admin.apps.length)admin.initializeApp({projectId:'demo-quartinaut-rules'});
const db=admin.firestore();
const {quartinautAudience}=require('../../functions/audience');
const alice='alice_scope_user_001',bob='bob_scope_user_00002',eve='eve_scope_user_00003',staff='admin_scope_user_01';
const profile={accountStatus:'active',area:'Bern (BE)',areaKey:'bern (be)',cantonCode:'BE',displayName:'Quartiermitglied'};
const call=(uid,action,data={},token={})=>quartinautAudience.run({auth:uid?{uid,token}:undefined,data:{action,...data}});
const input=(level='radius')=>({title:'Nachbarschaftshilfe',text:'Ich suche Hilfe im Quartier.',category:'Alltagshilfe',type:'Suche',urgency:'Heute',
 audienceLevel:level,radiusKm:5,center:level==='radius'?{lat:46.95,lng:7.45}:null,photoPaths:[]});
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-quartinaut-rules',firestore:{host:'127.0.0.1',port:8088,
 rules:fs.readFileSync(new URL('../audience.firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{
 await env.clearFirestore();
 for(const uid of [alice,bob,eve,staff])await db.collection('users').doc(uid).set({...profile,uid});
 await db.collection('users').doc(eve).update({area:'Zürich (ZH)',areaKey:'zurich (zh)',cantonCode:'ZH'});
});
after(async()=>{await env.cleanup();await admin.app().delete();});
async function approved(level='radius'){
 const created=await call(alice,'create',{opId:'req_'+'a'.repeat(32),item:input(level)});
 await call(staff,'approve',{id:created.id},{admin:true});
 return created.id;
}
test('anonymous callable requests cannot read scoped content',async()=>{
 await assert.rejects(call(null,'feed'),{code:'unauthenticated'});
});
test('scoped pending request stays private and retries do not duplicate it',async()=>{
 const data={opId:'req_'+'a'.repeat(32),item:input()};
 const first=await call(alice,'create',data),second=await call(alice,'create',data);
 assert.equal(first.id,second.id);
 assert.equal((await db.collection('quartinautScopedRequests').get()).size,1);
 assert.deepEqual((await call(bob,'feed')).ids,[]);
 await assert.rejects(call(bob,'approve',{id:first.id}),{code:'permission-denied'});
});
test('nearby viewer receives an owner-only short-lived projection without street or coordinates',async()=>{
 const id=await approved();
 assert.deepEqual((await call(bob,'feed')).ids,[]);
 await call(bob,'location.set',{center:{lat:46.96,lng:7.45}});
 const feed=await call(bob,'feed');assert.deepEqual(feed.ids,[id]);
 const reader=env.authenticatedContext(bob).firestore();
 const result=await assertSucceeds(getDoc(doc(reader,'quartinautAudienceFeeds',bob,'items',id)));
 assert.equal('center' in result.data(),false);assert.equal('street' in result.data(),false);assert.equal('houseNumber' in result.data(),false);
 await assertFails(getDoc(doc(reader,'quartinautScopedRequests',id)));
 await assertFails(getDoc(doc(reader,'quartinautAudienceLocations',bob)));
 await assertFails(getDoc(doc(env.authenticatedContext(eve).firestore(),'quartinautAudienceFeeds',bob,'items',id)));
 await assertFails(updateDoc(doc(reader,'quartinautAudienceFeeds',bob,'items',id),{requiresLocation:false}));
 await assertFails(setDoc(doc(reader,'quartinautScopedRequests','fake'),{uid:bob,status:'offen'}));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'quartinautAudienceFeeds',bob,'items',id)));
});
test('expired grants and a changed viewer location immediately invalidate direct gets',async()=>{
 const id=await approved();await call(bob,'location.set',{center:{lat:46.95,lng:7.45}});await call(bob,'feed');
 const ref=doc(env.authenticatedContext(bob).firestore(),'quartinautAudienceFeeds',bob,'items',id);
 await call(bob,'location.set',{center:{lat:47.37,lng:8.54}});
 await assertFails(getDoc(ref));assert.deepEqual((await call(bob,'feed')).ids,[]);
 await db.collection('quartinautAudienceFeeds').doc(bob).collection('items').doc(id).update({validUntil:admin.firestore.Timestamp.fromMillis(1)});
 await assertFails(getDoc(ref));
});
test('country reaches another canton; municipality does not',async()=>{
 const id=await approved('country');assert.deepEqual((await call(eve,'feed')).ids,[id]);
 await db.collection('quartinautScopedRequests').doc(id).update({audienceLevel:'municipality',updatedAt:new Date().toISOString()});
 assert.deepEqual((await call(eve,'feed')).ids,[]);assert.deepEqual((await call(bob,'feed')).ids,[id]);
});
test('owner edit returns to moderation and invalidates a previously issued feed copy',async()=>{
 const id=await approved('country');await call(bob,'feed');
 await call(alice,'post.edit',{id,title:'Neuer Titel',description:'Ein überarbeitetes Anliegen.'});
 await assertFails(getDoc(doc(env.authenticatedContext(bob).firestore(),'quartinautAudienceFeeds',bob,'items',id)));
 assert.deepEqual((await call(bob,'feed')).ids,[]);
});
test('a changed role claim invalidates an existing recipient grant',async()=>{
 const id=await approved('country');await call(bob,'feed');
 const changed=env.authenticatedContext(bob,{role:'resident'}).firestore();
 await assertFails(getDoc(doc(changed,'quartinautAudienceFeeds',bob,'items',id)));
});
test('regional chat requires a currently visible request and honors both block directions',async()=>{
 const id=await approved();
 await assert.rejects(call(bob,'chat.start',{id}),{code:'not-found'});
 await call(bob,'location.set',{center:{lat:46.95,lng:7.45}});
 await db.collection('userBlocks').doc(alice+'_'+bob).set({blockerUid:alice,blockedUid:bob});
 await assert.rejects(call(bob,'chat.start',{id}),{code:'permission-denied'});
 await db.collection('userBlocks').doc(alice+'_'+bob).delete();
 const chat=await call(bob,'chat.start',{id});assert.ok(chat.chat.id.startsWith('chat_'+id));
});
test('legacy canton query remains valid with unchanged live rules',async()=>{
 await db.collection('requests').doc('legacy_request').set({uid:alice,tenantId:'quartinaut',cantonCode:'BE',areaKey:'bern (be)',status:'offen'});
 const legacy=query(collection(env.authenticatedContext(bob).firestore(),'requests'),where('cantonCode','==','BE'),where('status','==','offen'));
 const rows=await assertSucceeds(getDocs(legacy));assert.equal(rows.size,1);
});
