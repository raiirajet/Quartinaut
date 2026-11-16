// UI audit of every catalog destination, secondary page and form. Authentication is intercepted ONLY in this test.
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const baseFixture=require('./fixtures.cjs');
const origin=process.env.QUARTINAUT_TEST_ORIGIN||'http://127.0.0.1:5114';
const output=process.env.QUARTINAUT_REVIEW_OUTPUT||path.resolve(__dirname,'../../artifacts/site-review');
const baseline=process.argv.includes('--baseline');
const release=process.env.QUARTINAUT_REVIEW_RELEASE||'5116';
const hooks=String.raw`
window.__review={
 direct:route=>setRoute(route),
 role:role=>{authState.user.role=role;state.profile.role=role;authState.user.adminScopeArea=state.profile.area;render();},
 panel:id=>{const p=document.getElementById(id);if(p){p.open=true;openSingleSettingsPanel(p);}},
 panels:()=>[...document.querySelectorAll('.v41-setting')].map(x=>({id:x.id,label:x.querySelector('summary')?.textContent})),
 modal:id=>({name:requestNameChangeModal,location:requestLocationChangeModal,verification:requestVerificationModal,help:openHelpModal,notice:newOfficialNoticeModal,alert:newAlertModal,event:openCommunityEventModal,series:openHubSeries,keyword:openNotificationKeywordModal,privacy:()=>openLegalModal('privacy'),terms:()=>openLegalModal('terms'),imprint:()=>openLegalModal('imprint')})[id]?.(),
 close:()=>{document.querySelectorAll('.modal-backdrop [data-close-modal]').forEach(x=>x.click());},
 auth:mode=>{authMode=mode;authState={ready:true,mode:'firebase',user:null,error:''};render();},
 gate:type=>{authState={ready:true,mode:'firebase',user:{uid:fixtureUid,email:'review@example.invalid',role:'resident',accountType:'resident',accountStatus:type==='disabled'?'disabled':type==='pending'?'pending_verification':'active'},error:'',...(type==='verify'?{verifyPending:{email:'review@example.invalid'}}:{})};state.profile.accountStatus=authState.user.accountStatus;render();}
};
// Realistic long public copy and all listing categories, without contacting production services.
for(const kind of ['lend','lost','group','project','issue','calendar'])hubState.items.push({...fixtureItems[0],id:kind+'_review_fixture_001',kind,title:({lend:'Bohrmaschine für dein nächstes Projekt',lost:'Schlüsselbund beim Dorfplatz gefunden',group:'Nachbarschaftsverein Oberbüren',project:'Gemeinsam den Quartiergarten pflegen',issue:'Defekte Strassenbeleuchtung beim Gemeindehaus',calendar:'Gemeindefest und gemeinsames Abendessen'})[kind],description:'Eine ausführliche Beschreibung mit praktischen Hinweisen für Nachbarinnen und Nachbarn. '+('https://example.invalid/'+ 'information'.repeat(18)),category:'Allgemein',capacity:20,startsAt:'2026-11-25T16:00:00Z'});
state.officialNotices=[{id:'notice_review_0001',title:'Gemeindeverwaltung: Öffnungszeiten über die Feiertage',text:'Bitte beachte die angepassten Öffnungszeiten. Weitere Informationen erhältst du direkt bei der Gemeinde.',status:'online',category:'Verwaltung',priority:'info',area:state.profile.area,areaKey:state.profile.areaKey,cantonCode:'SG',scopeLevel:'municipality',createdAt:new Date().toISOString()}];
state.alerts=[{id:'alert_review_0001',title:'Verkehrshinweis für das Quartier',text:'Die Zufahrt zum Gemeindehaus ist vorübergehend eingeschränkt.',status:'active',area:state.profile.area,areaKey:state.profile.areaKey,cantonCode:'SG',severity:'info',scopeLevel:'municipality',createdAt:new Date().toISOString(),validUntil:new Date(Date.now()+86400000).toISOString()}];
state.registeredUsers=[{uid:fixtureUid,email:'review@example.invalid',displayName:'Testperson mit ausführlichem Anzeigenamen',area:state.profile.area,cantonCode:'SG',role:'resident',accountType:'resident',accountStatus:'active',verified:true,createdAt:new Date().toISOString()}];
window.__review.role('resident');
`;
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.env.CI?{}:{executablePath:'/usr/bin/chromium'}),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));page.setDefaultTimeout(12000);
 await context.route('**/app-release-'+release+'.js',async route=>{const source=await fs.readFile(path.join(__dirname,'../app-release-'+release+'.js'),'utf8');await route.fulfill({contentType:'text/javascript',body:source.replace('void initAuth();',baseFixture+hooks)});});
 await page.goto(origin,{waitUntil:'networkidle'});
 const {LINKS}=await import('../src/native/catalog.mjs');
 const extra=['home','hub','profile','events','inbox','bulletin','alarme','saved','drafts','swissmap','personal-center','community-pulse','calendar-planner','safety-center','settings','sources','diagnostics','enh-assist','enh-radar','enh-posts','enh-favorites','enh-qr','enh-trust','enh-offline','municipal-compare','official-calendar','hub-section:entdecken','hub-section:erstellen','hub-section:meine','hub-section:gemeinde','hub-section:sicherheit'];
 const cases=[...new Set([...extra,...LINKS.map(x=>x.route)])].map(route=>({id:route,open:()=>page.evaluate(route=>window.__go(route),route)}));
 const rows=[];
 async function measure(item,{axe=true,screenshot=false}={}){
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
  const metrics=await page.evaluate(()=>{
   const visible=el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length&&!el.closest('[hidden],[inert],[aria-hidden="true"]');};
   const modal=document.querySelector('.modal-backdrop .modal-card'),root=modal||document.querySelector('#main');
   const fields=[...root.querySelectorAll('input,select,textarea')].filter(el=>visible(el)&&el.type!=='hidden');
   const unnamed=fields.filter(el=>!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!['submit','button','reset'].includes(el.type)).map(el=>({tag:el.tagName,id:el.id,name:el.name,placeholder:el.placeholder}));
   const over=[...root.querySelectorAll('input,select,textarea,button,form,.qn-panel,.card,.qn-tile,.v50-panel,.v50-card')].filter(visible).map(el=>({el,rect:el.getBoundingClientRect()})).filter(({el,rect})=>{if(el.closest('.table-wrap,.v54-canvas,.v50-grid'))return false;const host=modal?modal.getBoundingClientRect():{left:0,right:innerWidth};return rect.left<host.left-1||rect.right>host.right+1;}).slice(0,12).map(({el,rect})=>({tag:el.tagName,id:el.id,cls:el.className,text:(el.textContent||el.name||'').trim().slice(0,100),width:Math.round(rect.width)}));
   const ids=[...document.querySelectorAll('[id]')].filter(visible).map(el=>el.id),duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
   return {route:document.body.dataset.qnRoute,viewport:innerWidth,modal:!!modal,title:document.title,headings:[...root.querySelectorAll('h1,h2,h3')].filter(visible).slice(0,15).map(el=>({level:el.tagName,text:el.textContent.trim()})),h1Count:[...root.querySelectorAll('h1')].filter(visible).length,fields:fields.length,unnamed,overflow:document.documentElement.scrollWidth>innerWidth,outside:over,duplicateIds,text:root.innerText.slice(0,500)};
  });
  let violations=[];
  if(axe){try{const result=await new AxeBuilder({page}).include(metrics.modal?'.modal-backdrop .modal-card':'#app').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();violations=result.violations.map(x=>({id:x.id,impact:x.impact,description:x.description,nodes:x.nodes.slice(0,8).map(n=>({target:n.target,html:n.html.slice(0,260),summary:n.failureSummary}))}));}catch(err){violations=[{id:'scan-error',description:err.message}];}}
  const row={id:item.id,...metrics,violations};rows.push(row);
  if(screenshot||metrics.overflow||metrics.unnamed.length||metrics.h1Count!==1&&!metrics.modal||violations.length)await page.screenshot({path:path.join(output,item.id.replace(/[^a-z0-9_-]/gi,'-')+'-'+metrics.viewport+'.png'),fullPage:true});
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify({baseline,rows,errors},null,2));
 }
 for(const item of cases){
  await page.evaluate(()=>window.__review.close());await page.setViewportSize({width:1440,height:1000});
  try{await item.open();await page.waitForTimeout(110);await measure(item,{screenshot:['home','settings','enh-qr','enh-assist','calendar','v50loans','v50market','personal-center','community-pulse'].includes(item.id)});
   await page.setViewportSize({width:390,height:844});await measure(item,{axe:true});
  }catch(err){rows.push({id:item.id,error:err.message});await fs.writeFile(path.join(output,'results.json'),JSON.stringify({baseline,rows,errors},null,2));}
 }
 // Every request wizard step, including required text, preview and consent fields.
 for(const route of ['create-request','create-offer']){
  await page.evaluate(()=>window.__review.close());await page.setViewportSize({width:1440,height:1000});await page.evaluate(r=>window.__go(r),route);
  await page.getByRole('button',{name:'Entwurf verwerfen',exact:true}).click();
  for(const step of [1,2]){
   if(step===1)await page.getByRole('button',{name:'Weiter · Beschreibung',exact:true}).click();
   else{await page.locator('#requestForm [name="title"]').fill('Gemeinsam einen Quartiergarten gestalten');await page.locator('#requestForm [name="text"]').fill('Wir suchen Unterstützung beim Aufbau eines gemeinsamen Gartens und freuen uns auf deine Nachricht.');await page.getByRole('button',{name:'Weiter · Vorschau',exact:true}).click();}
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await measure({id:route+':step-'+(step+1)},{screenshot:true});}
  }
 }
 // The shared card, form, map and settings styles in every supported colour theme.
 const themed=['home','hub','settings','profile','inbox','search','community-pulse','market','v50loans','v50associations','v50market','enh-qr','enh-assist','official-calendar','municipal-compare','swissmap','sources','create-request','hub-create:market'];
 for(const theme of ['green','dark','red']){
  await page.evaluate(()=>window.__review.close());await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.__go('settings'));await page.locator('#qn-theme').selectOption(theme);
  for(const route of themed){await page.evaluate(()=>window.__review.close());await page.evaluate(r=>window.__go(r),route);await page.waitForTimeout(80);await measure({id:theme+':'+route},{screenshot:['home','settings','v50loans','create-request'].includes(route)});}
 }
 await page.evaluate(()=>window.__review.close());await page.evaluate(()=>window.__go('settings'));await page.locator('#qn-theme').selectOption('light');
 for(const modal of ['name','location','verification','help','privacy','terms','imprint','keyword']){
  await page.evaluate(()=>window.__review.close());await page.setViewportSize({width:1440,height:1000});
  try{await page.evaluate(id=>window.__review.modal(id),modal);await page.waitForTimeout(80);await measure({id:'modal:'+modal});await page.setViewportSize({width:390,height:844});await measure({id:'modal:'+modal},{axe:false});}catch(err){rows.push({id:'modal:'+modal,error:err.message});}
 }
 await page.evaluate(()=>{window.__review.close();window.__review.role('admin');window.__review.direct('profile');});
 const panels=await page.evaluate(()=>window.__review.panels());
 for(const panel of panels){
  if(!panel.id)continue;
  try{await page.setViewportSize({width:1440,height:1000});await page.evaluate(id=>window.__review.panel(id),panel.id);await page.waitForTimeout(40);await measure({id:'admin:'+panel.id});await page.setViewportSize({width:390,height:844});await measure({id:'admin:'+panel.id},{axe:false});}catch(err){rows.push({id:'admin:'+panel.id,error:err.message});}
 }
 for(const modal of ['notice','alert','event','series']){
  await page.evaluate(()=>window.__review.close());await page.setViewportSize({width:1440,height:1000});
  try{await page.evaluate(id=>window.__review.modal(id),modal);await page.waitForTimeout(80);await measure({id:'modal:'+modal});await page.setViewportSize({width:390,height:844});await measure({id:'modal:'+modal},{axe:false});}catch(err){rows.push({id:'modal:'+modal,error:err.message});}
 }
 await page.evaluate(()=>window.__review.close());
 for(const mode of ['login','register']){await page.evaluate(mode=>window.__review.auth(mode),mode);for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await measure({id:'auth:'+mode},{axe:true,screenshot:true});}}
 for(const type of ['verify','pending','disabled']){await page.evaluate(type=>window.__review.gate(type),type);await page.setViewportSize({width:390,height:844});await measure({id:'gate:'+type},{axe:true});}
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({baseline,rows,errors},null,2));
 const failed=rows.filter(x=>x.error||x.overflow||x.outside?.length||x.unnamed?.length||x.duplicateIds?.length||x.violations?.length||(!x.modal&&x.h1Count!==1));
 console.log(JSON.stringify({destinations:cases.length,settingsPanels:panels.length,views:rows.length,problemViews:failed.length,pageErrors:[...new Set(errors)],output}));
 await browser.close();if(!baseline)assert.equal(failed.length+errors.length,0,'Site review violations; see results.json');
})().catch(err=>{console.error(err);process.exit(1)});
