/** Consistent form presentation and feedback. No input values are stored or transmitted. */
let nextFieldId=0;

export function dateOnlyLabel(start,end='',fallback='Datum noch offen'){
 const format=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';
  const date=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return '';
  return new Intl.DateTimeFormat('de-CH',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(date);
 };
 const first=format(start),last=format(end);
 return first?(last&&end!==start?first+' – '+last:first):String(fallback||'Datum noch offen');
}

function validationText(control){
 const v=control.validity;
 if(v.valueMissing)return control.tagName==='SELECT'?'Bitte wähle eine Option.':control.type==='checkbox'?'Bitte bestätige diese Angabe.':'Bitte fülle dieses Feld aus.';
 if(v.typeMismatch&&control.type==='email')return 'Bitte gib eine gültige E-Mail-Adresse ein.';
 if(v.typeMismatch&&control.type==='url')return 'Bitte gib eine vollständige Webadresse mit https:// ein.';
 if(v.tooShort)return `Bitte gib mindestens ${control.minLength} Zeichen ein.`;
 if(v.tooLong)return `Bitte verwende höchstens ${control.maxLength} Zeichen.`;
 if(v.rangeUnderflow)return `Der Wert muss mindestens ${control.min} betragen.`;
 if(v.rangeOverflow)return `Der Wert darf höchstens ${control.max} betragen.`;
 if(v.badInput)return 'Bitte gib einen gültigen Wert ein.';
 if(v.stepMismatch)return 'Bitte prüfe die Zahl und die erlaubten Schritte.';
 if(v.patternMismatch)return 'Bitte prüfe das Format deiner Eingabe.';
 return 'Bitte prüfe deine Eingabe.';
}

function addDescription(control,id){
 const ids=new Set((control.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(id);control.setAttribute('aria-describedby',[...ids].join(' '));
}
function styleLabel(control){
 const label=control.labels?.[0];if(!label)return;
 label.classList.add('qn-field');
 if(control.matches('[type=checkbox],[type=radio]')){label.classList.add('qn-choice-field');if(control.required&&!label.querySelector('.qn-required')){const star=document.createElement('span');star.className='qn-required';star.setAttribute('aria-hidden','true');star.textContent='*';label.append(star);}return;}
 if(label.querySelector('.qn-field-label'))return;
 const text=[...label.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());
 if(!text.length)return;
 const caption=document.createElement('span');caption.className='qn-field-label';
 caption.textContent=text.map(n=>n.textContent.trim()).join(' ');text.forEach(n=>n.remove());
 if(control.required){const star=document.createElement('span');star.className='qn-required';star.setAttribute('aria-hidden','true');star.textContent=' *';caption.append(star);}
 label.prepend(caption);
}
function prepareControl(control){
 styleLabel(control);
 if(control.dataset.qnPrepared)return;
 control.dataset.qnPrepared='true';
 if(!control.id)control.id='qn-field-'+(++nextFieldId);
 const form=control.form;
 if(control.maxLength>0&&control.tagName==='TEXTAREA'){
  const counter=document.createElement('small');counter.className='qn-field-counter';counter.id=control.id+'-count';
  const refresh=()=>counter.textContent=`${control.value.length} von ${control.maxLength} Zeichen`;
  control.after(counter);addDescription(control,counter.id);control.addEventListener('input',refresh);form?.addEventListener('quartinaut:draft-restored',refresh);refresh();
 }
 if(control.type==='hidden'||control.matches('[type=submit],[type=button],[type=reset],[type=range]'))return;
 let touched=false,helper=null,siteMessage=false;
 const clear=()=>{if(siteMessage){control.setCustomValidity('');siteMessage=false;}control.removeAttribute('aria-invalid');if(helper)helper.hidden=true;};
 const report=()=>{
  if(!helper){helper=document.createElement('small');helper.className='qn-field-error';helper.id=control.id+'-error';helper.setAttribute('aria-live','polite');control.after(helper);addDescription(control,helper.id);}
  const message=control.validity.customError&&!siteMessage?control.validationMessage:validationText(control);
  control.setCustomValidity(message);siteMessage=true;control.setAttribute('aria-invalid','true');helper.textContent=message;helper.hidden=false;
 };
 control.addEventListener('invalid',()=>{touched=true;report();});
 control.addEventListener('input',()=>{clear();if(touched&&!control.validity.valid)report();});
 control.addEventListener('change',()=>{clear();});
 control.addEventListener('quartinaut:validation-reset',clear);
 control.addEventListener('blur',()=>{if(touched&&!control.validity.valid)report();});
}
function setupForm(form){
 if(form.dataset.qnFormReady)return;
 form.dataset.qnFormReady='true';
 if(form.querySelector('[required]')&&!form.querySelector('.qn-form-legend')){
  const p=document.createElement('p');p.className='qn-form-legend';p.textContent='Mit * gekennzeichnete Felder sind erforderlich.';form.prepend(p);
 }
 if(form.dataset.v50Form==='loan.request'){
  const start=form.elements.namedItem('from'),end=form.elements.namedItem('to');
  const clearRange=()=>{if(end?.dataset.qnRangeError){end.setCustomValidity('');delete end.dataset.qnRangeError;end.removeAttribute('aria-invalid');end.dispatchEvent(new Event('quartinaut:validation-reset'));}};
  for(const control of [start,end])for(const event of ['input','change'])control?.addEventListener(event,clearRange);
  form.addEventListener('submit',event=>{
   if(start?.value&&end?.value&&new Date(end.value)<=new Date(start.value)){
    end.dataset.qnRangeError='true';end.setCustomValidity('Die Rückgabe muss nach der Übergabe liegen.');end.reportValidity();event.preventDefault();event.stopImmediatePropagation();
   }
  },true);
 }
}
function groupTransactions(root){
 root.querySelectorAll('.v50-panel').forEach(panel=>{
  if(panel.dataset.qnGrouped)return;
  panel.dataset.qnGrouped='true';
  const form=[...panel.children].find(el=>el.tagName==='FORM');if(!form)return;
  const following=[];for(let el=form.nextElementSibling;el;el=el.nextElementSibling)following.push(el);
  if(!following.length)return;
  const layout=document.createElement('div');layout.className='qn-transaction-layout';
  const input=document.createElement('section');input.className='qn-transaction-form';
  const results=document.createElement('section');results.className='qn-transaction-results';
  form.before(layout);input.append(form);following.forEach(el=>{
   if(el.tagName==='H3'){const h=document.createElement('h2');h.textContent=el.textContent;results.append(h);el.remove();}else results.append(el);
  });layout.append(input,results);
 });
}

export function enhanceInterface(root,{page='',title=true}={}){
 if(!root)return;
 if(page)root.dataset.page=page;
 groupTransactions(root);
 root.querySelectorAll('form').forEach(setupForm);
 root.querySelectorAll('input,select,textarea').forEach(prepareControl);
 root.querySelectorAll('.segmented[role=group] button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
 root.querySelectorAll('article button,.card button').forEach(button=>{
  if(button.hasAttribute('aria-label')||button.hasAttribute('aria-labelledby'))return;
  const text=button.textContent.trim();if(!['Öffnen','Ansehen','Bearbeiten','Entfernen','Löschen','Melden','Freigeben','Ablehnen'].includes(text))return;
  const name=button.closest('article,.card')?.querySelector('h2,h3')?.textContent.trim();if(name)button.setAttribute('aria-label',text+' – '+name.slice(0,100));
 });
 if(title){const heading=root.querySelector('h1')?.textContent.trim();if(heading)document.title=heading.includes('Quartinaut')?heading:heading+' · Quartinaut';}
}
