// Exercise installed 5.4.2, 5.11.4 and 5.11.5 workers upgrading at the SAME origin.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');let upgraded=false,previous='5.4.2';
 const oldFixtures={
  '5.4.2':{'/index.html':'legacy-index.html','/sw.js':'legacy-shell-sw.js','/src/v462/dashboard-background.js':'legacy-dashboard-background.js'},
  '5.11.4':{'/index.html':'previous-5114-index.html','/sw.js':'previous-5114-sw.js'},
  '5.11.5':{'/index.html':'previous-5115-index.html','/sw.js':'previous-5115-sw.js'}
 };
 const server=http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/index.html';const old=oldFixtures[previous][pathname],file=!upgraded&&old?path.join(__dirname,old):path.join(root,pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.env.CI?{}:{executablePath:'/usr/bin/chromium'}),headless:true,args:['--no-sandbox']});
 try{
  for(const version of ['5.4.2','5.11.4','5.11.5']){
   previous=version;upgraded=false;
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));page.setDefaultTimeout(30000);
   await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle'});
   assert.ok(await page.evaluate(()=>navigator.serviceWorker.controller));assert.ok((await page.evaluate(()=>caches.keys())).includes('quartinaut-shell-v'+version));
   if(version==='5.4.2'){const old=await page.evaluate(async()=>{const c=await caches.open('quartinaut-shell-v5.4.2');return (await c.match('./src/v462/dashboard-background.js')).text();});assert.equal(old.includes('configureDashboardCloud'),false);}
   upgraded=true;await page.reload({waitUntil:'networkidle'});await page.locator('#authForm').waitFor();assert.match(await page.locator('#main').innerText(),/Grüezi bei Quartinaut/);assert.equal(await page.evaluate(()=>window.QUARTINAUT_UI_RELEASE),'5.11.6');
   assert.ok((await page.locator('#main').boundingBox()).width>1300,'desktop layout must load while the previous worker still controls the page');
   await page.getByRole('button',{name:'Jetzt aktualisieren',exact:true}).waitFor();await page.getByRole('button',{name:'Jetzt aktualisieren',exact:true}).click();await page.waitForFunction(async version=>!(await caches.keys()).includes('quartinaut-shell-v'+version),version);
   await page.locator('#authForm').waitFor();assert.ok((await page.evaluate(()=>caches.keys())).includes('quartinaut-shell-v5.11.6'));assert.deepEqual(errors,[]);
   console.log('PASS installed Web '+version+' cache upgrades to Web 5.11.6 without mixing old resources');await context.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(err=>{console.error(err);process.exit(1)});
