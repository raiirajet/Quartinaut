// Same sequence as Android: location, description, preview. Existing submit logic stays intact.
export function mountRequestWizard(form) {
 if(!form||form.dataset.wizardMounted)return;
 form.dataset.wizardMounted='true';form.classList.add('v2-request-wizard');
 const original=[...form.children],labels=['Ort & Reichweite','Beschreibung','Vorschau & Absenden'];
 const steps=labels.map((label,i)=>{const section=document.createElement('section');section.className='v2-wizard-step';section.dataset.step=i;section.setAttribute('aria-label',label);section.hidden=i!==0;return section;});
 function move(el){const names=[...el.querySelectorAll('[name]')].map(x=>x.name);if(el.name)names.push(el.name);const i=names.includes('type')?0:names.length?1:2;steps[i].append(el);}
 for(const el of original){if(el.classList.contains('form-grid')&&el.querySelector('[name="type"]'))[...el.children].forEach(move);else if(el.matches('button[type="submit"]'))steps[2].append(el);else move(el);}
 const progress=document.createElement('div');progress.className='v2-wizard-progress';progress.setAttribute('aria-label','Fortschritt');
 const status=document.createElement('p');status.className='v2-wizard-status';status.setAttribute('aria-live','polite');
 form.prepend(progress,status,...steps);let current=0;
 const preview=document.createElement('article');preview.className='qn-panel';preview.dataset.qnPreview='';steps[2].prepend(preview);
 const confirm=document.createElement('label');confirm.className='check-row';confirm.innerHTML='<input type="checkbox" required name="publicationConfirmed"><span>Ich habe die Angaben geprüft. Es werden keine privaten Kontaktdaten oder Hausnummern veröffentlicht.</span>';steps[2].insertBefore(confirm,steps[2].querySelector('button[type="submit"]'));
 form.addEventListener('quartinaut:draft-restored',event=>{current=Math.max(0,Math.min(2,Number(event.detail?.step)||0));show();});
 for(let i=0;i<3;i++){
  const footer=document.createElement('div');footer.className='v2-wizard-controls';
  if(i>0)footer.append(control('Zurück',-1));if(i<2)footer.append(control(i===0?'Weiter · Beschreibung':'Weiter · Vorschau',1));
  const submit=steps[i].querySelector('button[type="submit"]');if(submit)steps[i].insertBefore(footer,submit);else steps[i].append(footer);
 }
 function control(label,direction){const button=document.createElement('button');button.type='button';button.textContent=label;button.className=direction<0?'ghost-button':'primary-button';button.onclick=()=>{
  if(direction>0){for(const input of steps[current].querySelectorAll('input,textarea,select')){if(!input.disabled&&!input.closest('[hidden]')&&!input.checkValidity()){input.reportValidity();input.focus();return;}}
   if(current===0&&form.elements.audienceLevel?.value==='radius'&&!form.qnCenter){const status=form.querySelector('[data-qn-location-status]');if(status)status.textContent='Bitte zuerst den Standort einmalig bestimmen.';return;}
  }
  current=Math.max(0,Math.min(2,current+direction));show();form.dispatchEvent(new Event('quartinaut:wizard-step'));
 };return button;}
 function show(){form.dataset.wizardStep=current;steps.forEach((step,i)=>step.hidden=i!==current);progress.replaceChildren(...labels.map((label,i)=>{const span=document.createElement('span');span.className=i<=current?'is-active':'';span.textContent=(i+1)+'. '+label;if(i===current)span.setAttribute('aria-current','step');return span;}));status.textContent=`Schritt ${current+1} von 3 · ${labels[current]}`;
  preview.replaceChildren();if(current===2){const values=new FormData(form);for(const [title,value] of [['Titel',values.get('title')],['Beschreibung',values.get('text')],['Kategorie',values.get('category')],['Reichweite',({canton:'Kanton',municipality:'Gemeinde',country:'Schweizweit',radius:'Umkreis von '+values.get('audienceRadiusKm')+' km'})[values.get('audienceLevel')||'canton']],['Dringlichkeit',values.get('urgency')]]){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=title+': ';p.append(strong,document.createTextNode(String(value||'')));preview.append(p);}}
  form.closest('.modal-card')?.scrollTo({top:0,behavior:'instant'});
 }
 show();
}
