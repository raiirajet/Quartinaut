// One-shot location. Exact coordinates are used only for the optional Swiss street lookup.
// No watchPosition, address line, house number or exact position is stored.
export function streetWithoutHouseNumber(value) {
 return String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+\d+[a-z]*(?:\s*(?:[-–/])\s*\d+[a-z]*)?\s*$/i,'').trim().slice(0,140);
}
export function roundedCenter(coords) {
 const lat=Math.round(coords.latitude*100)/100,lng=Math.round(coords.longitude*100)/100;
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<45||lat>48||lng<5||lng>11)throw Error('Der Standort muss in der Schweiz liegen.');
 return {lat,lng};
}
export function determineLocation(geo=globalThis.navigator?.geolocation) {
 if(!geo)return Promise.reject(Error('Dieser Browser unterstützt keine Standortermittlung.'));
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);fn(value);};
  const timer=setTimeout(()=>finish(reject,Error('Kein Standort empfangen. Standortdienst prüfen und erneut versuchen.')),21000);
  geo.getCurrentPosition(p=>finish(resolve,p.coords),e=>finish(reject,Error(e.code===1?'Standortfreigabe abgelehnt. Bitte in den Website-Einstellungen des Browsers erlauben.':e.code===3?'Die Standortsuche hat zu lange gedauert. Bitte erneut versuchen.':'Kein Standort verfügbar. Bitte den Standortdienst prüfen.')),{enableHighAccuracy:true,timeout:20000,maximumAge:120000});
 });
}
export async function determineStreet(coords,fetcher=fetch) {
 const x=coords.longitude,y=coords.latitude;
 const params=new URLSearchParams({geometry:`${x},${y}`,geometryType:'esriGeometryPoint',tolerance:'15',layers:'all:ch.swisstopo.amtliches-strassenverzeichnis',mapExtent:`${x-.002},${y-.002},${x+.002},${y+.002}`,imageDisplay:'200,200,96',sr:'4326',returnGeometry:'false'});
 const response=await fetcher('https://api3.geo.admin.ch/rest/services/api/MapServer/identify?'+params,{signal:AbortSignal.timeout(6000),credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)return '';
 const data=await response.json();
 const attributes=data.results?.[0]?.attributes||{};
 return streetWithoutHouseNumber(attributes.stn_label||attributes.stn_name||attributes.strname||attributes.name||'');
}
export function locationControl() {
 return `<div class="qn-location"><button class="secondary-button" type="button" data-qn-locate>Standort einmalig bestimmen</button><progress hidden aria-label="Standort wird ermittelt"></progress><p role="status" aria-live="polite" data-qn-location-status>Noch kein Standort festgelegt.</p><p class="help">Nur der Straßenname wird hier angezeigt, ohne Hausnummer. Für die Straßenabfrage wird deine Position einmalig an die Schweizer Geodaten-API (geo.admin.ch) übermittelt. Firebase erhält nur einen auf etwa 1 km gerundeten Mittelpunkt.</p></div>`;
}
export function bindLocation(root,onCenter) {
 root.querySelectorAll('[data-qn-locate]').forEach(button=>button.addEventListener('click',async()=>{
  const box=button.closest('.qn-location'),status=box.querySelector('[data-qn-location-status]'),progress=box.querySelector('progress');
  button.disabled=true;progress.hidden=false;status.textContent='Standort wird ermittelt …';
  try{
   const coords=await determineLocation(),center=roundedCenter(coords);
   await onCenter(center);if(!box.isConnected)return;
   status.textContent='Standort ermittelt. Straße wird gesucht …';
   let street='';try{street=await determineStreet(coords);}catch{}
   if(!box.isConnected)return;
   status.textContent=street?`${coords.accuracy>100?'Straße in Standortnähe':'Ermittelte Straße'}: ${street} · ohne Hausnummer.`:'Standort ermittelt. Ein Straßenname ist hier nicht verfügbar.';
   if(coords.accuracy>100&&street)status.textContent+=' Der Browser meldet einen ungefähren Standort; die Straße kann abweichen.';
  }catch(e){if(box.isConnected)status.textContent=e.message;}
  finally{button.disabled=false;progress.hidden=true;}
 }));
}
