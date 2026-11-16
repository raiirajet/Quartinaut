/** Navigation and transient presentation state; never persisted or sent to a server. */
export function createViewSession({getView,getRoot,render,restoreView}) {
 const views=new Map();let painted='',owner='',interaction=false,pending=false,token=0,goal=null,generation=0;
 const identity=v=>[v.account,v.gate||'',v.route,v.section||'',v.chat||''].join('|');
 const userEvent=()=>{interaction=true;queueMicrotask(()=>{interaction=false;});};
 for(const type of ['click','input','change','submit','keydown'])document.addEventListener(type,userEvent,true);
 const pointer=el=>{
  if(el.id&&!/^qn-field-\d/.test(el.id))return {id:el.id};
  if(el.name)return {name:el.name,index:[...getRoot().querySelectorAll('[name]')].filter(x=>x.name===el.name).indexOf(el)};
  const path=[];for(let node=el;node&&node!==getRoot();node=node.parentElement)path.unshift([...node.parentElement.children].indexOf(node));return {path};
 };
 const locate=p=>p.id?document.getElementById(p.id):p.name?[...getRoot().querySelectorAll('[name]')].filter(x=>x.name===p.name)[p.index]:p.path?.reduce((el,n)=>el?.children[n],getRoot());
 function snapshot(){
  const root=getRoot(),active=document.activeElement;if(!root)return null;
  return {y:scrollY,x:scrollX,fields:[...root.querySelectorAll('input,select,textarea')].filter(x=>!['password','file','hidden','submit','button'].includes(x.type)).map(el=>({at:pointer(el),value:el.value,checked:el.checked})),
   details:[...root.querySelectorAll('details')].map(el=>({at:pointer(el),open:el.open})),
   scrolls:[...root.querySelectorAll('*')].filter(el=>el.scrollTop||el.scrollLeft).map(el=>({at:pointer(el),top:el.scrollTop,left:el.scrollLeft})),
   files:[...root.querySelectorAll('input[type=file]')].filter(el=>el.files?.length).map(el=>({at:pointer(el),files:el.files})),focus:root.contains(active)&&active.matches('input,textarea,select,button,a,[tabindex]')?{at:pointer(active),start:active.selectionStart,end:active.selectionEnd}:null};
 }
 function scroll(snapshot){
  if(!snapshot)return;
  for(const row of snapshot.scrolls){const el=locate(row.at);if(el){el.scrollTop=row.top;el.scrollLeft=row.left;}}
  window.scrollTo({top:snapshot.y,left:snapshot.x,behavior:'instant'});
  if(document.documentElement.scrollHeight-innerHeight+2<snapshot.y)goal={...snapshot,expires:performance.now()+5000};else goal=null;
 }
 function restore(snapshot,{focus=true}={}){
  if(!snapshot)return;
  for(const field of snapshot.fields){const el=locate(field.at);if(!el)continue;if(el.type==='checkbox'||el.type==='radio')el.checked=field.checked;else if(el.type==='select-one'){if([...el.options].some(o=>o.value===field.value))el.value=field.value;}else el.value=field.value;}
  for(const field of snapshot.files||[]){const el=locate(field.at);if(el?.type==='file')el.files=field.files;}
  for(const detail of snapshot.details){const el=locate(detail.at);if(el?.tagName==='DETAILS')el.open=detail.open;}
  getRoot()?.querySelectorAll('form').forEach(form=>form.dispatchEvent(new CustomEvent('quartinaut:view-restored')));
  if(focus&&snapshot.focus){const el=locate(snapshot.focus.at);el?.focus({preventScroll:true});try{el?.setSelectionRange(snapshot.focus.start,snapshot.focus.end);}catch{}}
  scroll(snapshot);
 }
 function hidePending(){pending=false;document.getElementById('qn-view-update')?.remove();}
 function markPending(){
  pending=true;if(document.hidden||document.getElementById('qn-view-update'))return;
  const box=document.createElement('aside');box.id='qn-view-update';box.setAttribute('role','status');box.innerHTML='<span>Neue Daten sind verfügbar. Deine Eingaben bleiben erhalten.</span><button type="button" class="secondary-button">Ansicht aktualisieren</button>';
  box.querySelector('button').onclick=()=>render({force:true});document.getElementById('app')?.append(box);
 }
 function begin({force=false}={}){
  const view=getView(),next=identity(view),root=getRoot();
  if(view.account!==owner){views.clear();painted='';goal=null;owner=view.account;hidePending();if(view.account)history.replaceState({...history.state,quartinaut:true,qnCanBack:false,qnView:{route:view.route,section:view.section||''}},'',location.href);}
  if(!force&&!interaction&&painted===next&&root?.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select')){markPending();return false;}
  const prior=snapshot();if(painted&&prior){views.set(painted,{...prior,files:[],focus:null});while(views.size>40)views.delete(views.keys().next().value);}
  const same=painted===next,target=same?(goal&&goal.expires>performance.now()?{...prior,y:goal.y}:prior):views.get(next);
  painted=next;hidePending();return {view,key:next,same,target,token:++token};
 }
 function end(frame){
  if(!frame)return;
  if(!frame.same&&!frame.target)window.scrollTo({top:0,left:0,behavior:'instant'});
  else restore(frame.target,{focus:frame.same});
  requestAnimationFrame(()=>{if(frame.token===token&&identity(getView())===frame.key)scroll(frame.target);});
 }
 function navigate(view){
  const url=new URL(location.href);url.searchParams.set('route',view.route);if(view.route==='hub')url.searchParams.set('section',view.section||'all');else url.searchParams.delete('section');
  const old=history.state?.qnView;
  if(old?.route===view.route&&(old.section||'')===(view.section||''))return;
  generation++;history.pushState({quartinaut:true,qnCanBack:true,qnView:{route:view.route,section:view.section||''}},'',url);
 }
 function initial(){
  const view=getView();history.replaceState({...history.state,quartinaut:true,qnCanBack:!!history.state?.qnCanBack,qnView:{route:view.route,section:view.section||''}},'',location.href);
 }
 function pop(event){
  generation++;
  const url=new URL(location.href),saved=event.state?.qnView||{route:url.searchParams.get('route')||'home',section:url.searchParams.get('section')||'all'};
  restoreView(saved);render({force:true});getRoot()?.focus({preventScroll:true});
 }
 for(const type of ['wheel','touchstart'])document.addEventListener(type,()=>{goal=null;},{passive:true});
 window.addEventListener('popstate',pop);
 return {begin,end,navigate,initial,snapshot,stamp:()=>({key:identity(getView()),generation}),current:stamp=>stamp?.key===identity(getView())&&stamp.generation===generation,reset(){generation++;views.clear();painted='';goal=null;token++;hidePending();},get pending(){return pending;}};
}
