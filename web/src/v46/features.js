// Quartinaut 4.6 – pure, privacy-aware client helpers; never queries private collections.
export const V46_FILTERS = Object.freeze(['all', 'mine', 'photos', 'new', 'saved']);
export const V46_SEARCH_TYPES = Object.freeze(['all','request','hub','group','event','notice','person']);
export const V46_INBOX_TYPES = Object.freeze(['all','unread','chat','alert','reservation','other']);
const clean = value => String(value ?? '').trim().slice(0, 300);
export const normalizeSearch = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-CH');
export function safeScope(uid) { return String(uid||'guest').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100) || 'guest'; }
export function readUserData(uid, type, fallback) {
  try { const raw=localStorage.getItem(`quartinaut-v46:${safeScope(uid)}:${type}`); return raw ? JSON.parse(raw) : fallback; }
  catch {return fallback;}
}
export function writeUserData(uid, type, value) {
  try {localStorage.setItem(`quartinaut-v46:${safeScope(uid)}:${type}`,JSON.stringify(value));return true;}catch{return false;}
}
export function publicSearchIndex({requests=[], hubs=[], events=[], notices=[]}={}) {
  const result=[];
  const push=(type,item,title,description,area,at)=>{
    if(!item?.id)return;
    result.push({type,id:String(item.id),title:clean(title),description:clean(description),area:clean(area),at:String(at||''),item});
  };
  requests.filter(x=>x && x.status==='offen').forEach(x=>push('request',x,x.title,x.text,x.area,x.createdAt));
  hubs.filter(x=>x && x.status==='published' && x.kind!=='issue').forEach(x=>push(x.kind==='group'?'group':'hub',x,x.title,x.description,x.area,x.createdAt));
  events.filter(x=>x && x.status==='published').forEach(x=>push('event',x,x.title,x.description,x.area,x.startsAt));
  notices.filter(x=>x && x.status==='online').forEach(x=>push('notice',x,x.title,x.text,x.area,x.createdAt));
  // Public contributors only. Never index registeredUsers, emails or phone numbers.
  const people=new Map();
  for(const req of requests.filter(x=>x && x.status==='offen' && !x.anonymousOffer)) {
    const name=clean(req.authorName); if(!name || /^anonym/i.test(name))continue;
    const key=normalizeSearch(name);if(!people.has(key))people.set(key,{type:'person',id:`person-${people.size}`,title:name,description:'Öffentliche Beiträge',area:clean(req.area),at:String(req.createdAt||''),item:{name}});
  }
  result.push(...people.values());
  return result;
}
export function searchRecords(records, {query='',type='all',area='',onlyArea=false,limit=80}={}) {
  const terms=normalizeSearch(query).split(/\s+/).filter(Boolean).slice(0,8);
  const areaNorm=normalizeSearch(area);
  return records.filter(record=>(type==='all'||record.type===type || (type==='hub'&&record.type==='group'))
    && (!onlyArea || (areaNorm && normalizeSearch(record.area)===areaNorm))
    && terms.every(term=>normalizeSearch([record.title,record.description,record.area,record.item?.category||'',...(record.type==='request' && !record.item?.anonymousOffer ? [record.item?.authorName||''] : [])].join(' ')).includes(term)))
   .sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).slice(0,Math.min(150,Math.max(1,Number(limit)||80)));
}
export function filterFeed(rows,{kind='all',area='',lastSeenAt='',uid='',savedKeys=[]}={}) {
 const areaNorm=normalizeSearch(area), saved=new Set(savedKeys);
 return rows.filter(x=>{
  if(kind==='mine')return Boolean(areaNorm)&&normalizeSearch(x.area)===areaNorm;
  if(kind==='photos')return Array.isArray(x.photoPaths)&&x.photoPaths.length>0;
  if(kind==='new')return Boolean(lastSeenAt)&&Date.parse(x.createdAt||0)>Date.parse(lastSeenAt);
  if(kind==='saved')return saved.has(`request:${x.id}`)||saved.has(`hub:${x.id}`);
  return true;
 });
}
export function safeMapPoint(item) {
 if(item?.mapPublic !== true && item?.locationVisibility !== 'public')return null;
 const geo=item?.publicCoordinates || item?.geo || item?.coordinates || item?.location || item;
 const lat=Number(geo?.lat),lng=Number(geo?.lng ?? geo?.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<45.8||lat>47.9||lng<5.9||lng>10.6)return null;
 return {lat,lng,id:String(item.id||''),title:clean(item.title),kind:clean(item.kind),area:clean(item.area)};
}
export function cleanCollection(raw, max=100) {return Array.isArray(raw)?[...new Set(raw.filter(x=>typeof x==='string').map(clean).filter(Boolean))].slice(0,max):[];}
export function safeDrafts(storage, uid, prefix='quartinaut-draft-v42:') {
 const start=prefix+safeScope(uid)+':';const entries=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(start))continue;
  try{const data=JSON.parse(storage.getItem(key));if(!data?.saved||Date.now()-data.saved>72*3600000)continue;
   const values=data.values||[];const title=values.find(v=>v.name==='title')?.value||values.find(v=>v.name==='topic')?.value||'Unbenannter Entwurf';
   entries.push({key,title:clean(title).slice(0,90),saved:data.saved,form:key.slice(start.length).split(':')[0],context:key.slice(start.length)});
  }catch{}
 }
 return entries.sort((a,b)=>b.saved-a.saved).slice(0,100);
}
export function safeEmbedBox(lat,lng) {const a=Number(lat),b=Number(lng); if(!Number.isFinite(a)||!Number.isFinite(b))return '';return `${(b-.015).toFixed(4)}%2C${(a-.01).toFixed(4)}%2C${(b+.015).toFixed(4)}%2C${(a+.01).toFixed(4)}`;}
