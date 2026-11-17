const CACHE='familyauto-shell-v2.3.9';
const VERSION='2.3.9';
const ASSETS=['./','./index.html','./styles.css?v=2.3.9','./app.js?v=2.3.9','./navigation.js?v=2.3.9','./firebase-auth.js?v=2.3.9','./firebase-config.js','./firebase-profile.js?v=2.3.9','./firebase-members.js?v=2.3.9','./firebase-requests.js?v=2.3.9','./firebase-homes.js?v=2.3.9','./firebase-push.js?v=2.3.9','./firebase-activity.js?v=2.3.9','./firebase-notification-queue.js','./booking-time.mjs','./history-time.mjs','./push-config.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
   event.respondWith(fetch(new Request(request,{cache:'no-store'})).then(response=>{
     if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./index.html',clone)))}
     return response;
   }).catch(async()=>await caches.match('./index.html')||Response.error()));
   return;
 }
 event.respondWith(fetch(request).then(response=>{
   if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)))}
   return response;
 }).catch(()=>caches.match(request)));
});


/* Background Web Push events delivered to this PWA service worker.
   The sender uses data-only messages; the app decides which recipients are relevant. */
self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?.json()||{}}catch{payload={}}
 const data=payload.data||payload;
 // Keep the title empty so iOS supplies the installed app name. iOS itself
 // also adds the PWA attribution line "from <app name>"; web code cannot hide it.
 const title='';
 const body=typeof data.body==='string'?data.body:'יש עדכון חדש על הרכב.';
 const destination=['calendar','settings-houses'].includes(data.destination)?'#'+data.destination:'#requests';
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:'./icon.svg',badge:'./icon.svg',tag:data.eventId||'familyauto',
  data:{destination}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const destination=event.notification.data?.destination||'#requests';
 const target=new URL('./'+destination,self.registration.scope).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  for(const client of clients){
   if(client.url.startsWith(self.registration.scope)){
    await client.focus();
    if('navigate' in client)await client.navigate(target);
    return;
   }
  }
  return self.clients.openWindow(target);
 }));
});
