/* Quartinaut 5.4.1: heraldische Abbildungen ausschliesslich als Nachschlageinformation.
   Kein Wappen als Marken- oder Zugehörigkeitssymbol von Quartinaut verwenden.
   Kantone: Wikimedia Commons "Matt coats of arms of Swiss cantons".
   Gemeinden: Wikidata P771 (amtliche BFS-Identifikationsnummer) + P94 (Wappenbild).
   Wappenbilder und ihre Bildlizenzen verbleiben beim jeweiligen Commons-Datensatz.
*/
export const CANTON_COAT_FILES=Object.freeze({
  AG:'Wappen Aargau matt.svg',AI:'Wappen Appenzell Innerrhoden matt.svg',
  AR:'Wappen Appenzell Ausserrhoden matt.svg',BE:'Wappen Bern matt.svg',
  BL:'Wappen Basel-Landschaft matt.svg',BS:'Wappen Basel-Stadt matt.svg',
  FR:'Wappen Freiburg matt.svg',GE:'Wappen Genf matt.svg',
  GL:'Wappen Glarus matt.svg',GR:'Wappen Graubünden matt.svg',
  JU:'Wappen Jura matt.svg',LU:'Wappen Luzern matt.svg',
  NE:'Wappen Neuenburg matt.svg',NW:'Wappen Nidwalden matt.svg',
  OW:'Wappen Obwalden matt.svg',SG:'Wappen St. Gallen matt.svg',
  SH:'Wappen Schaffhausen matt.svg',SO:'Wappen Solothurn matt.svg',
  SZ:'Wappen Schwyz matt.svg',TG:'Wappen Thurgau matt.svg',
  TI:'Wappen Tessin matt.svg',UR:'Wappen Uri matt.svg',
  VD:'Wappen Waadt matt.svg',VS:'Wappen Wallis matt.svg',
  ZG:'Wappen Zug matt.svg',ZH:'Wappen Zürich matt.svg'
});
const found = new Map();
const inFlight=new Map();
const pendingFailures = new Map();
const validCode = x=>/^\d{1,5}$/.test(String(x??''));
export function commonsCoatUrl(file){
  if(typeof file!=='string'||!file.trim()||file.length>240||/[<>\\/#?]/.test(file))return '';
  return 'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file.trim().replaceAll(' ','_'));
}
export function commonsSourceUrl(file){
  if(typeof file!=='string'||!file.trim()||file.length>240||/[<>\\/#?]/.test(file))return '';
  return 'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file.trim().replaceAll(' ','_'));
}
export function cantonCoat(code){
  const file=CANTON_COAT_FILES[String(code||'').toUpperCase()];
  return file?{file,url:'./assets/native/wappen/cantons/'+String(code).toUpperCase()+'.svg',source:commonsSourceUrl(file)}:null;
}
export function municipalityCoat(code){const url=globalThis.QUARTINAUT_LOCAL_COATS?.[String(code)];return url?{file:'BFS '+code,url,source:'./assets/native/wappen/sources.json'}:found.get(String(code))||null;}
export function coatFileFromWikidata(value){
  if(typeof value!=='string')return null;
  try{
    const u=new URL(value);
    if(!['commons.wikimedia.org','upload.wikimedia.org'].includes(u.hostname))return null;
    if(u.hostname==='commons.wikimedia.org'&&!u.pathname.startsWith('/wiki/Special:FilePath/'))return null;
    const file=decodeURIComponent(u.pathname.split('/').at(-1)).replaceAll('_',' ');
    return commonsCoatUrl(file)?file:null;
  }catch{return null;}
}
async function fetchChunk(codes){
  const query=`SELECT ?code ?image WHERE { VALUES ?code { ${codes.map(code=>'"'+code+'"').join(' ')} } ?item wdt:P771 ?code; wdt:P94 ?image. }`;
  const url='https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(query);
  const control=new AbortController();const timer=setTimeout(()=>control.abort(),11000);
  try{
    const res=await fetch(url,{headers:{Accept:'application/sparql-results+json'},signal:control.signal});
    if(!res.ok)throw new Error('Wikidata HTTP '+res.status);
    const data=await res.json();
    if(!Array.isArray(data?.results?.bindings))throw new Error('Ungültige Wappenantwort');
    const listed=new Set(codes);
    for(const binding of data.results.bindings){
      const code=String(binding?.code?.value||'');
      if(!listed.has(code))continue;
      const file=coatFileFromWikidata(binding?.image?.value);
      if(file&&!found.has(code))found.set(code,{file,url:commonsCoatUrl(file),source:commonsSourceUrl(file)});
    }
    // A successful response with no match is meaningful and avoids repeated traffic.
    for(const code of codes)if(!found.has(code))found.set(code,null);
  }finally{clearTimeout(timer);}
}
export async function loadMunicipalityCoats(codes){
 if(globalThis.QUARTINAUT_LOCAL_COATS)return codes.filter(x=>globalThis.QUARTINAUT_LOCAL_COATS[String(x)]).length;
  const clean=[...new Set((codes||[]).map(x=>String(x)))].filter(validCode);
  const wait=[];
  const newCodes=[];
  const now=Date.now();
  for(const code of clean){
    if(found.has(code))continue;
    if(inFlight.has(code)){wait.push(inFlight.get(code));continue;}
    if(now-(pendingFailures.get(code)||0)<60000)continue;
    newCodes.push(code);
  }
  for(let i=0;i<newCodes.length;i+=45){
    const chunk=newCodes.slice(i,i+45);
    const promise=fetchChunk(chunk).catch(()=>{
      for(const code of chunk)pendingFailures.set(code,Date.now());
    }).finally(()=>{for(const code of chunk)inFlight.delete(code);});
    for(const code of chunk)inFlight.set(code,promise);
    wait.push(promise);
  }
  await Promise.all(wait);
  return clean.filter(x=>municipalityCoat(x)).length;
}
