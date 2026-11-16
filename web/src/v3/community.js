export const HUB_MODULES=Object.freeze([
 {id:'lend',icon:'🛠️',title:'Leihbörse',description:'Werkzeuge und Dinge teilen',kind:'lend'},
 {id:'group',icon:'👥',title:'Vereine & Gruppen',description:'Gemeinsam etwas unternehmen',kind:'group'},
 {id:'lost',icon:'🔎',title:'Fundbüro',description:'Verloren oder gefunden',kind:'lost'},
 {id:'market',icon:'🛍️',title:'Marktplatz',description:'Kaufen, tauschen, verschenken',kind:'market'},
 {id:'match',icon:'✨',title:'Quartinaut Match',description:'Passendes aus deiner Nähe',kind:null},
 {id:'digest',icon:'🔔',title:'Benachrichtigungen',description:'Deine Themen & Zusammenfassung',kind:null},
 {id:'rsvp',icon:'📅',title:'Anlässe & Zusagen',description:'Teilnehmen und Plätze verwalten',kind:null},
 {id:'draft',icon:'✍️',title:'Textassistent',description:'Beiträge einfacher erstellen',kind:null},
 {id:'issue',icon:'🚧',title:'Mängelmelder',description:'Anliegen an Gemeinden',kind:'issue'},
 {id:'calendar',icon:'🗓️',title:'Gemeindekalender',description:'Termine & Entsorgung',kind:'calendar'},
 {id:'stats',icon:'📊',title:'Verwaltungs-Dashboard',description:'Übersichten für Berechtigte',kind:null},
 {id:'project',icon:'🤝',title:'Quartier-Projekte',description:'Bei Aktionen mithelfen',kind:'project'}
]);
export const HUB_CATEGORIES=Object.freeze({
 lend:['Werkzeug','Garten','Haushalt','Freizeit','Sonstiges'],market:['Zu verkaufen','Zu verschenken','Tauschen'],
 lost:['Verloren','Gefunden'],group:['Verein','Sport','Familie','Hobby','Nachbarschaft'],
 issue:['Strasse','Abfall','Beleuchtung','Spielplatz','Sonstiges'],
 calendar:['Entsorgung','Gemeindetermin','Veranstaltung','Information'],
 project:['Quartieraktion','Freiwilligenarbeit','Umwelt','Nachbarschaft']
});
export const HOME_OPTIONS=Object.freeze([
 {value:'home',title:'Mein Quartier'},
 {value:'hub',title:'Quartier+ – weitere Funktionen'},
 {value:'bulletin',title:'Schwarzes Brett'},
 {value:'events',title:'Veranstaltungen'},
 {value:'inbox',title:'Mitteilungen'},
 {value:'chats',title:'Chats'}
]);
export const NOTIFY_TOPICS=Object.freeze([
 ['chats','Private Nachrichten'],['alerts','Gemeinde-Alarme'],['help','Nachbarschaftshilfe'],
 ['events','Veranstaltungen'],['groups','Gruppen und Vereine'],['market','Marktplatz'],
 ['lending','Leihbörse'],['municipality','Gemeindeinformationen']
]);
export const HOME_KEY='quartinaut-v3-home:';
export function homeKey(uid){return HOME_KEY+String(uid||'guest').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);}
export function cleanHome(value){return HOME_OPTIONS.some(o=>o.value===value)?value:'home';}
export function loadHome(uid){try{return cleanHome(localStorage.getItem(homeKey(uid)));}catch{return 'home';}}
export function saveHome(uid,view){const v=cleanHome(view);try{localStorage.setItem(homeKey(uid),v);}catch{}return v;}
export function matchingItems(items,{interests=[],areaKey='',uid=''}={}){
 const wanted=interests.map(x=>String(x).toLocaleLowerCase('de-CH'));
 return items.filter(x=>x&&x.status==='published'&&x.ownerUid!==uid&&x.kind!=='issue')
 .map(x=>{const text=String([x.kind,x.title,x.description,x.category].join(' ')).toLocaleLowerCase('de-CH');
  const score=(x.areaKey===areaKey?50:0)+wanted.reduce((s,w)=>s+(text.includes(w)?30:0),0)+Math.min(15,Math.max(0,15-(Date.now()-Date.parse(x.createdAt||0))/86400000));
  return {item:x,score};}).sort((a,b)=>b.score-a.score).map(x=>x.item);
}
export function localDraft(text,kind='help'){
 const raw=String(text||'').trim().slice(0,500);
 if(!raw)return {title:'',description:''};
 const summary=raw.replace(/\s+/g,' ').replace(/[\.!?]+$/,'');
 const title=summary.charAt(0).toUpperCase()+summary.slice(1,80);
 const intro=({lend:'Ich möchte Folgendes verleihen: ',market:'Ich biete in unserer Gemeinde Folgendes an: ',lost:'Verloren/Gefunden: ',group:'Gemeinsam in unserer Gemeinde: ',project:'Bei dieser Quartieraktion geht es um: ',help:'Mein Anliegen: '})[kind]||'Mein Anliegen: ';
 return {title,description:intro+summary+'. Bitte melde dich bei Interesse direkt über Quartinaut.'};
}
