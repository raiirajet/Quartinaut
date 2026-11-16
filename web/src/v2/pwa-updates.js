// PWA-Versionsverwaltung: kein manueller Cache-Reset, kein Reload bei ungespeicherten Eingaben.
const PWA_RELEASE='5.11.5';
let acceptedUpdate=false;
function banner(message, action, handler) {
  let host=document.getElementById('v2UpdateBanner');
  if (!host) {
    host=document.createElement('div'); host.id='v2UpdateBanner';
    host.className='v2-update-banner'; host.setAttribute('role','status');
    document.querySelector('.topbar')?.after(host);
  }
  host.replaceChildren();
  const span=document.createElement('span'); span.textContent=message;host.append(span);
  if (action) {const button=document.createElement('button');button.type='button';button.textContent=action;button.className='secondary-button small';button.addEventListener('click',handler);host.append(button);}
}
export function setupConnectivity() {
  const host=document.getElementById('v2Connectivity');if(!host)return;
  const refresh=()=>{host.hidden=navigator.onLine;host.textContent=navigator.onLine?'':'Offline: Bereits geladene Inhalte sind eventuell noch verfügbar. Senden benötigt Internet.';};
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);refresh();
}
export async function setupPwaUpdates() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  let registration;
  try { registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}); }
  catch (error) { console.warn('[Quartinaut] Service Worker nicht verfügbar',error);return; }
  if(!registration)return;
  const offerUpdate=() => {
    if (!registration.waiting || !navigator.serviceWorker.controller) return;
    banner('Eine neue Quartinaut-Version ist bereit.','Jetzt aktualisieren', () => {
      const editing=!!document.querySelector('.modal-backdrop form') || !!document.querySelector('form:focus-within');
      if (editing && !window.confirm('Ein Formular ist geöffnet. Ungespeicherte Eingaben könnten verloren gehen. Trotzdem aktualisieren?')) return;
      acceptedUpdate=true;
      registration.waiting?.postMessage({type:'SKIP_WAITING'});
    });
  };
  if(registration.waiting)offerUpdate();
  registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();});
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(acceptedUpdate) location.reload();});
  // Regelmässig nur bei App-Rückkehr prüfen, nicht im Hintergrund pollen.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)registration.update().catch(()=>{});});
  window.addEventListener('online',()=>registration.update().catch(()=>{}));
  window.QUARTINAUT_UI_RELEASE=PWA_RELEASE;
}
