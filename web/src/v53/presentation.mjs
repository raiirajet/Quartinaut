/* Quartinaut v5.3 – Pure UI preference and catalog definitions (no database calls). */
export const V53_SHORTCUTS = Object.freeze([
 {id:'need',label:'Hilfe suchen',hint:'Unterstützung finden',icon:'✋',action:'new-need'},
 {id:'offer',label:'Hilfe anbieten',hint:'Nachbarn unterstützen',icon:'♡',action:'new-offer'},
 {id:'market',label:'Marktplatz',hint:'Kaufen & verschenken',icon:'🛍️',hub:'market'},
 {id:'group',label:'Vereine',hint:'Gemeinsam aktiv',icon:'👥',hub:'group'},
 {id:'loans',label:'Leihbörse',hint:'Gegenstände ausleihen',icon:'🧰',hub:'lend'},
 {id:'calendar',label:'Gemeindekalender',hint:'Termine & Entsorgung',icon:'📅',v50:'v50calendar'},
 {id:'events',label:'Veranstaltungen',hint:'Lokale Anlässe',icon:'🎉',route:'events'},
 {id:'bulletin',label:'Schwarzes Brett',hint:'Gesuche & Angebote',icon:'📋',route:'bulletin'},
 {id:'inbox',label:'Mitteilungen',hint:'Neues und Anfragen',icon:'🔔',route:'inbox'},
 {id:'chats',label:'Chats',hint:'Privat austauschen',icon:'💬',route:'chats'},
 {id:'saved',label:'Favoriten',hint:'Gespeicherte Beiträge',icon:'⭐',route:'saved'},
 {id:'map',label:'Quartierkarte',hint:'Deine Umgebung',icon:'📍',route:'map'}
]);
export const V53_PRIORITY = Object.freeze([
 {id:'inbox',label:'Mitteilungen & Anfragen'},
 {id:'events',label:'Termine & Veranstaltungen'},
 {id:'loans',label:'Ausleihen & Reservierungen'},
 {id:'bulletin',label:'Meine Anliegen'},
 {id:'saved',label:'Meine Favoriten'},
 {id:'map',label:'Quartierkarte'}
]);
export function uniqueKnown(values,known){
 if(!Array.isArray(values))return [];
 const allowed=new Set(known),seen=new Set(),result=[];
 for(const value of values){if(typeof value!=='string'||!allowed.has(value)||seen.has(value))continue;seen.add(value);result.push(value);}
 return result;
}
export function cleanQuickLinks(values){
 const ids=uniqueKnown(values,V53_SHORTCUTS.map(x=>x.id));
 return ids.length>=2 ? ids.slice(0,8) : ['need','offer','market','group'];
}
export function cleanPriorityOrder(values){
 const defaults=V53_PRIORITY.map(x=>x.id),ids=uniqueKnown(values,defaults);
 return [...ids,...defaults.filter(x=>!ids.includes(x))];
}
export function cleanDensity(value){return value==='compact'?'compact':'comfortable';}
const STATUS = Object.freeze({
 requested:'Angefragt',accepted:'Bestätigt',declined:'Abgelehnt',cancelled:'Storniert',
 confirmed:'Angemeldet',waitlisted:'Auf Warteliste',returned:'Zurückgegeben',
 borrowed:'Ausgeliehen',reserved:'Reserviert',available:'Verfügbar',
 expired:'Abgelaufen',completed:'Abgeschlossen',published:'Veröffentlicht',
 pending:'In Prüfung',submitted:'Eingereicht',in_review:'In Bearbeitung',
 rejected:'Abgelehnt',approved:'Freigegeben',open:'Offen',active:'Aktiv'
});
export function statusLabel(value){return STATUS[String(value||'').toLowerCase()]||String(value||'Unbekannt');}
const GROUPS=Object.freeze([
 {id:'sharing',icon:'🧰',label:'Teilen & Kaufen',description:'Ausleihen, reservieren, verkaufen und finden',ids:['lend','v50loans','market','v50market','lost']},
 {id:'community',icon:'👥',label:'Gemeinschaft & Vereine',description:'Gruppen, Anmeldungen und gemeinsame Projekte',ids:['group','v50associations','project','rsvp']},
 {id:'municipality',icon:'🏡',label:'Gemeinde & Termine',description:'Kalender, Entsorgung, Meldungen und Verwaltung',ids:['calendar','v50calendar','event-link','issue','stats']},
 {id:'help',icon:'🤝',label:'Nachbarschaftshilfe',description:'Hilfe suchen, anbieten und passende Beiträge finden',ids:['help-request','help-offer','bulletin-link','match']},
 {id:'personal',icon:'♡',label:'Für mich',description:'Mitteilungen, Favoriten, Vorschläge und Textassistent',ids:['digest','draft','inbox-link','saved-link']}
]);
export function hubGroups(){return GROUPS.map(g=>({...g,ids:[...g.ids]}));}
export function hubModuleIds(){return GROUPS.flatMap(g=>g.ids).filter(id=>!id.endsWith('-link')&&!id.startsWith('help-'));}
