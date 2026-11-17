import {app} from './firebase-config.js';
import {FCM_VAPID_KEY} from './push-config.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,setDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {getMessaging,isSupported,getToken,deleteToken,onMessage} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js';

const auth=getAuth(app),db=getFirestore(app);
const root=document.getElementById('pushSettingsRoot');
const headerPushButton=document.getElementById('headerPushBtn');
let user=null,messaging=null,tokenId=null,registeredToken=null;
const tokenStorageKey=uid=>'familyauto-push-token-'+uid;
function refreshHeaderPushButton(){
 if(!headerPushButton)return;
 let enabled=false;
 try{enabled=!!user&&typeof Notification!=='undefined'&&Notification.permission==='granted'&&!!localStorage.getItem(tokenStorageKey(user.uid))}catch{}
 headerPushButton.hidden=enabled;
 headerPushButton.title=typeof Notification!=='undefined'&&Notification.permission==='denied'?'ההתראות חסומות — לחצו לפרטים':'הפעלת התראות';
}
// Remove the Firestore registration while the old Firebase session is still valid.
// This prevents a signed-out device from receiving another household's updates.
export async function unregisterPushForCurrentUser(){
 const current=auth.currentUser;
 const id=current&&(tokenId||localStorage.getItem(tokenStorageKey(current.uid)));
 if(current&&id)await deleteDoc(doc(db,'users',current.uid,'pushTokens',id));
 if(current)localStorage.removeItem(tokenStorageKey(current.uid));
 if(await isSupported())await deleteToken(messaging||getMessaging(app));
 tokenId=null;registeredToken=null;
 document.getElementById('enablePushBtn')?.removeAttribute('hidden');
 const disable=document.getElementById('disablePushBtn');if(disable)disable.hidden=true;
 refreshHeaderPushButton();
}

