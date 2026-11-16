import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {streetWithoutHouseNumber,roundedCenter,determineLocation,determineStreet} from '../src/native/location.mjs';
import {makeIcs} from '../src/v50-ics.mjs';
import {SECTIONS,LINKS} from '../src/native/catalog.mjs';
import {createNativeParity} from '../src/native/parity.mjs';
import {configureDashboardCloud,loadCloudDashboardPhoto,readDashboardPhoto,resetCloudDashboardPhoto,saveDashboardPhoto,clearDashboardPhoto} from '../src/v462/dashboard-background.js';

test('street display omits house numbers, suffixes, ranges and controls',()=>{
 for(const input of ['Bahnhofstrasse 12','Bahnhofstrasse 12a','Bahnhofstrasse 12bis','Bahnhofstrasse 12–14','Bahnhofstrasse 12/14','Bahnhofstrasse 12a–14b'])assert.equal(streetWithoutHouseNumber(input),'Bahnhofstrasse');
 assert.equal(streetWithoutHouseNumber('Rue du 23-Juin'),'Rue du 23-Juin');assert.equal(streetWithoutHouseNumber('Hauptstrasse\n12a'),'Hauptstrasse');
});
test('only a coarse Swiss center can leave the location control',()=>{
 assert.deepEqual(roundedCenter({latitude:47.451234,longitude:9.162345}),{lat:47.45,lng:9.16});
 for(const value of [{latitude:NaN,longitude:9},{latitude:52,longitude:9},{latitude:47,longitude:12}])assert.throws(()=>roundedCenter(value));
});
test('location permission denial is a visible actionable error',async()=>{
 await assert.rejects(determineLocation({getCurrentPosition:(ok,fail)=>fail({code:1})}),/Website-Einstellungen/);
 await assert.rejects(determineLocation({getCurrentPosition:(ok,fail)=>fail({code:3})}),/lange gedauert/);
});
test('one-shot location requires a recent fix and never starts tracking',async()=>{
 let calls=0;const coords=await determineLocation({getCurrentPosition:(ok,fail,options)=>{calls++;assert.equal(options.maximumAge,120000);assert.equal(options.timeout,20000);ok({coords:{latitude:47,longitude:9}});}});assert.equal(calls,1);assert.equal(coords.latitude,47);
});
test('reverse geocoding reads only the official street field',async()=>{
 const result=await determineStreet({latitude:47.45,longitude:9.162},async(url,options)=>{
  assert.equal(new URL(url).hostname,'api3.geo.admin.ch');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');
  return {ok:true,json:async()=>({results:[{attributes:{stn_label:'Bahnhofstrasse 12a',addressLine:'Private Adresse 100',house_number:'12a'}}]})};
 });assert.equal(result,'Bahnhofstrasse');
 assert.equal(await determineStreet({latitude:47,longitude:9},async()=>({ok:true,json:async()=>({results:[{attributes:{addressLine:'Privat 123'}}]})})), '');
});
test('official calendar exports inclusive date ranges as all-day events',()=>{
 const ics=makeIcs({id:'official_test',date:'2026-12-24',endDate:'2026-12-27',allDay:true,title:'Feiertage',description:'Quelle: https://example.invalid'},'calendar');
 assert.match(ics,/DTSTART;VALUE=DATE:20261224/);assert.match(ics,/DTEND;VALUE=DATE:20261227/);assert.doesNotMatch(ics,/T080000/);
});
test('loan calendar keeps exact UTC handover and return times',()=>{
 const ics=makeIcs({id:'loan_test',title:'Ausleihe',from:'2026-11-20T13:00:00Z',to:'2026-11-21T15:00:00Z'},'loan');assert.match(ics,/DTSTART:20261120T130000Z/);assert.match(ics,/DTEND:20261121T150000Z/);
});
test('all 47 native task links and five sections have matching web entries',async()=>{
 const source=await fs.readFile(new URL('../../app/src/main/java/ch/quartinaut/nativeapp/NativeQuartierNavigation.kt',import.meta.url),'utf8');
 const native=[...source.matchAll(/link\("([^"]+)","([^"]+)","([^"]+)","([^"]+)"\)/g)].map(x=>x[1]);
 assert.equal(SECTIONS.length,5);assert.equal(LINKS.length,47);assert.deepEqual(LINKS.map(x=>x.route),native);assert.equal(new Set(native).size,native.length);
});
test('service worker ignores private, external and authenticated API requests',async()=>{
 const handlers={},scope={registration:{scope:'https://quartinaut.web.app/'},location:{origin:'https://quartinaut.web.app'},addEventListener:(type,fn)=>handlers[type]=fn};
 vm.runInNewContext(await fs.readFile(new URL('../sw.js',import.meta.url),'utf8'),{self:scope,URL,Set});
 for(const request of [{url:'https://quartinaut.web.app/__/auth/handler',method:'GET'},{url:'https://quartinaut.web.app/api/private',method:'GET'},{url:'https://europe-west6-quartinaut.cloudfunctions.net/quartinautAudience',method:'GET'},{url:'https://quartinaut.web.app/private-photo',method:'GET'},{url:'https://quartinaut.web.app/',method:'POST'}]){let touched=false;handlers.fetch({request,respondWith:()=>touched=true});assert.equal(touched,false,request.url);}
});
function bridge(call){let user={uid:'user_a'};const regional=[];globalThis.window={addEventListener:()=>{}};globalThis.document={addEventListener:()=>{},hidden:false};return {change:uid=>user={uid},b:{auth:()=>user,escape:x=>String(x),call,schedule:()=>{},setRegional:rows=>{regional.splice(0,regional.length,...rows)},backgroundReset:()=>{},toast:()=>{},refreshBookmarks:()=>{}}};}
test('a slow favorites response cannot enter a different user session',async()=>{
 let release;const pending=new Promise(r=>release=r),{b,change}=bridge(()=>pending),client=createNativeParity(b);
 const task=client.load('favorites');change('user_b');client.reset();release({items:[{id:'private_old_user'}]});await task;assert.deepEqual(client.model.favorites,[]);
});
test('regional favorites remain available if the legacy service is unavailable',async()=>{
 const {b}=bridge(async(name)=>{if(name==='quartinautEnhancements')throw Error('legacy down');return {items:[{id:'arq_visible'}]};});const client=createNativeParity(b);await client.load('favorites');assert.deepEqual(client.model.favorites,[{id:'arq_visible'}]);
});
const storage={values:new Map(),getItem(key){return this.values.get(key)||null},setItem(key,v){this.values.set(key,v)},removeItem(key){this.values.delete(key)}};
test('late private background downloads are discarded after account change',async()=>{
 let current='user_a',release;configureDashboardCloud({currentUid:()=>current,call:()=>new Promise(r=>release=r)});resetCloudDashboardPhoto();const request=loadCloudDashboardPhoto('user_a');current='user_b';release({hasImage:true,base64:'/9j/AAAA'});await request;assert.equal(readDashboardPhoto('user_a',storage),'');
});
test('cloud background deletion must be confirmed before local content is removed',async()=>{
 resetCloudDashboardPhoto();let fail=false;const calls=[];configureDashboardCloud({currentUid:()=> 'user_a',call:async(name,d)=>{calls.push(d.action);if(fail)throw Error('offline');return {ok:true}}});const data='data:image/jpeg;base64,/9j/AAAA';await saveDashboardPhoto('user_a',data,storage);fail=true;await assert.rejects(clearDashboardPhoto('user_a',storage));assert.equal(readDashboardPhoto('user_a',storage),data);fail=false;await clearDashboardPhoto('user_a',storage);assert.equal(readDashboardPhoto('user_a',storage),'');assert.deepEqual(calls,['save','remove','remove']);
});
