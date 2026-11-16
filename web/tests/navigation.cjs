// Actual bundled UI; isolated account/API fixtures and no production writes.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QUARTINAUT_TEST_ORIGIN||'http://127.0.0.1:5114';
const fixture=require('./fixtures.cjs').replace(" if(data.action==='create')"," if(window.__holdPost&&name==='quartinautAudience'&&data.action==='create')return new Promise(resolve=>window.__releasePost=()=>{window.__holdPost=false;resolve({data:{id:'arq_delayed_fixture_001',status:'wartet_freigabe'}});});\n if(window.__holdChat&&['start','chat.start'].includes(data.action))return new Promise(resolve=>window.__releaseChat=()=>{window.__holdChat=false;resolve({data:{chat:{id:fixtureChat.id}}});});\n if(data.action==='create')");
const hooks=String.raw`
window.__render=options=>render(options);
window.__defer=()=>viewSession.pending;
window.__seed=()=>{for(const kind of ['market','lend'])for(let i=0;i<35;i++)hubState.items.push({...fixtureItems[0],id:kind+'_nav_'+i,kind,title:kind+' Eintrag '+i,description:'Ein ausführlicher Testbeitrag für eine lange Liste. '.repeat(5),availability:'available'});};
`;
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.env.CI?{}:{executablePath:'/usr/bin/chromium'}),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await context.route('**/app-release-5117.js',async route=>{const source=await fs.readFile(path.join(__dirname,'../app-release-5117.js'),'utf8');await route.fulfill({contentType:'text/javascript',body:source.replace('void initAuth();',fixture+hooks)});});
 const tests=[];async function check(name,run){await run();tests.push(name);console.log('PASS '+name);}
 const go=async r=>{await page.evaluate(route=>window.__go(route),r);await page.waitForTimeout(120);};
 const scroll=async y=>{await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(50);return page.evaluate(()=>scrollY);};
 const sameHeight=async y=>{await page.waitForTimeout(200);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y)<3,'Scroll must stay at '+y+'; actual '+await page.evaluate(()=>scrollY));};
 try{
 await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>window.__seed());
 await check('browser Back restores the exact previous page height on desktop and mobile',async()=>{
  for(const width of [1440,390]){await page.setViewportSize({width,height:844});await go('home');const y=await scroll(820);assert.ok(y>200);await go('settings');await page.goBack();await page.getByRole('heading',{name:'Grüezi, Test!'}).waitFor();await sameHeight(y);}
 });
 await check('a queued restoration never overrides scrolling performed after rendering',async()=>{
  await go('market');const old=await scroll(900);
  const actual=await page.evaluate(()=>{window.__render({force:true});document.dispatchEvent(new WheelEvent('wheel',{deltaY:400,bubbles:true}));window.scrollTo({top:1500,behavior:'instant'});return scrollY;});
  assert.ok(actual>old);await sameHeight(actual);
 });
 await check('hub submenus have distinct history and restore list height',async()=>{
  await go('market');const y=await scroll(1400);assert.ok(y>1000);assert.equal(new URL(page.url()).searchParams.get('section'),'market');await go('lend');assert.equal(new URL(page.url()).searchParams.get('section'),'lend');await page.goBack();await page.waitForFunction(()=>new URL(location.href).searchParams.get('section')==='market');await sameHeight(y);assert.match(await page.locator('#main h1').innerText(),/Marktplatz/);
 });
 await check('menu filters survive returning from another menu',async()=>{
  await go('hub');await page.locator('#qn-catalog-search').fill('Radar');await go('settings');await page.goBack();assert.equal(await page.locator('#qn-catalog-search').inputValue(),'Radar');assert.equal(await page.locator('.qn-catalog').isVisible(),false);assert.match(await page.locator('#qn-catalog-matches').innerText(),/Quartinaut Radar/);
 });
 await check('a background update never replaces the active editor or moves its caret',async()=>{
  await go('enh-assist');const field=page.locator('#qn-assist textarea');await field.fill('Mein ungespeicherter Text bleibt stehen, auch wenn neue Daten eintreffen.');await field.focus();await page.evaluate(()=>{window.__editing=document.querySelector('#qn-assist textarea');window.__editing.setSelectionRange(7,19);window.__render();});
  assert.equal(await page.evaluate(()=>window.__editing===document.querySelector('#qn-assist textarea')),true);assert.equal(await page.evaluate(()=>document.activeElement.selectionStart),7);assert.equal(await page.evaluate(()=>window.__defer()),true);
  await page.getByRole('button',{name:'Ansicht aktualisieren',exact:true}).click();assert.equal(await field.inputValue(),'Mein ungespeicherter Text bleibt stehen, auch wenn neue Daten eintreffen.');assert.equal(await page.locator('#qn-view-update').count(),0);
 });
 await check('visibility and connectivity events preserve menu and form without a document reload',async()=>{
  await go('enh-assist');await page.locator('#qn-assist textarea').fill('Ein weiterer Entwurf bleibt unverändert.');await page.evaluate(()=>{window.__document=document;window.__field=document.querySelector('#qn-assist textarea');document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('offline'));});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.__document===document&&window.__field===document.querySelector('#qn-assist textarea')),true);assert.equal(await page.locator('#qn-assist textarea').inputValue(),'Ein weiterer Entwurf bleibt unverändert.');
 });
 await check('forced access revalidation keeps the chat draft and selected image',async()=>{
  await go('chats');await page.locator('[data-qn-chat]').first().click();await page.locator('#qn-chat-send').waitFor();await page.locator('#qn-chat-send textarea').fill('Bitte diesen Nachrichtenentwurf nicht verlieren.');
  await page.locator('#qn-chat-send input[type=file]').setInputFiles({name:'navigation.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
  await page.evaluate(()=>window.__render({force:true}));assert.equal(await page.locator('#qn-chat-send textarea').inputValue(),'Bitte diesen Nachrichtenentwurf nicht verlieren.');assert.equal(await page.locator('#qn-chat-send input[type=file]').evaluate(el=>el.files[0]?.name),'navigation.png');
 });
 await check('map drill-down survives a view refresh and browser Back',async()=>{
  await go('swissmap');await page.locator('.v54-canvas svg [data-code="SG"]').waitFor();await page.locator('.v54-canvas svg [data-code="SG"]').click();await page.locator('[data-v54-municipality="3424"]').click();await page.evaluate(()=>window.__render({force:true}));await page.getByRole('heading',{name:'Oberbüren',exact:true}).waitFor();await go('settings');await page.goBack();await page.getByRole('heading',{name:'Oberbüren',exact:true}).waitFor();
 });
 await check('closing a modal returns to the same page height',async()=>{
  await go('market');const y=await scroll(1200);await go('create-request');await page.locator('.modal-backdrop [data-close-modal]').click();await sameHeight(y);
 });
 await check('a late chat response cannot take over another menu',async()=>{
  await page.evaluate(()=>{window.__holdChat=true;window.__model().requestId=window.__request.id;window.__model().chatId='';});await go('qn-request');await page.locator('[data-action="open-chat"]').first().click();await page.waitForFunction(()=>!!window.__releaseChat);await go('settings');await page.evaluate(()=>window.__releaseChat());await page.waitForTimeout(250);assert.equal(await page.locator('#main h1').innerText(),'Einstellungen');
 });
 await check('a completed background submission cannot reopen the feed after leaving its form',async()=>{
  await go('create-request');await page.getByRole('button',{name:'Entwurf verwerfen',exact:true}).click();await page.locator('[name="audienceLevel"]').selectOption('municipality');await page.getByRole('button',{name:'Weiter · Beschreibung',exact:true}).click();await page.locator('#requestForm [name="title"]').fill('Eine asynchrone Anfrage im Quartier');await page.locator('#requestForm [name="text"]').fill('Dieser Text dient der Prüfung einer verzögerten Antwort.');await page.getByRole('button',{name:'Weiter · Vorschau',exact:true}).click();await page.locator('[name="publicationConfirmed"]').check();await page.evaluate(()=>window.__holdPost=true);await page.locator('#requestForm button[type=submit]').click();await page.waitForFunction(()=>!!window.__releasePost);await page.locator('.modal-backdrop [data-close-modal]').click();await go('settings');await page.evaluate(()=>window.__releasePost());await page.waitForTimeout(400);assert.equal(await page.locator('#main h1').innerText(),'Einstellungen');
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:tests.length,tests,pageErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
