/* Background FCM worker. Separate scope from app-shell SW to preserve the PWA cache. */
try {
  importScripts('./firebase-config.js', 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
  if(self.firebase?.messaging && self.QUARTINAUT_FIREBASE_CONFIG?.projectId){
    firebase.initializeApp(self.QUARTINAUT_FIREBASE_CONFIG);
    const messaging=firebase.messaging();
    messaging.onBackgroundMessage(payload=>{
      // Notification payloads are already presented by FCM; only handle data-only messages.
      if(payload.notification)return;
      const data=payload.data||{};
      const title=String(data.title||'Quartinaut').slice(0,120);
      const body=String(data.body||'Neue Nachricht aus deiner Gemeinde').slice(0,240);
      const route=['chats','alarme','bulletin','home'].includes(data.route) ? data.route : (data.chatId?'chats':'alarme');
      return self.registration.showNotification(title, {body,icon:'./assets/icons/icon-192.png',badge:'./assets/icons/icon-192.png',tag:String(data.chatId||data.alertId||'quartinaut'),data:{route,targetType:String(data.targetType|| (data.chatId?'chat':data.alertId?'alert':'')),targetId:String(data.targetId||data.chatId||data.alertId||'')}});
    });
  }
}catch(error){console.warn('Quartinaut FCM Hintergrunddienst konnte nicht starten',error);}
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const route=['chats','alarme','bulletin','home'].includes(event.notification.data?.route) ? event.notification.data.route : 'alarme';
  const targetType=String(event.notification.data?.targetType||'');
  const targetId=String(event.notification.data?.targetId||'');
  const urlObject=new URL('./',self.location.origin);urlObject.searchParams.set('route',route);
  if(['request','hub','event','notice','chat'].includes(targetType)&&targetId){urlObject.searchParams.set('targetType',targetType);urlObject.searchParams.set('targetId',targetId);}
  const url=urlObject.href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const tab=windows.find(c=>new URL(c.url).origin===self.location.origin);
    if(tab){await tab.focus();await tab.navigate(url);return;}return self.clients.openWindow(url);
  }));
});
