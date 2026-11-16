const esc=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,c=>'\\'+c);
const utc=x=>new Date(x).toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
export function makeIcs(entry,kind){
 const event=kind==='calendar',date=String(entry.date||'').replace(/-/g,'');
 if(event&&!/^\d{8}$/.test(date))throw Error('Ungültiger Kalendertermin.');
 const allDay=event&&entry.allDay===true;
 const endDate=String(entry.endDate||entry.date||'').replace(/-/g,'');
 const start=allDay?`DTSTART;VALUE=DATE:${date}`:event?`DTSTART;TZID=Europe/Zurich:${date}T080000`:`DTSTART:${utc(entry.from)}`;
 const end=allDay?`DTEND;VALUE=DATE:${endDate}`:event?`DTEND;TZID=Europe/Zurich:${date}T090000`:`DTEND:${utc(entry.to)}`;
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Quartinaut//5.0//DE','BEGIN:VEVENT',`UID:quartinaut-${esc(entry.id)}@quartinaut.web.app`,`DTSTAMP:${utc(new Date())}`,start,end,`SUMMARY:${esc(entry.title||'Ausleihe')}`,`DESCRIPTION:${esc(entry.description||'')}`,'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Quartinaut Erinnerung',event?'TRIGGER:-PT12H':'TRIGGER:-PT24H','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export function saveIcs(content,id){const blob=new Blob([content],{type:'text/calendar;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='quartinaut-'+String(id||'termin').replace(/[^\w-]/g,'').slice(0,70)+'.ics';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
