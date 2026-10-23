import {app} from './firebase-config.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,addDoc,updateDoc,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const auth=getAuth(app),db=getFirestore(app),root=document.getElementById('requestsRoot');
root.innerHTML=`<div class="section-title"><h2>בקשות והזמנות</h2><span class="pill">גרסה 1.5</span></div>
<p id="requestStatus" aria-live="polite">התחבר ובחר בית כדי להתחיל.</p>
<form id="requestForm" hidden>
<label>תחילת שימוש<input type="datetime-local" name="start" required></label><button type="button" id="startNowBtn" class="text-action">התחל עכשיו</button><small id="startHint">אפשר לבחור שעה עתידית או ללחוץ על ״התחל עכשיו״.</small>
<label>סיום שימוש<input type="datetime-local" name="end" required></label>
<label>הערה (לא חובה)<input name="note" maxlength="200" placeholder="לאן נוסעים?"></label>
<button class="primary" type="submit">שליחת בקשה</button>
</form>
<div id="requestList"></div>
<p class="request-warning">זוהי גרסת בדיקה. בקשות ואישורים מסתנכרנים בין חברי הבית. לפני שימוש אמיתי ברכב יש לוודא את הזמינות עם המשפחה.</p>`;
const $=id=>document.getElementById(id),status=$('requestStatus'),form=$('requestForm'),list=$('requestList');
const startInput=form.elements.start,endInput=form.elements.end;
const localDateTime=date=>{
 const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return d.toISOString().slice(0,16);
};
const minStart=()=>new Date(Date.now()+2*60000);
function updateStartMin(){
 startInput.min=localDateTime(minStart());
}
$('startNowBtn').addEventListener('click',()=>{
 const start=minStart();
 startInput.value=localDateTime(start);
 const currentEnd=new Date(endInput.value);
 if(!endInput.value||!Number.isFinite(currentEnd.getTime())||currentEnd<=start){
  endInput.value=localDateTime(new Date(start.getTime()+24*3600000));
 }
 say('שעת ההתחלה נקבעה לעוד שתי דקות, כדי לאפשר שליחה תקינה לשרת.');
});
startInput.addEventListener('focus',updateStartMin);
form.addEventListener('focusin',updateStartMin);
updateStartMin();

let selected=null,stopRequests=null,stopSchedule=null,records=[],schedule=[],currentUser=null,epoch=0;
const say=(message,error=false)=>{status.textContent=message;status.style.color=error?'#b3261e':''};
const friendlyError=e=>{
 const code=e?.code||'';
 if(code==='permission-denied')return 'אין הרשאה ב־Firestore. יש לפרסם את כללי firestore.rules של גרסה 1.5 ב־Firebase Console.';
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
  const range=document.createElement('small');range.textContent=dateOf(r.startAt).toLocaleString('he-IL')+' – '+dateOf(r.endAt).toLocaleString('he-IL');
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
  if((r.status==='pending'&&r.createdBy===currentUser?.uid)||(r.status==='approved'&&isOwner)){
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
function clear(){
 ++epoch;
 if(stopRequests){stopRequests();stopRequests=null}
 if(stopSchedule){stopSchedule();stopSchedule=null}
 selected=null;records=[];schedule=[];form.hidden=true;list.replaceChildren();publish()
}
function subscribe(house){
 clear();selected=house;
 if(!house||!currentUser){say('התחבר ובחר בית כדי ליצור בקשות.');return}
 const generation=epoch;
 form.hidden=false;say('טוען נתונים משותפים של '+house.name+'...');
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
 currentUser=user;
 if(!user){clear();say('יש להתחבר כדי לשלוח בקשות.')}
});
form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!selected||!currentUser)return say('בחר בית פעיל והתחבר לפני שליחת בקשה.',true);
 const houseId=selected.id,userId=currentUser.uid;
 const data=new FormData(form),start=new Date(String(data.get('start'))),end=new Date(String(data.get('end')));
 if(!Number.isFinite(start.getTime()))return say('לא נבחרו תאריך ושעת התחלה תקינים.',true);
 if(!Number.isFinite(end.getTime()))return say('לא נבחרו תאריך ושעת סיום תקינים.',true);
 if(start.getTime()<=Date.now()+10000)return say('שעת ההתחלה חייבת להיות בעתיד. להזמנה מהיום למחר לחץ על ״התחל עכשיו״, או בחר שעה מאוחרת יותר היום.',true);
 if(end.getTime()<=start.getTime())return say('שעת הסיום חייבת להיות אחרי שעת ההתחלה.',true);
 if(end.getTime()-start.getTime()>30*86400000)return say('משך ההזמנה לא יכול לעלות על 30 ימים.',true);
 if(!navigator.onLine)return say('אין אינטרנט. הבקשה לא נשלחה; אפשר לנסות שוב כשהחיבור חוזר.',true);
 const submit=form.querySelector('button[type=submit]');submit.disabled=true;say('שולח את הבקשה ל־Firestore...');
 try{
  await addDoc(collection(db,'houses',houseId,'bookingRequests'),{
   createdBy:userId,displayName:(currentUser.displayName||currentUser.email||'חבר בית').slice(0,60),
   startAt:Timestamp.fromDate(start),endAt:Timestamp.fromDate(end),
   note:String(data.get('note')||'').trim(),status:'pending',createdAt:serverTimestamp()
  });
  form.reset();say('הבקשה נשלחה ונשמרה ב־Firestore. היא תופיע אצל חברי הבית.')
 }catch(err){say('שליחת הבקשה נכשלה: '+friendlyError(err),true)}
 finally{submit.disabled=false}
});
