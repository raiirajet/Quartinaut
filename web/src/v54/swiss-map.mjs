import {cantonCoat,municipalityCoat,loadMunicipalityCoats,commonsCoatUrl} from './wappen.mjs';
/* Quartinaut 5.4: öffentliche Schweizkarte, ohne Schreibzugriff auf Firebase.
 * Gemeinde-Namen/BFS: bestehendes Quartinaut-Verzeichnis 05.11.2026.
 * Gemeindegrenzen: öffentliches BFS-GeoJSON Stand 01.01.2025, separat bezeichnet.
 */
const SVG_NS='http://www.w3.org/2000/svg';
const CAPITALS={"ZH": "Zürich", "BE": "Bern", "LU": "Luzern", "UR": "Altdorf", "SZ": "Schwyz", "OW": "Sarnen", "NW": "Stans", "GL": "Glarus", "ZG": "Zug", "FR": "Freiburg / Fribourg", "SO": "Solothurn", "BS": "Basel", "BL": "Liestal", "SH": "Schaffhausen", "AR": "Herisau", "AI": "Appenzell", "SG": "St. Gallen", "GR": "Chur", "AG": "Aarau", "TG": "Frauenfeld", "TI": "Bellinzona", "VD": "Lausanne", "VS": "Sitten / Sion", "NE": "Neuenburg / Neuchâtel", "GE": "Genf / Genève", "JU": "Delsberg / Delémont"};
export const GEO_SOURCE={
  url:'https://cdn.jsdelivr.net/gh/samkhavandi/Swiss_Geography_Look_Ups@main/geometries/municipality_2025.geojson',
  alternate:'https://raw.githubusercontent.com/samkhavandi/Swiss_Geography_Look_Ups/main/geometries/municipality_2025.geojson',
  info:'https://www.agvchapp.bfs.admin.ch/de/boundaries',
  date:'2025-01-01'
};
let boundaryCache=null,boundaryPending=null;
const escapeText=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function searchKey(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
export function geoId(feature){const p=feature?.properties||{};return String(p.bfs_nr??p.BFS_NR??p.BFS_Nummer??p.bfsCode??feature?.id??'').replace(/\.0$/,'').trim();}
export function cantonFeatures(collection,municipalities){const ids=new Set(municipalities.map(m=>String(m.bfsCode)));return (collection?.features||[]).filter(f=>ids.has(geoId(f))&&['Polygon','MultiPolygon'].includes(f?.geometry?.type));}
export function geometryRings(geom){if(geom?.type==='Polygon')return geom.coordinates||[];if(geom?.type==='MultiPolygon')return (geom.coordinates||[]).flatMap(p=>p||[]);return [];}
/** Position inside a polygon; use the largest outer ring and an interior scan-line.
 * The returned geometry is display-only and never changes the administrative IDs.
 */
export function polygonLabelPoint(rings){
  if(!rings?.length)return null;
  const clean=rings.map(r=>r.filter(p=>Number.isFinite(p?.[0])&&Number.isFinite(p?.[1]))).filter(r=>r.length>=3);
  if(!clean.length)return null;
  const area=r=>Math.abs(r.reduce((a,p,i)=>{const n=r[(i+1)%r.length];return a+p[0]*n[1]-n[0]*p[1];},0))/2;
  const ring=clean.reduce((a,b)=>area(a)>=area(b)?a:b);
  const xs=ring.map(x=>x[0]),ys=ring.map(x=>x[1]);
  const box={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  if(!box.width||!box.height)return null;
  // A horizontal scanline is more reliable than the centroid for concave polygons.
  for(const y of [box.y+box.height*.5,box.y+box.height*.35,box.y+box.height*.65]){
    const cuts=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    cuts.sort((a,b)=>a-b);
    const spans=[];for(let i=0;i+1<cuts.length;i+=2)spans.push([cuts[i],cuts[i+1]]);
    if(spans.length){const widest=spans.reduce((a,b)=>a[1]-a[0]>=b[1]-b[0]?a:b);return {...box,cx:(widest[0]+widest[1])/2,cy:y,usableWidth:widest[1]-widest[0],area:area(ring)};}
  }
  return {...box,cx:box.x+box.width/2,cy:box.y+box.height/2,usableWidth:box.width,area:area(ring)};
}
export function cantonPaths(features,width=960,height=600){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,sumLat=0,count=0;
  for(const f of features)for(const ring of geometryRings(f.geometry))for(const p of ring){
    if(!Array.isArray(p)||!Number.isFinite(+p[0])||!Number.isFinite(+p[1]))continue;
    sumLat+=+p[1];count++;
  }
  if(!count)return [];
  const factor=Math.cos(sumLat/count*Math.PI/180);
  for(const f of features)for(const ring of geometryRings(f.geometry))for(const p of ring){
    if(!Array.isArray(p)||!Number.isFinite(+p[0])||!Number.isFinite(+p[1]))continue;
    const x=(+p[0])*factor,y=-(+p[1]);
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  const dx=Math.max(0.001,maxX-minX),dy=Math.max(0.001,maxY-minY),s=Math.min((width-64)/dx,(height-64)/dy);
  const offX=(width-dx*s)/2,offY=(height-dy*s)/2;
  const xy=p=>[offX+((+p[0])*factor-minX)*s,offY+(-(+p[1])-minY)*s];
  return features.map(f=>{
    const projected=[];
    const d=geometryRings(f.geometry).map(ring=>{
      let last=null,out='',current=[];
      for(let i=0;i<ring.length;i++){
        const p=ring[i];if(!Array.isArray(p)||!Number.isFinite(+p[0])||!Number.isFinite(+p[1]))continue;
        const [x,y]=xy(p);current.push([x,y]);
        if(last&&i<ring.length-1&&Math.hypot(x-last[0],y-last[1])<0.7)continue;
        out+=(last?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);last=[x,y];
      }
      if(current.length>2)projected.push(current);
      return out?out+'Z':'';
    }).filter(Boolean).join('');
    return {id:geoId(f),d,label:polygonLabelPoint(projected)};
  }).filter(r=>r.d);
}
async function boundaries(){
  if(boundaryCache)return boundaryCache;
  if(!boundaryPending)boundaryPending=(async()=>{
    for(const url of ['./assets/native/municipality_2025.geojson',GEO_SOURCE.url,GEO_SOURCE.alternate]){
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
      try{
        const response=await fetch(url,{cache:'force-cache',signal:controller.signal});
        if(!response.ok)continue;
        const json=await response.json();
        if(json?.type==='FeatureCollection'&&Array.isArray(json.features)&&json.features.length>1900){boundaryCache=json;return json;}
      }catch{/* Die Gemeindeliste bleibt nutzbar. */}finally{clearTimeout(timeout);}
    }
    throw new Error('Geodaten nicht verfügbar');
  })().finally(()=>{boundaryPending=null;});
  return boundaryPending;
}
const svgNode=(tag,attrs={})=>{const node=document.createElementNS(SVG_NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));return node;};
function zoom(svg,shape,pad=.16){try{if(!shape)return;const b=shape.getBBox();if(b.width&&b.height)svg.setAttribute('viewBox',`${b.x-b.width*pad} ${b.y-b.height*pad} ${b.width*(1+pad*2)} ${b.height*(1+pad*2)}`);}catch{}}
const coatIcon=(coat,name,code='')=>coat?.url
  ?`<span class="v541-coat-icon"><img src="${escapeText(coat.url)}" alt="Wappen ${escapeText(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`
  :`<span class="v541-coat-icon v541-coat-missing" aria-label="Wappen nicht verfügbar"><span aria-hidden="true">🛡</span></span>`;
const cantonRow=(c,count)=>`<button class="v54-item" data-v54-canton="${escapeText(c.code)}" type="button">${coatIcon(cantonCoat(c.code),c.name)}<span class="v54-item-code">${escapeText(c.code)}</span><span class="v54-item-main"><strong>${escapeText(c.name)}</strong><small>${c.municipalities.length} Gemeinden</small></span><span class="v54-item-hint">${count?`${count} Registrierungen`:''} ›</span></button>`;
const municipalityRow=(c,m,current)=>`<button class="v54-item ${current===String(m.bfsCode)?'is-current':''}" data-v54-municipality="${escapeText(m.bfsCode)}" type="button">${coatIcon(municipalityCoat(m.bfsCode),m.name)}<span class="v54-item-main"><strong>${escapeText(m.name)}</strong><small>Kanton ${escapeText(c.code)}</small></span><span aria-hidden="true">›</span></button>`;
export function mountSwissMapExplorer(host,{cantons=[],counts={},ownArea='',goRoute=()=>{}}={}){
  const root=host?.closest('[data-v54-explorer]'),baseSvg=host?.querySelector('svg');if(!root||!baseSvg)return;
  const base=baseSvg.cloneNode(true),side=root.querySelector('[data-v54-profile]'),list=root.querySelector('[data-v54-list]'),
    crumb=root.querySelector('[data-v54-breadcrumb]'),search=root.querySelector('[data-v54-search]'),status=root.querySelector('[data-v54-status]'),
    back=root.querySelector('[data-v54-back]'),legend=root.querySelector('[data-v54-legend]'),mapCurrent=root.querySelector('[data-v541-map-current]'),labelToggle=root.querySelector('[data-v541-label-toggle]');
  const byCode=new Map(cantons.map(c=>[c.code,c]));
  const sortedCantons=[...cantons].sort((a,b)=>a.name.localeCompare(b.name,'de-CH'));
  let canton=null,municipality=null,q='',request=0,labelMode='names';
  const getMunicipality=(c,id)=>c?.municipalities.find(m=>String(m.bfsCode)===String(id));
  function countrySvg(){const svg=base.cloneNode(true);svg.classList.add('v54-country-svg');svg.querySelectorAll('[data-code]').forEach(p=>{
    const c=byCode.get(p.dataset.code);p.setAttribute('role','button');p.setAttribute('tabindex','0');p.setAttribute('aria-label',`${c?.name||p.dataset.code} öffnen`);
  });host.replaceChildren(svg);}
  function cantonSvg(c){const svg=base.cloneNode(true);svg.classList.add('v54-zoom-svg');svg.querySelector('.canton-label-layer')?.remove();
    const selected=svg.querySelector(`[data-code="${c.code}"]`);
    svg.querySelectorAll('[data-code]').forEach(p=>{p.removeAttribute('tabindex');p.removeAttribute('role');p.classList.toggle('v54-dimmed',p!==selected);});
    host.replaceChildren(svg);zoom(svg,selected,.09);}
  function renderMunicipalityLabels(){
    const svg=host.querySelector('.v54-municipalities-svg');if(!svg)return;
    svg.querySelector('.v541-label-layer')?.remove();
    const group=svgNode('g',{class:'v541-label-layer','aria-hidden':'true'});
    const placed=[];
    const paths=[...svg.querySelectorAll('[data-v54-map-municipality]')].map(p=>({p,l:p.__v541Label})).filter(x=>x.l).sort((a,b)=>b.l.area-a.l.area);
    for(const {p,l} of paths){
      const m=getMunicipality(canton,p.dataset.v54MapMunicipality);if(!m)continue;
      const coat=labelMode==='arms'?municipalityCoat(m.bfsCode):null;
      const drawCoat=Boolean(coat?.url&&l.width>=43&&l.height>=48&&l.usableWidth>=36);
      const text=String(m.name),desired=Math.min(250,text.length*6.5+9);
      if(!drawCoat&&(l.width<Math.max(50,desired*.9)||l.height<27||l.usableWidth<desired*.85))continue;
      const x=l.cx,y=l.cy,w=drawCoat?32:desired;
      if(placed.some(o=>Math.abs(o.x-x)<(o.w+w)/2+7&&Math.abs(o.y-y)<(drawCoat?38:24)))continue;
      if(drawCoat){
        const badge=svgNode('image',{x:(x-12).toFixed(1),y:(y-15).toFixed(1),width:24,height:30,href:coat.url,preserveAspectRatio:'xMidYMid meet'});
        group.appendChild(badge);
      }else{
        const t=svgNode('text',{x:x.toFixed(1),y:y.toFixed(1),class:'v541-municipality-label','font-size':11});
        t.textContent=text;group.appendChild(t);
      }
      placed.push({x,y,w});
    }
    svg.appendChild(group);
  }
  function updateMapCaption(){
    if(mapCurrent){
      if(!canton)mapCurrent.innerHTML='<strong>CH</strong><span>Schweiz · 26 Kantone</span>';
      else if(!municipality)mapCurrent.innerHTML=`${coatIcon(cantonCoat(canton.code),canton.name)}<strong>${escapeText(canton.code)}</strong><span>${escapeText(canton.name)} · Gemeinden entdecken</span>`;
      else {const m=getMunicipality(canton,municipality);mapCurrent.innerHTML=`${coatIcon(municipalityCoat(m?.bfsCode),m?.name||'Gemeinde')}<span>${escapeText(m?.name||'')} · ${escapeText(canton.code)}</span>`;}
    }
    if(labelToggle){
      labelToggle.hidden=!canton;
      labelToggle.textContent=labelMode==='names'?'Karte: Gemeindenamen':'Karte: Wappen';
      labelToggle.setAttribute('aria-label',labelMode==='names'?'Wappen auf geeigneten Gemeindeflächen anzeigen':'Gemeindenamen auf der Karte anzeigen');
      labelToggle.setAttribute('aria-pressed',String(labelMode==='arms'));
    }
  }
  function scheduleCoats(c,selectedId=null){
    const token=request;
    const ids=selectedId?[String(selectedId)]:c.municipalities.map(m=>String(m.bfsCode));
    void loadMunicipalityCoats(ids).then(()=>{
      if(token!==request||!host.isConnected)return;
      const position=list.scrollTop;
      renderList();list.scrollTop=position;
      updateMapCaption();
      if(municipality){profile();}
      if(labelMode==='arms')renderMunicipalityLabels();
    });
  }
  function municipalitySvg(c,features){
    const paths=cantonPaths(features);if(!paths.length)return false;
    const svg=svgNode('svg',{viewBox:'0 0 960 600',role:'group','aria-label':`Gemeindegrenzen ${c.name} (Stand 2025)`});svg.classList.add('v54-municipalities-svg');
    const group=svgNode('g');const codes=new Map(c.municipalities.map(m=>[String(m.bfsCode),m]));
    for(const {id,d,label} of paths){const m=codes.get(id);if(!m)continue;
      const p=svgNode('path',{d,'fill-rule':'evenodd','data-v54-map-municipality':id,role:'button',tabindex:'0','aria-label':`${m.name} – Steckbrief öffnen`});
      p.__v541Label=label;
      const title=svgNode('title');title.textContent=`${m.name}`;p.appendChild(title);group.appendChild(p);}
    svg.appendChild(group);host.replaceChildren(svg);renderMunicipalityLabels();highlightMunicipality();return true;
  }
  function highlightMunicipality(){const svg=host.querySelector('.v54-municipalities-svg');if(!svg)return;
    svg.querySelectorAll('[data-v54-map-municipality]').forEach(p=>p.classList.toggle('is-selected',p.dataset.v54MapMunicipality===municipality));
    if(municipality)zoom(svg,svg.querySelector(`[data-v54-map-municipality="${municipality}"]`),.7);else svg.setAttribute('viewBox','0 0 960 600');}
  function profile(){
    const facts=(rows)=>`<div class="v54-facts">${rows.map(([a,b])=>`<span><small>${escapeText(a)}</small><strong>${escapeText(b)}</strong></span>`).join('')}</div>`;
    if(!canton){side.innerHTML=`<span class="v54-kicker">Schweiz · Übersicht</span><h3>Entdecke die Schweiz</h3>${facts([['Kantone',cantons.length],['Gemeinden',cantons.reduce((n,c)=>n+c.municipalities.length,0).toLocaleString('de-CH')]])}<p>Tippe auf einen Kanton. Die Farben zeigen wie bisher die Quartinaut-Registrierungen.</p>`;}
    else if(!municipality){
      const coat=cantonCoat(canton.code);
      side.innerHTML=`<span class="v54-kicker">Kanton · Steckbrief</span><div class="v541-profile-heading">${coatIcon(coat,canton.name)}<div><h3>${escapeText(canton.name)}</h3><span class="v541-shortcode">${escapeText(canton.code)}</span></div></div>${facts([['Kürzel',canton.code],['Hauptort',CAPITALS[canton.code]||'–'],['Gemeinden',canton.municipalities.length],['Quartinaut-Registrierungen',counts[canton.code]||0]])}<p>Gemeinde auf der Karte oder in der Liste auswählen.</p><a class="v541-coat-source" href="${escapeText(coat?.source||'#')}" target="_blank" rel="noopener noreferrer">Kantonswappen · Quelle &amp; Lizenz ↗</a>`;
    }else{const m=getMunicipality(canton,municipality);if(!m)return;const own=`${m.name} (${canton.code})`.toLowerCase()===String(ownArea).toLowerCase();
      const official=`https://www.agvchapp.bfs.admin.ch/de/communes/results?BfsNr=${encodeURIComponent(m.bfsCode)}`;
      const coat=municipalityCoat(m.bfsCode);
      side.innerHTML=`<span class="v54-kicker">Gemeinde · Steckbrief</span><div class="v541-profile-heading">${coatIcon(coat,m.name)}<h3>${escapeText(m.name)}</h3></div>${facts([['Kanton',canton.name],['Kantonskürzel',canton.code],['Land','Schweiz'],['Quartinaut',own?'Deine Gemeinde':'Gemeinde entdecken']])}<p>Aktuelle amtliche Gemeindedaten und Fusionen findest du im BFS-Verzeichnis. Einwohnerzahlen und Fläche werden ohne geprüfte Werte nicht geschätzt.</p><div class="v54-actions"><a href="${official}" class="secondary-button small" target="_blank" rel="noopener noreferrer">Amtlicher Steckbrief ↗</a>${own?'<button class="ghost-button small" type="button" data-route="hub">Mein Quartier+ öffnen</button>':''}</div>${coat?.source?`<a class="v541-coat-source" href="${escapeText(coat.source)}" target="_blank" rel="noopener noreferrer">Gemeindewappen · Quelle &amp; Lizenz ↗</a>`:'<small class="v541-coat-source">Gemeindewappen derzeit nicht verfügbar</small>'}`;
    }
    crumb.innerHTML='<button type="button" data-v54-reset>Schweiz</button>'+(canton?` <span>›</span> <button type="button" data-v54-canton="${escapeText(canton.code)}">${escapeText(canton.name.split(' / ')[0])}</button>`:'')+(municipality?` <span>›</span> <span aria-current="page">${escapeText(getMunicipality(canton,municipality)?.name||'')}</span>`:'');
    back.hidden=!canton;search.placeholder=canton?'Gemeinde suchen …':'Kanton oder Gemeinde suchen …';updateMapCaption();renderList();
  }
  function renderList(){const needle=searchKey(q);
    if(canton){const matches=[...canton.municipalities].sort((a,b)=>a.name.localeCompare(b.name,'de-CH')).filter(m=>searchKey(m.name).includes(needle));
      list.innerHTML=`<p class="v54-list-counter">${matches.length} Gemeinden in ${escapeText(canton.name)}</p>`+matches.slice(0,120).map(m=>municipalityRow(canton,m,municipality)).join('')+(matches.length>120?'<p class="v54-list-counter">Weitere Gemeinden über die Suche finden.</p>':'')+(!matches.length?'<p>Keine Gemeinde gefunden.</p>':'');return;}
    if(!needle){list.innerHTML=`<p class="v54-list-counter">26 Kantone</p>`+sortedCantons.map(c=>cantonRow(c,counts[c.code])).join('');return;}
    const matches=[];for(const c of sortedCantons){if(searchKey(c.name).includes(needle)||searchKey(c.code)===needle)matches.push({c});
      for(const m of c.municipalities)if(searchKey(m.name).includes(needle) )matches.push({c,m});}
    list.innerHTML=`<p class="v54-list-counter">${matches.length} Treffer</p>`+matches.slice(0,60).map(x=>x.m?municipalityRow(x.c,x.m,''):cantonRow(x.c,counts[x.c.code])).join('')+(matches.length>60?'<p>Suche bitte präzisieren.</p>':'')+(!matches.length?'<p>Kein Treffer.</p>':'');
  }
  function reset(){request++;canton=null;municipality=null;q='';search.value='';countrySvg();legend.hidden=false;status.textContent='Kanton wählen, um die Gemeinden zu entdecken.';profile();}
  function chooseCanton(code){const chosen=byCode.get(String(code||'').toUpperCase());if(!chosen)return;
    request++;const token=request;canton=chosen;municipality=null;q='';search.value='';cantonSvg(chosen);legend.hidden=true;profile();
    status.textContent='Gemeindegrenzen werden geladen …';scheduleCoats(chosen);
    void boundaries().then(data=>{if(token!==request||!host.isConnected)return;
      const features=cantonFeatures(data,chosen.municipalities);
      if(municipalitySvg(chosen,features))status.textContent=`Gemeindegrenzen Stand 01.01.2025 (${features.length} Flächen). Gemeindeverzeichnis Stand 05.11.2026.`;
      else status.textContent='Grenzen fehlen. Alle Gemeinden sind über die Liste auswählbar.';
    }).catch(()=>{if(token===request&&host.isConnected)status.textContent='Grenzen derzeit nicht erreichbar. Gemeinden über die Liste auswählen.';});
  }
  function chooseMunicipality(id){const mid=String(id||'');let found=canton;
    if(!getMunicipality(found,mid)){found=cantons.find(c=>getMunicipality(c,mid));if(!found)return;chooseCanton(found.code);}
    municipality=mid;highlightMunicipality();profile();scheduleCoats(found,mid);side.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-v54-reset]')){reset();return;}
    if(e.target.closest('[data-v541-label-toggle]')){labelMode=labelMode==='names'?'arms':'names';renderMunicipalityLabels();updateMapCaption();return;}
    const route=e.target.closest('[data-route]');if(route){goRoute(route.dataset.route);return;}
    if(e.target.closest('[data-v54-back]')){if(municipality){municipality=null;highlightMunicipality();profile();}else reset();return;}
    const m=e.target.closest('[data-v54-municipality],[data-v54-map-municipality]');if(m){chooseMunicipality(m.dataset.v54Municipality||m.dataset.v54MapMunicipality);return;}
    const c=e.target.closest('[data-v54-canton],[data-code]');if(c)chooseCanton(c.dataset.v54Canton||c.dataset.code);
  });
  root.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key)||!e.target.matches('svg [role="button"]'))return;e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  search.addEventListener('input',()=>{q=search.value;renderList();});
  root.addEventListener('error',e=>{if(e.target?.matches?.('.v541-coat-icon img')){const badge=e.target.closest('.v541-coat-icon');if(badge){badge.classList.add('v541-coat-missing');badge.innerHTML='<span aria-hidden="true">🛡</span>';}}},true);
  reset();
}
