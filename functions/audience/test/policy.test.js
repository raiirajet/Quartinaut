'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const p=require('../policy');
const profile={accountStatus:'active',area:'Bern (BE)',areaKey:'bern (be)',cantonCode:'BE'};
const at=Date.now();
const source={tenantId:'quartinaut',uid:'owner_user',status:'offen',audienceLevel:'municipality',
 area:profile.area,areaKey:profile.areaKey,cantonCode:'BE',expiresAt:new Date(at+60000).toISOString(),
 center:{lat:46.95,lng:7.45},radiusKm:5,title:'Nachbarschaftshilfe',text:'Bitte helfen',photoPaths:[]};
const ctx=(change={})=>({uid:'viewer_user',profile,claims:{},...change});
const input={title:'Bitte helfen',text:'Ich suche Nachbarschaftshilfe.',category:'Alltagshilfe',type:'Suche',
 urgency:'Heute',audienceLevel:'radius',radiusKm:5,center:source.center,photoPaths:[]};
test('municipality does not leak to another municipality in the same canton',()=>{
 assert.equal(p.canView(source,ctx(),at),true);
 assert.equal(p.canView(source,ctx({profile:{...profile,areaKey:'thun (be)',area:'Thun (BE)'}}),at),false);
});
test('country works across cantons while canton stays regional',()=>{
 const other=ctx({profile:{...profile,cantonCode:'ZH',areaKey:'zurich (zh)'}});
 assert.equal(p.canView({...source,audienceLevel:'country'},other,at),true);
 assert.equal(p.canView({...source,audienceLevel:'canton'},other,at),false);
});
test('radius requires a fresh private viewer location and enforces actual distance',()=>{
 const post={...source,audienceLevel:'radius'};
 assert.equal(p.canView(post,ctx(),at),false);
 const location={center:{lat:46.96,lng:7.45},validUntil:{toMillis:()=>at+60000}};
 assert.equal(p.canView(post,ctx({location}),at),true);
 assert.equal(p.canView(post,ctx({location:{...location,center:{lat:47.37,lng:8.54}}}),at),false);
 assert.equal(p.canView(post,ctx({location:{...location,validUntil:{toMillis:()=>at-1}}}),at),false);
});
test('owner can review pending content; another resident cannot',()=>{
 const post={...source,status:'wartet_freigabe'};
 assert.equal(p.canView(post,ctx(),at),false);
 assert.equal(p.canView(post,ctx({uid:'owner_user'}),at),true);
});
test('disabled accounts and foreign tenants are denied including owners',()=>{
 assert.equal(p.canView(source,ctx({uid:'owner_user',profile:{...profile,accountStatus:'disabled'}}),at),false);
 assert.equal(p.canView({...source,tenantId:'other'},ctx({uid:'owner_user'}),at),false);
});
test('area admin is restricted to the granted area',()=>{
 assert.equal(p.moderator(ctx({claims:{role:'area_admin',adminScopeArea:'Thun (BE)'}}),source),false);
 assert.equal(p.moderator(ctx({claims:{role:'area_admin',adminScopeArea:'Bern (BE)'}}),source),true);
});
test('precise or corrupt coordinates and unsupported radii are rejected',()=>{
 assert.throws(()=>p.validateCreate({...input,center:{lat:46.95123,lng:7.45}},profile,'owner_user'));
 assert.throws(()=>p.validateCreate({...input,center:{lat:NaN,lng:7.45}},profile,'owner_user'));
 assert.throws(()=>p.validateCreate({...input,radiusKm:500},profile,'owner_user'));
});
test('street, house number, forged owner and arbitrary fields cannot enter source schema',()=>{
 for(const key of ['street','houseNumber','address','uid','status','isAdmin'])
  assert.throws(()=>p.validateCreate({...input,[key]:'injected'},profile,'owner_user'));
});
test('foreign photo paths and oversized bodies are rejected',()=>{
 assert.throws(()=>p.validateCreate({...input,photoPaths:['post-photos/requests/other_user/operation123/0.jpg']},profile,'owner_user'));
 assert.throws(()=>p.validateCreate({...input,text:'x'.repeat(1201)},profile,'owner_user'));
});
test('public projection never contains position, street, full address or operation metadata',()=>{
 const projected=p.publicFields('id',{...source,street:'secret',houseNumber:'12',operationHash:'private'});
 for(const key of ['center','latitude','longitude','street','houseNumber','address','operationHash'])assert.equal(key in projected,false);
});
