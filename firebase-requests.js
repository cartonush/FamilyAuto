import {app} from './firebase-config.js';
import {queueBookingNotification} from './firebase-notification-queue.js';
import {instantUseEnd,nextClockEnd} from './booking-time.mjs';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,onSnapshot,addDoc,updateDoc,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const auth=getAuth(app),db=getFirestore(app),root=document.getElementById('requestsRoot');
root.innerHTML=`<div class="section-title"><h2>בקשות והזמנות</h2><span class="pill">מערכת הזמנות</span></div>
<p id="requestStatus" aria-live="polite">התחבר ובחר בית כדי להתחיל.</p>
<form id="requestForm" hidden>
<label>תחילת שימוש<button type="button" class="ios-date-trigger" id="pickStart" aria-haspopup="dialog"><span id="startLabel"></span><span class="ios-date-chevron">⌄</span></button><input type="hidden" name="start"></label>
<label>סיום שימוש<button type="button" class="ios-date-trigger" id="pickEnd" aria-haspopup="dialog"><span id="endLabel"></span><span class="ios-date-chevron">⌄</span></button><input type="hidden" name="end"></label>
<label>הערה (לא חובה)<input name="note" maxlength="200" placeholder="לאן נוסעים?"></label>
<button class="primary" type="submit">שליחת בקשה</button>
</form>
<dialog id="iosPicker" class="ios-picker" aria-labelledby="iosPickerTitle">
<div class="ios-picker-head"><button type="button" id="iosCancel">ביטול</button><strong id="iosPickerTitle">בחירת תאריך ושעה</strong><button type="button" id="iosDone">סיום</button></div>
<div class="ios-wheel-frame" aria-label="בחירת תאריך, שעה ודקות">
<div class="ios-wheel-highlight" aria-hidden="true"></div>
<div class="ios-wheel-fade" aria-hidden="true"></div>
<div class="ios-wheels">
<div class="ios-wheel" id="iosDay" role="listbox" aria-label="תאריך"></div>
<div class="ios-wheel" id="iosMinute" role="listbox" aria-label="דקות"></div>
<div class="ios-wheel" id="iosHour" role="listbox" aria-label="שעה"></div>
</div></div>
<p id="iosPickerHint" class="ios-picker-hint" aria-live="polite"></p>
</dialog>
<dialog id="instantChoiceDialog" class="ios-picker instant-choice-dialog" aria-labelledby="instantChoiceTitle">
<div class="ios-picker-head"><button type="button" id="instantChoiceCancel">ביטול</button><strong id="instantChoiceTitle">הרכב אצלי</strong><span aria-hidden="true"></span></div>
<p class="instant-choice-question">רוצה לבחור שעת סיום?</p>
<div class="instant-choice-buttons">
<button type="button" id="instantUntilDone" class="instant-choice-option" aria-pressed="true">לא, עד שאסיים <small>שריון ל־24 שעות, עם אפשרות לסיים מוקדם</small></button>
<button type="button" id="instantFixed" class="instant-choice-option" aria-pressed="false">כן, אבחר שעת סיום <small>בחירת שעה ודקות בקפיצות של רבע שעה</small></button>
</div>
<div id="instantTimeFields" hidden>
<p class="instant-choice-hint">בחר שעת סיום (אם השעה חלפה היום, היא תחול מחר)</p>
<div class="ios-wheel-frame" aria-label="בחירת שעת סיום">
<div class="ios-wheel-highlight" aria-hidden="true"></div><div class="ios-wheel-fade" aria-hidden="true"></div>
<div class="ios-wheels instant-clock-wheels">
<div class="ios-wheel" id="instantMinute" role="listbox" aria-label="דקות"></div>
<div class="ios-wheel" id="instantHour" role="listbox" aria-label="שעה"></div>
</div></div></div>
<p id="instantEndPreview" class="instant-end-preview" aria-live="polite"></p>
<p id="instantChoiceError" class="instant-choice-error" role="alert" hidden></p>
<button type="button" class="primary wide" id="instantConfirm">אישור — הרכב אצלי</button>
</dialog>
<section id="instantPanel" class="instant-panel" hidden><h3>הרכב אצלי</h3><p>שימוש מיידי ברכב, בהתאם להרשאה שבעל הבית העניק לך.</p>
<button type="button" class="primary wide" id="instantSubmit">הרכב אצלי — התחל שימוש</button></section><div id="requestList"></div>`;
const $=id=>document.getElementById(id),status=$('requestStatus'),form=$('requestForm'),list=$('requestList');
const startInput=form.elements.start,endInput=form.elements.end;
const SLOT_MS=15*60*1000,DAY_MS=86400000;
const localDateTime=date=>{
 const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return d.toISOString().slice(0,16);
};
const nextQuarter=()=>new Date(Math.ceil((Date.now()+1000)/SLOT_MS)*SLOT_MS);
const isQuarter=date=>date.getMinutes()%15===0&&date.getSeconds()===0;
const dateFormatter=new Intl.DateTimeFormat('he-IL',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const dayFormatter=new Intl.DateTimeFormat('he-IL',{weekday:'short',day:'numeric',month:'short'});
const pad=n=>String(n).padStart(2,'0');
const picker=$('iosPicker'),dayWheel=$('iosDay'),hourWheel=$('iosHour'),minuteWheel=$('iosMinute');
const wheels=[dayWheel,minuteWheel,hourWheel];
const ROW=44;
let editing='start',draft=null,baseDay=null,lockScroll=false;
const dateAtMidnight=date=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const addDays=(date,n)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+n);
function setChoice(which,date){
 (which==='start'?startInput:endInput).value=localDateTime(date);
 $(which==='start'?'startLabel':'endLabel').textContent=dateFormatter.format(date);
}
function initTimes(){
 const start=nextQuarter();
 setChoice('start',start);
 setChoice('end',new Date(start.getTime()+SLOT_MS));
}
function minAllowed(){return editing==='start'?nextQuarter():new Date(Math.max(nextQuarter().getTime()+SLOT_MS,new Date(startInput.value).getTime()+SLOT_MS))}
function maxAllowed(){return editing==='start'?new Date(nextQuarter().getTime()+29*DAY_MS):new Date(new Date(startInput.value).getTime()+30*DAY_MS)}
function closestAllowed(date){
 const min=minAllowed(),max=maxAllowed();
 const rounded=new Date(Math.ceil(date.getTime()/SLOT_MS)*SLOT_MS);
 return new Date(Math.min(max.getTime(),Math.max(min.getTime(),rounded.getTime())));
}
function optionsFor(wheel){
 if(wheel===dayWheel)return Array.from({length:32},(_,i)=>({value:i,label:i===0?'היום':i===1?'מחר':dayFormatter.format(addDays(baseDay,i))}));
 if(wheel===hourWheel)return Array.from({length:24},(_,i)=>({value:i,label:pad(i)}));
 return [0,15,30,45].map(n=>({value:n,label:pad(n)}));
}
function indexFor(wheel,date){
 if(wheel===dayWheel)return Math.round((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(baseDay.getFullYear(),baseDay.getMonth(),baseDay.getDate()))/DAY_MS);
 if(wheel===hourWheel)return date.getHours();
 return date.getMinutes()/15;
}
function selectedDate(dayIndex,hour,minute){
 const d=addDays(baseDay,dayIndex);
 return new Date(d.getFullYear(),d.getMonth(),d.getDate(),hour,minute);
}
function createWheel(wheel){
 wheel.replaceChildren();
 const spacer=document.createElement('div');spacer.className='ios-wheel-spacer';spacer.setAttribute('aria-hidden','true');wheel.append(spacer);
 for(const [index,option] of optionsFor(wheel).entries()){
  const el=document.createElement('div');el.className='ios-wheel-option';el.textContent=option.label;el.dataset.value=option.value;el.setAttribute('role','option');
  el.addEventListener('click',()=>wheel.scrollTo({top:index*ROW,behavior:'smooth'}));
  wheel.append(el);
 }
 const bottom=spacer.cloneNode();wheel.append(bottom);
}
function scrollWheelTo(wheel,index,behavior='instant'){
 wheel.scrollTo({top:index*ROW,behavior:behavior==='instant'?'instant':'smooth'});
}
function renderWheels(){
 lockScroll=true;
 const min=minAllowed(),max=maxAllowed();
 draft=closestAllowed(draft);
 for(const wheel of wheels){
  const items=wheel.querySelectorAll('.ios-wheel-option'),index=indexFor(wheel,draft);
  items.forEach((item,i)=>{
   let trial;
   if(wheel===dayWheel)trial=selectedDate(i,draft.getHours(),draft.getMinutes());
   else if(wheel===hourWheel)trial=selectedDate(indexFor(dayWheel,draft),i,draft.getMinutes());
   else trial=selectedDate(indexFor(dayWheel,draft),draft.getHours(),i*15);
   const tooEarly=trial.getTime()<min.getTime(),tooLate=trial.getTime()>max.getTime();
   item.classList.toggle('ios-wheel-unavailable',tooEarly||tooLate);
   item.classList.toggle('ios-wheel-selected',i===index);
   item.setAttribute('aria-selected',String(i===index));
  });
  scrollWheelTo(wheel,index);
 }
 $('iosPickerHint').textContent='בחירת דקות: 00, 15, 30, 45 בלבד';
 requestAnimationFrame(()=>{lockScroll=false});
}
function onWheelSettled(wheel){
 if(lockScroll||!picker.open)return;
 const max=wheel.querySelectorAll('.ios-wheel-option').length-1;
 const index=Math.max(0,Math.min(max,Math.round(wheel.scrollTop/ROW)));
 const day=indexFor(dayWheel,draft),hour=draft.getHours(),minute=draft.getMinutes();
 draft=closestAllowed(selectedDate(
  wheel===dayWheel?index:day,
  wheel===hourWheel?index:hour,
  wheel===minuteWheel?index*15:minute
 ));
 renderWheels();
}
for(const wheel of wheels){
 let settleTimer;
 wheel.addEventListener('scroll',()=>{
  if(lockScroll||!picker.open)return;
  clearTimeout(settleTimer);
  settleTimer=setTimeout(()=>onWheelSettled(wheel),100);
 },{passive:true});
}
function openPicker(which){
 editing=which;
 baseDay=dateAtMidnight(new Date());
 const value=new Date((which==='start'?startInput:endInput).value);
 draft=closestAllowed(Number.isFinite(value.getTime())?value:minAllowed());
 $('iosPickerTitle').textContent=which==='start'?'תחילת שימוש':'סיום שימוש';
 wheels.forEach(createWheel);
 picker.showModal();
 renderWheels();
}
$('pickStart').addEventListener('click',()=>openPicker('start'));
$('pickEnd').addEventListener('click',()=>openPicker('end'));
$('iosCancel').addEventListener('click',()=>picker.close());
$('iosDone').addEventListener('click',()=>{
 // Read all three wheels together before validating the resulting time.
 const indexes=wheels.map(wheel=>Math.max(0,Math.min(
  wheel.querySelectorAll('.ios-wheel-option').length-1,Math.round(wheel.scrollTop/ROW)
 )));
 draft=closestAllowed(selectedDate(indexes[0],indexes[2],indexes[1]*15));
 draft=closestAllowed(draft);
 setChoice(editing,draft);
 if(editing==='start'){
  const end=new Date(endInput.value);
  if(!Number.isFinite(end.getTime())||end.getTime()<draft.getTime()+SLOT_MS)setChoice('end',new Date(draft.getTime()+SLOT_MS));
 }
 picker.close();
});
picker.addEventListener('click',event=>{
 if(event.target===picker)picker.close();
});
initTimes();
let selected=null,stopRequests=null,stopSchedule=null,records=[],schedule=[],currentUser=null,epoch=0,permissions={},permissionCache={};
const say=(message,error=false)=>{status.textContent=message;status.style.color=error?'#b3261e':''};
const friendlyError=e=>{
 const code=e?.code||'';
 if(code==='permission-denied')return 'אין לך הרשאה לבצע את הפעולה הזאת.';
 if(code==='unavailable'||code==='network-request-failed')return 'אין חיבור זמין. בדוק את האינטרנט ונסה שוב.';
 if(code==='failed-precondition')return 'הפעולה לא הושלמה. ייתכן שהרכב הוזמן במקביל; רענן ונסה שוב.';
 return e?.message||'לא ניתן להשלים את הפעולה כרגע. נסה שוב.';
};
const dateOf=v=>v?.toDate?v.toDate():new Date(0);
const overlaps=(a,b)=>a.startAt.toMillis()<b.endAt.toMillis()&&a.endAt.toMillis()>b.startAt.toMillis();
const isActiveBooking=record=>record?.status==='approved'&&record.startAt?.toMillis?.()<=Date.now()&&record.endAt?.toMillis?.()>Date.now();
const canFinishBooking=record=>!!(selected&&currentUser&&isActiveBooking(record)&&
 (record.createdBy===currentUser.uid||selected.ownerUid===currentUser.uid));
