// Reproduces an installed Web 5.4.2 cache, then serves the new release at the SAME origin.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');let upgraded=false;
 const legacy={'/index.html':'legacy-index.html','/sw.js':'legacy-shell-sw.js','/src/v462/dashboard-background.js':'legacy-dashboard-background.js'};
 const server=http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/index.html';const file=!upgraded&&legacy[pathname]?path.join(__dirname,legacy[pathname]):path.join(root,pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.env.CI?{}:{executablePath:'/usr/bin/chromium'}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:390,height:844}}),errors=[];page.on('pageerror',err=>errors.push(err.message));page.setDefaultTimeout(30000);
 try{
  await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle'});
  assert.ok(await page.evaluate(()=>navigator.serviceWorker.controller));assert.ok((await page.evaluate(()=>caches.keys())).includes('quartinaut-shell-v5.4.2'));
  const old=await page.evaluate(async()=>{const c=await caches.open('quartinaut-shell-v5.4.2');return (await c.match('./src/v462/dashboard-background.js')).text();});assert.equal(old.includes('configureDashboardCloud'),false);
  upgraded=true;await page.reload({waitUntil:'networkidle'});await page.locator('#authForm').waitFor();assert.match(await page.locator('#main').innerText(),/Grüezi bei Quartinaut/);assert.equal(await page.evaluate(()=>window.QUARTINAUT_UI_RELEASE),'5.11.4');
  await page.getByRole('button',{name:'Jetzt aktualisieren',exact:true}).waitFor();await page.getByRole('button',{name:'Jetzt aktualisieren',exact:true}).click();await page.waitForFunction(async()=>!(await caches.keys()).includes('quartinaut-shell-v5.4.2'));
  await page.locator('#authForm').waitFor();assert.ok((await page.evaluate(()=>caches.keys())).includes('quartinaut-shell-v5.11.4'));assert.deepEqual(errors,[]);
  console.log('PASS installed Web 5.4.2 cache upgrades to 5.11.4 without mixing old module exports');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(err=>{console.error(err);process.exit(1)});
