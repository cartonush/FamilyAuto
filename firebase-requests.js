import {app} from './firebase-config.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,addDoc,updateDoc,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const auth=getAuth(app),db=getFirestore(app),root=document.getElementById('requestsRoot');
root.innerHTML=`<div class="section-title"><h2>בקשות והזמנות</h2><span class="pill">גרסה 1.9</span></div>
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
<div class="ios-wheel" id="iosHour" role="listbox" aria-label="שעה"></div>
<div class="ios-wheel" id="iosMinute" role="listbox" aria-label="דקות"></div>
</div></div>
<p id="iosPickerHint" class="ios-picker-hint" aria-live="polite"></p>
</dialog>
<section id="instantPanel" class="instant-panel" hidden><h3>הרכב אצלי</h3><p>שימוש מיידי ברכב, בהתאם להרשאה שבעל הבית העניק לך.</p>
<label class="instant-option"><input type="radio" name="instantMode" value="untilDone" checked> עד שאני מסיים — אסיים ידנית באפליקציה</label>
<label class="instant-option"><input type="radio" name="instantMode" value="fixed"> עד שעת הסיום שבחרתי למעלה</label>
<p class="muted">במצב ״עד שאני מסיים״ נשמרת חסימה זמנית של עד 30 יום. יש ללחוץ על ״סיימתי״ כשמחזירים את הרכב. הזמנות חופפות ימנעו התחלת שימוש.</p>
<button type="button" class="primary wide" id="instantSubmit">הרכב אצלי — התחל שימוש</button></section><div id="requestList"></div>
<p class="request-warning">זוהי גרסת בדיקה. בקשות ואישורים מסתנכרנים בין חברי הבית. לפני שימוש אמיתי ברכב יש לוודא את הזמינות עם המשפחה.</p>`;
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
const wheels=[dayWheel,hourWheel,minuteWheel];
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
 draft=closestAllowed(selectedDate(indexes[0],indexes[1],indexes[2]*15));
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
 if(code==='permission-denied')return 'אין הרשאה ב־Firestore. ודא שכללי firestore.rules המעודכנים פורסמו ושהמשתמש קיבל הרשאה מתאימה.';
 if(code==='unavailable')return 'אין חיבור זמין ל־Firebase. נסה שוב כשיש אינטרנט.';
 if(code==='failed-precondition')return 'פעולת ההזמנה לא הושלמה. נסה שוב, ייתכן שהרכב הוזמן במקביל.';
 return code||e?.message||'שגיאה לא ידועה';
};
const dateOf=v=>v?.toDate?v.toDate():new Date(0);
const overlaps=(a,b)=>a.startAt.toMillis()<b.endAt.toMillis()&&a.endAt.toMillis()>b.startAt.toMillis();
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
  const range=document.createElement('small');range.textContent=dateOf(r.startAt).toLocaleString('he-IL')+' – '+(r.instantMode==='untilDone'&&r.status==='approved'?'עד שאסיים (יש לסיים ידנית)':dateOf(r.endAt).toLocaleString('he-IL'));
  const state=document.createElement('small');state.className='request-state '+r.status;
  state.textContent=({pending:'ממתינה לאישור',approved:'מאושרת',rejected:'נדחתה',cancelled:'בוטלה'})[r.status]||r.status;
  details.append(name,range,state);
  if(r.note){const note=document.createElement('small');note.textContent=r.note;details.append(note)}
  card.append(details);
  const actions=document.createElement('div');actions.className='request-actions';
  if(r.status==='pending'&&isOwner){
   const approve=document.createElement('button');approve.type='button';approve.className='primary';approve.textContent='אישור';
   approve.onclick=()=>perform(approve,()=>approveBooking(r));
   const reject=document.createElement('button');reject.type='button';reject.textContent='דחייה';
   reject.onclick=()=>perform(reject,()=>updateDoc(doc(db,'houses',selected.id,'bookingRequests',r.id),{status:'rejected'}));
   actions.append(approve,reject)
  }
  if(r.status==='approved'&&r.instantMode&&(r.createdBy===currentUser?.uid||isOwner)){
   const finish=document.createElement('button');finish.type='button';finish.className='primary';finish.textContent='סיימתי — החזרתי את הרכב';finish.onclick=()=>perform(finish,()=>finishInstant(r));actions.append(finish);
  }
  if((r.status==='pending'&&r.createdBy===currentUser?.uid)||(r.status==='approved'&&isOwner&&!r.instantMode)){
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent=r.status==='approved'?'ביטול הזמנה':'ביטול בקשה';
   cancel.onclick=()=>perform(cancel,()=>r.status==='approved'?cancelApproved(r):updateDoc(doc(db,'houses',selected.id,'bookingRequests',r.id),{status:'cancelled'}));
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
}
async function cancelApproved(record){
 if(!selected||selected.ownerUid!==currentUser?.uid)throw Error('רק בעל הבית יכול לבטל הזמנה מאושרת.');
 const hid=selected.id,bookingRef=doc(db,'houses',hid,'bookingRequests',record.id),scheduleRef=doc(db,'houses',hid,'system','schedule');
 await runTransaction(db,async tx=>{
  const [bookingSnap,scheduleSnap]=await Promise.all([tx.get(bookingRef),tx.get(scheduleRef)]);
  if(!bookingSnap.exists()||bookingSnap.data().status!=='approved')throw Error('ההזמנה כבר אינה מאושרת.');
  const entries=scheduleSnap.exists()?(scheduleSnap.data().reservations||[]):[];
  tx.set(scheduleRef,{reservations:entries.filter(r=>r.id!==record.id&&r.endAt.toMillis()>Date.now()),updatedAt:serverTimestamp()});
  tx.update(bookingRef,{status:'cancelled'});
 });
}
async function startInstant(){
 if(!selected||!currentUser)throw Error('בחר בית והתחבר.');
 const hid=selected.id,uid=currentUser.uid;
 if(!canInstant())throw Error('אין לך הרשאה לשימוש מיידי ברכב.');
 if(!navigator.onLine)throw Error('יש צורך בחיבור לאינטרנט כדי לתפוס את הרכב.');
 const mode=document.querySelector('input[name="instantMode"]:checked')?.value||'untilDone';
 const start=new Date();
 const chosenEnd=new Date(endInput.value);
 const end=mode==='untilDone'?new Date(start.getTime()+30*DAY_MS):chosenEnd;
 if(!Number.isFinite(end.getTime())||end.getTime()<=start.getTime()+SLOT_MS)throw Error('בחר שעת סיום מאוחרת בלפחות 15 דקות.');
 if(end.getTime()>start.getTime()+30*DAY_MS)throw Error('הזמנה מוגבלת ל־30 ימים.');
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
}
async function finishInstant(record){
 const hid=selected.id,uid=currentUser.uid;
 if(record.createdBy!==uid&&selected.ownerUid!==uid)throw Error('אין הרשאה לסיים שימוש זה.');
 const bookingRef=doc(db,'houses',hid,'bookingRequests',record.id),scheduleRef=doc(db,'houses',hid,'system','schedule');
 await runTransaction(db,async tx=>{
  const [bookingSnap,scheduleSnap]=await Promise.all([tx.get(bookingRef),tx.get(scheduleRef)]);
  if(!bookingSnap.exists()||bookingSnap.data().status!=='approved')throw Error('השימוש כבר הסתיים.');
  const entries=scheduleSnap.exists()?(scheduleSnap.data().reservations||[]):[];
  tx.update(bookingRef,{status:'ended',endedAt:serverTimestamp()});
  tx.set(scheduleRef,{reservations:entries.filter(r=>r.id!==record.id),updatedAt:serverTimestamp()});
 });
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
$('instantSubmit').addEventListener('click',()=>perform($('instantSubmit'),startInstant));
window.addEventListener('familyauto:permissions',e=>{
 if(!e.detail?.houseId)return;
 permissionCache[e.detail.houseId]=e.detail.settings||{};
 if(e.detail.houseId!==selected?.id)return;
 permissions=permissionCache[selected.id];updateInstant()
});
window.addEventListener('familyauto:instant-open',()=>{
 if(!canInstant())return;
 $('instantPanel').scrollIntoView({behavior:'smooth',block:'start'});
});
function clear(){
 ++epoch;
 if(stopRequests){stopRequests();stopRequests=null}
 if(stopSchedule){stopSchedule();stopSchedule=null}
 selected=null;records=[];schedule=[];permissions={};form.hidden=true;list.replaceChildren();updateInstant();publish()
}
function subscribe(house){
 clear();selected=house;permissions=house?permissionCache[house.id]||{}:{};
 if(!house||!currentUser){say('התחבר ובחר בית כדי ליצור בקשות.');return}
 const generation=epoch;
 form.hidden=false;updateInstant();say('טוען נתונים משותפים של '+house.name+'...');
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
 if(!user){permissionCache={};clear();say('יש להתחבר כדי לשלוח בקשות.')}else if(changed&&selected){subscribe(selected)}
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
 const submit=form.querySelector('button[type=submit]');submit.disabled=true;say('שולח את הבקשה ל־Firestore...');
 try{
  await addDoc(collection(db,'houses',houseId,'bookingRequests'),{
   createdBy:userId,displayName:(currentUser.displayName||currentUser.email||'חבר בית').slice(0,60),
   startAt:Timestamp.fromDate(start),endAt:Timestamp.fromDate(end),
   note:String(data.get('note')||'').trim(),status:'pending',createdAt:serverTimestamp()
  });
  form.reset();initTimes();say('הבקשה נשלחה ונשמרה ב־Firestore. היא תופיע אצל חברי הבית.')
 }catch(err){say('שליחת הבקשה נכשלה: '+friendlyError(err),true)}
 finally{submit.disabled=false}
});
