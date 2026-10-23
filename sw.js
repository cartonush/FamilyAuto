const CACHE='familyauto-shell-v15';
const VERSION='1.5';
const ASSETS=['./','./index.html','./styles.css?v=1.5','./app.js?v=1.5','./navigation.js?v=1.5','./firebase-auth.js?v=1.5','./firebase-config.js','./firebase-profile.js?v=1.5','./firebase-members.js?v=1.5','./firebase-requests.js?v=1.5','./firebase-homes.js?v=1.5','./manifest.webmanifest','./icon.svg'];
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