const say=(message,error=false)=>{const status=document.getElementById('pushStatus');if(status){status.textContent=message;status.style.color=error?'#b3261e':''}};
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
// Explain push notifications once when an installed PWA first opens on a device
// that has not granted permission. Permission is requested only after a tap.
if(isStandalone&&(!('Notification'in window)||Notification.permission!=='granted')){
 try{
  const key='familyauto-push-first-pwa-open-v1';
  if(!localStorage.getItem(key)){
   const dialog=document.getElementById('pushWelcomeDialog');
   const body=document.getElementById('pushWelcomeBody');
   if(dialog&&body){
    body.textContent=typeof Notification!=='undefined'&&Notification.permission==='denied'
     ?'במכשיר הזה ההתראות חסומות כרגע. כדי לקבל עדכונים על בקשות והזמנות לרכב, יש לאפשר התראות בהגדרות המכשיר ואז להפעיל אותן בהגדרות FamilyAuto.'
     :'במכשיר הזה עדיין לא אישרת התראות. אפשר להפעיל אותן כדי לקבל עדכונים על בקשות והזמנות לרכב.';
    localStorage.setItem(key,'1');
    requestAnimationFrame(()=>dialog.showModal());
   }
  }
 }catch(e){console.warn('לא ניתן להציג את הסבר ההתראות',e)}
}
document.getElementById('pushWelcomeLater')?.addEventListener('click',()=>document.getElementById('pushWelcomeDialog')?.close());
document.getElementById('pushWelcomeSettings')?.addEventListener('click',()=>document.getElementById('pushWelcomeDialog')?.close());
const hash=async value=>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
};
if(root){
 root.innerHTML='<h2>התראות על הרכב</h2><p class="muted">התראות על בקשות והזמנות שקשורות אליך או לבית שלך. ההודעות נשלחות רק למכשירים שבהם אישרת התראות.</p><p id="pushStatus" role="status" aria-live="polite"></p><button type="button" id="enablePushBtn" class="primary wide">הפעלת התראות במכשיר הזה</button><button type="button" id="disablePushBtn" class="wide" hidden>כיבוי התראות במכשיר הזה</button>';
 const enable=document.getElementById('enablePushBtn'),disable=document.getElementById('disablePushBtn');
 const toggle=enabled=>{enable.hidden=enabled;disable.hidden=!enabled};
 let setupBusy=false;
 headerPushButton?.addEventListener('click',()=>{
  if(user)requestEnable();
  else document.querySelector('.settings-link[data-goto="settings-account"]')?.click();
 });
 const setup=async()=>{
  if(!user)return say('יש להתחבר לחשבון כדי להפעיל התראות.',true);
  if(isIOS&&!isStandalone)return say('באייפון יש להוסיף את FamilyAuto למסך הבית דרך Safari, לפתוח את האפליקציה משם ואז להפעיל התראות.',true);
  if(!FCM_VAPID_KEY)return say('ההתראות עדיין בהכנה: חסר מפתח Web Push ציבורי בהגדרות הפרויקט.',true);
  if(!('Notification'in window)||!('serviceWorker'in navigator))return say('הדפדפן הזה אינו תומך בהתראות Push.',true);
  if(!await isSupported())return say('שירות ההתראות אינו נתמך במכשיר או בדפדפן הזה.',true);
  const permission=await Notification.requestPermission();
  if(permission!=='granted')return say('לא ניתנה הרשאה להתראות. אפשר לשנות זאת בהגדרות המכשיר.',true);
  messaging=getMessaging(app);
  const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  const token=await getToken(messaging,{vapidKey:FCM_VAPID_KEY,serviceWorkerRegistration:registration});
  if(!token)throw Error('לא התקבל מזהה התראות מ־Firebase.');
  const id=await hash(token);
  await setDoc(doc(db,'users',user.uid,'pushTokens',id),{
   token,enabled:true,updatedAt:serverTimestamp(),platform:isIOS?'ios':'web'
  });
  tokenId=id;registeredToken=token;localStorage.setItem(tokenStorageKey(user.uid),id);toggle(true);refreshHeaderPushButton();say('ההתראות הופעלו במכשיר הזה.');
 };
 async function requestEnable(){
  if(setupBusy)return;
  setupBusy=true;
  enable.disabled=true;
  try{await setup()}catch(e){say('הפעלת ההתראות נכשלה: '+(e.code||e.message||'שגיאה לא ידועה'),true)}
  finally{enable.disabled=false;setupBusy=false}
 }
 enable.addEventListener('click',requestEnable);
 disable.addEventListener('click',async()=>{
  disable.disabled=true;
  try{
   if(!user)throw Error('יש להתחבר לחשבון.');
   await unregisterPushForCurrentUser();
   toggle(false);say('ההתראות בוטלו במכשיר הזה.');
  }catch(e){say('כיבוי ההתראות נכשל: '+(e.code||e.message),true)}
  finally{disable.disabled=false}
 });
 onAuthStateChanged(auth,u=>{
  // Never reuse a device token registered for a different signed-in account.
  if(user?.uid!==u?.uid){
   tokenId=null;registeredToken=null;toggle(false)
  }
  user=u;enable.disabled=!u;
  if(u&&localStorage.getItem(tokenStorageKey(u.uid))&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
   tokenId=localStorage.getItem(tokenStorageKey(u.uid));toggle(true);
  }
  if(!u)say('יש להתחבר לחשבון כדי להפעיל התראות.');
  else if(isIOS&&!isStandalone)say('באייפון, פתח את האפליקציה ממסך הבית כדי להפעיל התראות.');
  else if(typeof Notification!=='undefined'&&Notification.permission==='denied')say('התראות חסומות בהגדרות הדפדפן.',true);
  else say('לחץ על הפעלת התראות כדי לאשר קבלת עדכונים.');
  refreshHeaderPushButton();
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshHeaderPushButton()});
 // Foreground updates are already reflected in the live Firestore UI.
 isSupported().then(ok=>{
  if(!ok)return;
  onMessage(getMessaging(app),async payload=>{
   if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
   const data=payload.data||{};
   const registration=await navigator.serviceWorker.ready;
   await registration.showNotification('',{
    body:data.body||'יש עדכון חדש על הרכב.',
    icon:'./icon.svg',tag:data.eventId||'familyauto',
    data:{destination:['calendar','settings-houses'].includes(data.destination)?'#'+data.destination:'#requests'}
   });
  });
 }).catch(()=>{});
}