function confirmEarlyReturn(record){
 if(!canFinishBooking(record))return false;
 return window.confirm(record.createdBy!==currentUser.uid?
  'החזרה כפויה: אתה עומד לשחרר את הרכב מהזמנה של חבר בית אחר. הפעולה תסיים את ההזמנה ותאפשר לאחרים להזמין את הזמן שנותר. להמשיך?':
  'סיימת להשתמש ברכב והחזרת אותו? השריון ישוחרר מיד והזמן שנותר יהיה פנוי. להמשיך?');
}
async function finishWithConfirmation(record){
 if(!confirmEarlyReturn(record))return;
 await finishApproved(record);
}
function publish(){window.dispatchEvent(new CustomEvent('familyauto:requests',{detail:{houseId:selected?.id||null,records:[...records],schedule:[...schedule]}}))}
function render(){
 list.replaceChildren();if(!selected)return;
 const isOwner=selected.ownerUid===currentUser?.uid;
 const title=document.createElement('p');
 title.textContent='כל הבקשות וההזמנות בבית הפעיל';
 list.append(title);
 if(!records.length){const empty=document.createElement('p');empty.textContent='עדיין אין בקשות בבית הזה.';list.append(empty)}
 for(const r of records){
  const card=document.createElement('div');card.className='booking request-entry';
  const details=document.createElement('div');details.className='request-details';
  const name=document.createElement('strong');name.textContent=r.displayName||'חבר בית';
  const range=document.createElement('small');range.textContent=dateOf(r.startAt).toLocaleString('he-IL')+' – '+dateOf(r.endAt).toLocaleString('he-IL')+(isActiveBooking(r)?' (אפשר לשחרר מוקדם)':'');
  const state=document.createElement('small');state.className='request-state '+r.status;
  state.textContent=({pending:'ממתינה לאישור',approved:'מאושרת',rejected:'נדחתה',cancelled:'בוטלה',ended:'הסתיימה — הרכב שוחרר'})[r.status]||r.status;
  details.append(name,range,state);
  if(r.status==='ended'&&r.endedAt){
   const actual=document.createElement('small');
   actual.textContent='שוחרר בפועל: '+dateOf(r.endedAt).toLocaleString('he-IL')+
    (r.endedBy&&r.endedBy!==r.createdBy?' (על ידי בעל הבית)':'');
   details.append(actual);
  }
  if(r.note){const note=document.createElement('small');note.textContent=r.note;details.append(note)}
  card.append(details);
  const actions=document.createElement('div');actions.className='request-actions';
  if(r.status==='pending'&&isOwner){
   const approve=document.createElement('button');approve.type='button';approve.className='primary';approve.textContent='אישור';
   approve.onclick=()=>perform(approve,()=>approveBooking(r));
   const reject=document.createElement('button');reject.type='button';reject.textContent='דחייה';
   reject.onclick=()=>perform(reject,async()=>{await updateDoc(doc(db,'houses',selected.id,'bookingRequests',r.id),{status:'rejected'});await queueBookingNotification(selected.id,r.id,'rejected')});
   actions.append(approve,reject)
  }
  if(canFinishBooking(r)){
   const finish=document.createElement('button');finish.type='button';finish.className='primary';
   finish.textContent=r.createdBy===currentUser?.uid?'סיימתי — שחררתי את הרכב':'החזרה כפויה — שחרור הרכב';
   finish.onclick=()=>perform(finish,()=>finishWithConfirmation(r));
   actions.append(finish);
  }
  // Future bookings may be cancelled; an active booking is ended instead.
  if((r.status==='pending'&&r.createdBy===currentUser?.uid)||
     (r.status==='approved'&&!r.instantMode&&r.startAt?.toMillis?.()>Date.now()&&
      (isOwner||r.createdBy===currentUser?.uid))){
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent=r.status==='approved'?'ביטול הזמנה':'ביטול בקשה';
   cancel.onclick=()=>perform(cancel,async()=>{if(r.status==='approved')await cancelApproved(r);else{await updateDoc(doc(db,'houses',selected.id,'bookingRequests',r.id),{status:'cancelled'});await queueBookingNotification(selected.id,r.id,'cancelled')}});
   actions.append(cancel)
  }
  if(actions.childElementCount)card.append(actions);
  list.append(card)
 }
}
async function perform(button,action){
 button.disabled=true;
 try{await action();say('השינוי נשמר ומסתנכרן עם חברי הבית.')}
 catch(e){say('הפעולה נכשלה: '+friendlyError(e),true)}
 finally{button.disabled=false}
}
async function approveBooking(record){
 if(!selected||selected.ownerUid!==currentUser?.uid)throw Error('רק בעל הבית רשאי לאשר הזמנות.');
 const hid=selected.id,bookingRef=doc(db,'houses',hid,'bookingRequests',record.id),scheduleRef=doc(db,'houses',hid,'system','schedule');
 await runTransaction(db,async tx=>{
  // Both documents are read before writes; every approval contends on the same schedule document.
  const [bookingSnap,scheduleSnap]=await Promise.all([tx.get(bookingRef),tx.get(scheduleRef)]);
  if(!bookingSnap.exists()||bookingSnap.data().status!=='pending')throw Error('הבקשה כבר טופלה.');
  const booking=bookingSnap.data();
  if(booking.startAt.toMillis()<=Date.now())throw Error('אי אפשר לאשר בקשה שכבר התחילה.');
  const entries=scheduleSnap.exists()?(scheduleSnap.data().reservations||[]):[];
  const active=entries.filter(r=>r.endAt.toMillis()>Date.now());
  if(active.some(r=>overlaps(r,booking)))throw Error('הרכב כבר הוזמן בחלק מטווח הזמן הזה.');
  if(active.length>=80)throw Error('לוח ההזמנות מלא. יש לנקות הזמנות ישנות.');
  tx.set(scheduleRef,{reservations:[...active,{id:record.id,createdBy:booking.createdBy,startAt:booking.startAt,endAt:booking.endAt}],updatedAt:serverTimestamp()});
  tx.update(bookingRef,{status:'approved',approvedBy:currentUser.uid,approvedAt:serverTimestamp()});
 });
 await queueBookingNotification(hid,record.id,'approved');
}
async function cancelApproved(record){
 if(!selected||!(selected.ownerUid===currentUser?.uid||record.createdBy===currentUser?.uid))throw Error('אין הרשאה לבטל הזמנה זו.');
 const hid=selected.id,bookingRef=doc(db,'houses',hid,'bookingRequests',record.id),scheduleRef=doc(db,'houses',hid,'system','schedule');
 await runTransaction(db,async tx=>{
  const [bookingSnap,scheduleSnap]=await Promise.all([tx.get(bookingRef),tx.get(scheduleRef)]);
  if(!bookingSnap.exists()||bookingSnap.data().status!=='approved')throw Error('ההזמנה כבר אינה מאושרת.');
  const entries=scheduleSnap.exists()?(scheduleSnap.data().reservations||[]):[];
  tx.set(scheduleRef,{reservations:entries.filter(r=>r.id!==record.id&&r.endAt.toMillis()>Date.now()),updatedAt:serverTimestamp()});
  tx.update(bookingRef,{status:'cancelled'});
 });
 await queueBookingNotification(hid,record.id,'cancelled');
}
async function startInstant(mode='untilDone',chosenEnd=null){
 if(!selected||!currentUser)throw Error('בחר בית והתחבר.');
 const hid=selected.id,uid=currentUser.uid;
 if(!canInstant())throw Error('אין לך הרשאה לשימוש מיידי ברכב.');
 if(!navigator.onLine)throw Error('יש צורך בחיבור לאינטרנט כדי לתפוס את הרכב.');
 const start=new Date();
 // Open-ended use expires after 24 hours, rather than blocking 30 days.
 const end=instantUseEnd(start,mode,chosenEnd);
 if(!Number.isFinite(end.getTime())||end.getTime()<=start.getTime()+SLOT_MS)
  throw Error('בחר שעת סיום מאוחרת בלפחות 15 דקות.');
 if(end.getTime()>start.getTime()+30*DAY_MS)
  throw Error('הזמנה מוגבלת ל־30 ימים.');
 const scheduleRef=doc(db,'houses',hid,'system','schedule');
 const bookingRef=doc(collection(db,'houses',hid,'bookingRequests'));
 const startAt=Timestamp.fromDate(start),endAt=Timestamp.fromDate(end);
 await runTransaction(db,async tx=>{
  const scheduleSnap=await tx.get(scheduleRef);
  const entries=scheduleSnap.exists()?(scheduleSnap.data().reservations||[]):[];
  const active=entries.filter(r=>r.endAt.toMillis()>Date.now());
  if(active.some(r=>overlaps(r,{startAt,endAt})))throw Error('הרכב כבר מוזמן בטווח הזה. אי אפשר להתחיל שימוש.');
  if(active.length>=80)throw Error('לוח ההזמנות מלא.');
  tx.set(bookingRef,{createdBy:uid,displayName:(currentUser.displayName||currentUser.email||'חבר בית').slice(0,60),
   startAt,endAt,note:'שימוש מיידי ברכב',status:'approved',instantMode:mode,createdAt:serverTimestamp()});
  tx.set(scheduleRef,{reservations:[...active,{id:bookingRef.id,createdBy:uid,startAt,endAt}],updatedAt:serverTimestamp()});
 });
 // Do not keep the 24-hour choice dialog open while the push event is queued.
 // The booking is already committed, so notification delivery can continue in the background.
 void queueBookingNotification(hid,bookingRef.id,'approved').catch(error=>console.warn('FamilyAuto push queue:',error));
}
async function finishApproved(record){
 if(!selected||!currentUser)throw Error('בחר בית והתחבר.');
 const hid=selected.id,uid=currentUser.uid;
 const bookingRef=doc(db,'houses',hid,'bookingRequests',record.id),scheduleRef=doc(db,'houses',hid,'system','schedule');
 await runTransaction(db,async tx=>{
  const [bookingSnap,scheduleSnap]=await Promise.all([tx.get(bookingRef),tx.get(scheduleRef)]);
  if(!bookingSnap.exists())throw Error('ההזמנה לא נמצאה.');
  const booking=bookingSnap.data();
  if(booking.status!=='approved')throw Error('ההזמנה כבר אינה פעילה.');
  if(booking.createdBy!==uid&&selected.ownerUid!==uid)throw Error('רק המזמין או בעל הבית יכולים לשחרר את הרכב.');
  const now=Date.now();
  if(booking.startAt.toMillis()>now||booking.endAt.toMillis()<=now)
   throw Error('אפשר לשחרר מוקדם רק הזמנה פעילה.');
  const entries=scheduleSnap.exists()?(scheduleSnap.data().reservations||[]):[];
  if(!entries.some(r=>r.id===record.id))throw Error('השריון כבר שוחרר.');
  // Booking history and shared availability are updated in one transaction.
  tx.update(bookingRef,{status:'ended',endedAt:serverTimestamp(),endedBy:uid});
  tx.set(scheduleRef,{reservations:entries.filter(r=>r.id!==record.id),updatedAt:serverTimestamp()});
 });
 await queueBookingNotification(hid,record.id,'ended');
}
window.addEventListener('familyauto:finish-active',e=>{
 const record=records.find(r=>r.id===e.detail?.bookingId);
 if(!record||!canFinishBooking(record))return;
 finishWithConfirmation(record).catch(err=>say('שחרור הרכב נכשל: '+friendlyError(err),true));
});
function canBookDirectly(){
 if(!selected||!currentUser||selected.deletedAt)return false;
 if(selected.ownerUid===currentUser.uid)return true;
 const p=permissions[currentUser.uid];
 return p?.role==='authorized'&&(!p.suspendedUntil||p.suspendedUntil.toMillis()<=Date.now());
}
function updateBookingMode(){
 const submit=form.querySelector('button[type=submit]');
 if(submit)submit.textContent=canBookDirectly()?'שמירת הזמנה מאושרת':'שליחת בקשה לאישור';
}
function canInstant(){
 if(!selected||!currentUser||selected.deletedAt)return false;
 if(selected.ownerUid===currentUser.uid)return true;
 const p=permissions[currentUser.uid];
 return p?.canTakeCar===true&&(!p.suspendedUntil||p.suspendedUntil.toMillis()<=Date.now());
}
function updateInstant(){
 $('instantPanel').hidden=!canInstant();
 window.dispatchEvent(new CustomEvent('familyauto:instant-permission',{detail:canInstant()}));
}
$('instantSubmit').addEventListener('click',openInstantDialog);
window.addEventListener('familyauto:permissions',e=>{
 if(!e.detail?.houseId)return;
 permissionCache[e.detail.houseId]=e.detail.settings||{};
 if(e.detail.houseId!==selected?.id)return;
 permissions=permissionCache[selected.id];updateInstant();updateBookingMode()
});
window.addEventListener('familyauto:instant-open',openInstantDialog);
// The home-page shortcut opens this bottom sheet directly; it never navigates
// to Requests. The minute wheel is first in RTL (right), the hour wheel second
// (left). The two wheels reuse the booking picker dimensions and 15-minute slots.
const instantDialog=$('instantChoiceDialog');
// These dialogs are built inside #page-requests, which is display:none on Home.
// A modal opened from Home can otherwise block touches without being visible.
// Move both dialogs to the document body so they are never inside a hidden tab.
document.body.append(picker,instantDialog);
let instantToastTimer;
function showInstantToast(message){
 const toast=$('appToast');
 if(!toast)return;
 toast.textContent=message;toast.hidden=false;
 clearTimeout(instantToastTimer);
 instantToastTimer=setTimeout(()=>{toast.hidden=true},5000);
}
const instantHour=$('instantHour'),instantMinute=$('instantMinute');
const instantWheels=[instantMinute,instantHour];
let instantMode='untilDone',instantDraft=null,instantLock=false,instantSubmitting=false;
function readInstantClock(){
 const indexes=instantWheels.map(w=>Math.max(0,Math.min(
  w.querySelectorAll('.ios-wheel-option').length-1,Math.round(w.scrollTop/ROW))));
 return {minute:indexes[0]*15,hour:indexes[1]};
}
function updateInstantPreview(){
 if(!instantDialog.open||instantSubmitting)return;
 const now=new Date();
 let end;
 if(instantMode==='fixed'){
  const {hour,minute}=readInstantClock();
  end=nextClockEnd(now,hour,minute);
 }else end=instantUseEnd(now,'untilDone');
 instantDraft=end;
 $('instantEndPreview').textContent='סיום השריון: '+dateFormatter.format(end);
 for(const w of instantWheels){
  const selectedIndex=w===instantHour?end.getHours():end.getMinutes()/15;
  w.querySelectorAll('.ios-wheel-option').forEach((el,i)=>{
   el.classList.toggle('ios-wheel-selected',i===selectedIndex);
   el.setAttribute('aria-selected',String(i===selectedIndex));
  });
 }
}
function setInstantMode(mode){
 instantMode=mode;
 $('instantUntilDone').setAttribute('aria-pressed',String(mode==='untilDone'));
 $('instantFixed').setAttribute('aria-pressed',String(mode==='fixed'));
 $('instantTimeFields').hidden=mode!=='fixed';
 if(mode==='fixed'){
  instantLock=true;
  const next=nextQuarter();
  scrollWheelTo(instantHour,next.getHours());
  scrollWheelTo(instantMinute,next.getMinutes()/15);
  requestAnimationFrame(()=>{instantLock=false;updateInstantPreview()});
 }else updateInstantPreview();
}
function openInstantDialog(){
 if(instantSubmitting)return;
 if(!canInstant()){
  showInstantToast('אין לך כרגע הרשאה לשימוש מיידי ברכב. בקש מבעל הבית להפעיל אותה.');
  return;
 }
 if(instantDialog.open)return;
 $('instantChoiceError').hidden=true;
 instantWheels.forEach(w=>{
  w.replaceChildren();
  const spacer=document.createElement('div');spacer.className='ios-wheel-spacer';spacer.setAttribute('aria-hidden','true');
  w.append(spacer);
  const values=w===instantHour?Array.from({length:24},(_,i)=>i):[0,15,30,45];
  for(const [i,n] of values.entries()){
   const option=document.createElement('div');option.className='ios-wheel-option';
   option.textContent=pad(n);option.setAttribute('role','option');
   option.addEventListener('click',()=>scrollWheelTo(w,i,'smooth'));
   w.append(option);
  }
  w.append(spacer.cloneNode());
 });
 try{
  if(typeof instantDialog.showModal==='function')instantDialog.showModal();
  else instantDialog.setAttribute('open','');
 }catch(error){
  // Keep the fixed-position sheet usable if the browser rejects native modal mode.
  instantDialog.setAttribute('open','');
 }
 if(!instantDialog.open){
  showInstantToast('לא ניתן לפתוח את חלונית השימוש. רענן את האפליקציה ונסה שוב.');
  return;
 }
 setInstantMode('untilDone');
}
$('instantUntilDone').addEventListener('click',()=>setInstantMode('untilDone'));
$('instantFixed').addEventListener('click',()=>setInstantMode('fixed'));
$('instantChoiceCancel').addEventListener('click',()=>instantDialog.close());
instantDialog.addEventListener('click',e=>{if(e.target===instantDialog&&!instantSubmitting)instantDialog.close()});
instantDialog.addEventListener('cancel',e=>{if(instantSubmitting)e.preventDefault()});
for(const wheel of instantWheels){
 let settleTimer;
 wheel.addEventListener('scroll',()=>{
  if(instantLock||!instantDialog.open||instantMode!=='fixed')return;
  clearTimeout(settleTimer);
  settleTimer=setTimeout(updateInstantPreview,120);
 },{passive:true});
}
$('instantConfirm').addEventListener('click',async()=>{
 if(instantSubmitting||!canInstant())return;
 const button=$('instantConfirm');
 const error=$('instantChoiceError');
 error.hidden=true;
 const mode=instantMode;
 const chosen=mode==='fixed'?nextClockEnd(new Date(),readInstantClock().hour,readInstantClock().minute):null;
 instantSubmitting=true;button.disabled=true;
 try{
  await startInstant(mode,chosen);
  instantDialog.close();
  say('הרכב שוריין בהצלחה עד '+dateFormatter.format(chosen||instantUseEnd(new Date(),'untilDone')));
 }catch(e){
  error.textContent='לא ניתן לשריין: '+friendlyError(e);
  error.hidden=false;
 }finally{instantSubmitting=false;button.disabled=false}
});
function clear(){
 ++epoch;
 if(stopRequests){stopRequests();stopRequests=null}
 if(stopSchedule){stopSchedule();stopSchedule=null}
 selected=null;records=[];schedule=[];permissions={};form.hidden=true;list.replaceChildren();updateInstant();updateBookingMode();publish()
}
function subscribe(house){
 clear();selected=house;permissions=house?permissionCache[house.id]||{}:{};
 if(!house||!currentUser){say('התחבר ובחר בית כדי ליצור בקשות.');return}
 const generation=epoch;
 form.hidden=false;updateInstant();updateBookingMode();say('טוען נתונים משותפים של '+house.name+'...');
 stopRequests=onSnapshot(collection(db,'houses',house.id,'bookingRequests'),snap=>{
  if(generation!==epoch)return;
  records=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  publish();render();
  say('מחובר לבית '+house.name+' · '+records.length+' בקשות והזמנות');
 },e=>{if(generation===epoch)say('טעינת הבקשות נכשלה: '+friendlyError(e),true)});
 stopSchedule=onSnapshot(doc(db,'houses',house.id,'system','schedule'),snap=>{
  if(generation!==epoch)return;
  schedule=snap.exists()?(snap.data().reservations||[]):[];
  publish()
 },e=>{if(generation===epoch)say('טעינת זמינות הרכב נכשלה: '+friendlyError(e),true)});
}
window.addEventListener('familyauto:house',e=>subscribe(e.detail));
onAuthStateChanged(auth,user=>{
 const changed=currentUser?.uid!==user?.uid;
 currentUser=user;
 if(!user){permissionCache={};clear();say('יש להתחבר כדי לשלוח בקשות.')}else{
  const house=window.familyautoSelectedHouse||selected;
  if(house&&(changed||house.id!==selected?.id))subscribe(house);
 }
});
form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!selected||!currentUser)return say('בחר בית פעיל והתחבר לפני שליחת בקשה.',true);
 const houseId=selected.id,userId=currentUser.uid;
 const data=new FormData(form),start=new Date(String(data.get('start'))),end=new Date(String(data.get('end')));
 if(!Number.isFinite(start.getTime()))return say('לא נבחרו תאריך ושעת התחלה תקינים.',true);
 if(!Number.isFinite(end.getTime()))return say('לא נבחרו תאריך ושעת סיום תקינים.',true);
 if(!isQuarter(start)||!isQuarter(end))return say('יש לבחור שעות בקפיצות של רבע שעה בלבד: 00, 15, 30 או 45 דקות.',true);
 if(start.getTime()<=Date.now())return say('שעת ההתחלה כבר עברה. בחר את רבע השעה הקרובה או שעה מאוחרת יותר.',true);
 if(end.getTime()-start.getTime()<SLOT_MS)return say('משך ההזמנה חייב להיות לפחות 15 דקות. למשל 09:00 עד 09:15.',true);
 if(end.getTime()-start.getTime()>30*86400000)return say('משך ההזמנה לא יכול לעלות על 30 ימים.',true);
 if(!navigator.onLine)return say('אין אינטרנט. הבקשה לא נשלחה; אפשר לנסות שוב כשהחיבור חוזר.',true);
 // Do not let members request time already reserved by an approved booking,
 // including the 24-hour instant-use window. A fresh server read avoids stale UI.
 const submit=form.querySelector('button[type=submit]');submit.disabled=true;say('בודק זמינות ושולח בקשה...');
 try{
  const latestSchedule=await getDoc(doc(db,'houses',houseId,'system','schedule'));
  const reserved=(latestSchedule.exists()?latestSchedule.data().reservations||[]:[])
   .filter(r=>r.endAt?.toMillis?.()>Date.now());
  if(reserved.some(r=>overlaps(r,{startAt:Timestamp.fromDate(start),endAt:Timestamp.fromDate(end)})))
   throw Error('הרכב משוריין בשעות האלה. אפשר להגיש בקשה רק לאחר סיום השריון.');
  const bookingData={
   createdBy:userId,displayName:(currentUser.displayName||currentUser.email||'חבר בית').slice(0,60),
   startAt:Timestamp.fromDate(start),endAt:Timestamp.fromDate(end),
   note:String(data.get('note')||'').trim(),createdAt:serverTimestamp()
  };
  if(canBookDirectly()){
   const scheduleRef=doc(db,'houses',houseId,'system','schedule');
   const bookingRef=doc(collection(db,'houses',houseId,'bookingRequests'));
   try{
    await runTransaction(db,async tx=>{
     const scheduleSnap=await tx.get(scheduleRef);
     const entries=scheduleSnap.exists()?(scheduleSnap.data().reservations||[]):[];
     const active=entries.filter(r=>r.endAt.toMillis()>Date.now());
     if(active.some(r=>overlaps(r,bookingData)))throw Error('הרכב כבר מוזמן בטווח הזמן הזה.');
     if(active.length>=80)throw Error('לוח ההזמנות מלא.');
     tx.set(bookingRef,{...bookingData,status:'approved',approvedBy:userId,approvedAt:serverTimestamp()});
     tx.set(scheduleRef,{reservations:[...active,{id:bookingRef.id,createdBy:userId,startAt:bookingData.startAt,endAt:bookingData.endAt}],updatedAt:serverTimestamp()});
    });
    await queueBookingNotification(houseId,bookingRef.id,'approved');
    say('ההזמנה אושרה ונשמרה ביומן המשותף.');
   }catch(err){
    if(err.code!=='permission-denied')throw err;
    // Keep a pending-request fallback if direct booking is not available.
    const pendingRef=await addDoc(collection(db,'houses',houseId,'bookingRequests'),{...bookingData,status:'pending'});
    await queueBookingNotification(houseId,pendingRef.id,'pending');
    say('נשלחה בקשה לאישור בעל הבית.');
   }
  }else{
   const pendingRef=await addDoc(collection(db,'houses',houseId,'bookingRequests'),{...bookingData,status:'pending'});
   await queueBookingNotification(houseId,pendingRef.id,'pending');
   say('הבקשה נשלחה לאישור בעל הבית ותופיע אצל חברי הבית.');
  }
  form.reset();initTimes();
 }catch(err){say('שליחת הבקשה נכשלה: '+friendlyError(err),true)}
 finally{submit.disabled=false}
});
// A booking can become active without a Firestore change. Re-evaluate early
// return buttons periodically while the app remains open.
setInterval(()=>{if(selected&&currentUser)render()},30_000);
