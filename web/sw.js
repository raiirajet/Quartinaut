/* Quartinaut 4.6.2 — fast public shell; never cache Firebase, private or authenticated data. */
const VERSION = 'quartinaut-shell-v5.11.5';
const ASSETS = [
  './','./index.html','./offline.html','./quartinaut-bundle-50.css','./quartinaut-v53.css','./quartinaut-v54.css',


  './app-release-5115.js','./quartinaut-desktop-5115.css','./quartinaut-native-5114.css','./src/native/parity.mjs','./src/native/catalog.mjs','./src/native/location.mjs','./assets/native/qt3d_atlas_safe.webp','./assets/native/icon-192.png','./assets/native/icon-512.png','./assets/native/quartinaut-brand.svg','./assets/native/coats-index.js','./assets/native/public-manifest.json','./assets/native/official_calendar_ch_2026_2030.json','./assets/native/municipal_calendar_verified_sg.json','./assets/native/municipality_2025.geojson','./vendor/qrcode-1.4.4.js','./theme-bootstrap.js','./firebase-config.js','./manifest.webmanifest',
  './src/v2/preferences.js','./src/v2/wizard.js','./src/v2/pwa-updates.js',
  './src/v3/community.js','./src/v46/features.js','./src/v462/dashboard-background.js','./src/v47/dashboard-editor.js','./src/v47/sync.js','./src/v48/accessibility.js','./src/v50-ics.mjs','./src/v53/presentation.mjs','./src/v54/presentation.mjs','./src/v54/swiss-map.mjs','./src/v54/wappen.mjs','./assets/icons/quartinaut-logo.svg',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './assets/icons/navigation/start.png','./assets/icons/navigation/quartier.png',
  './assets/icons/navigation/neu.png','./assets/icons/navigation/chats.png',
  './assets/icons/navigation/profil.png'
];
const SHELL_PATHS = new Set(ASSETS.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  await Promise.all((await caches.keys())
    .filter(name => name.startsWith('quartinaut-shell-') && name !== VERSION)
    .map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Firebase Auth helper and dynamic resources must always go directly to network.
  if (url.pathname.startsWith('/__/') || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match('./index.html');
      const live = fetch(request).then(async response => {
        if (response.ok && response.type === 'basic') await cache.put('./index.html', response.clone());
        return response;
      });
      return live.catch(async () => cached || cache.match('./offline.html') || Response.error());
    })());
    return;
  }
  // Cache-first only for the known, public, versioned application files.
  if(url.pathname.startsWith('/assets/native/')){event.respondWith((async()=>{const cache=await caches.open('quartinaut-public-data-v5114');const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok&&response.type==='basic')await cache.put(request,response.clone());return response;})());return;}
  if (!SHELL_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});
