import {app} from './firebase-config.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,query,where,onSnapshot,addDoc,updateDoc,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const auth=getAuth(app),db=getFirestore(app),root=document.getElementById('requestsRoot');
root.innerHTML='<div class="section-title"><h2>בקשות רכב משותפות</h2><span class="pill">Firestore · בטא</span></div><p id="requestStatus" aria-live="polite">בחר בית כדי להציג בקשות.</p><form id="requestForm" hidden><label>תחילת שימוש<input type="datetime-local" name="start" required></label><label>סיום שימוש<input type="datetime-local" name="end" required></label><label>הערה<input name="note" maxlength="200" placeholder="לא חובה"></label><button class="primary" type="submit">שליחת בקשה לאישור</button></form><div id="requestList"></div><p class="request-warning">בקשות נשמרות בשרת ומסתנכרנות. אישור הזמנות ושמירת הרכב עדיין אינם זמינים, עד שנפעיל מנגנון שרת למניעת התנגשויות.</p>';
const $=id=>document.getElementById(id),status=$('requestStatus'),form=$('requestForm'),list=$('requestList');
let selected=null,unsubscribe=null,records=[];
const say=(s,bad=false)=>{status.textContent=s;status.style.color=bad?'#b3261e':''};
function render(){
 list.replaceChildren();
 if(!selected)return;
 const owner=selected.ownerUid===auth.currentUser?.uid;
 const heading=document.createElement('p');
 heading.textContent=owner?'בקשות שהוגשו לבית (אישור יופעל לאחר השלמת מנגנון מניעת התנגשויות):':'הבקשות שהגשת לבית:';
 list.append(heading);
 if(!records.length){const p=document.createElement('p');p.textContent='אין בקשות להצגה.';list.append(p)}
 for(const record of records){
  const row=document.createElement('div');row.className='booking';
  const details=document.createElement('div');
  const name=document.createElement('strong');name.textContent=record.displayName||'חבר בית';
  const date=document.createElement('small');
  const toDate=t=>t?.toDate?t.toDate():new Date(0);
  date.textContent=toDate(record.startAt).toLocaleString('he-IL')+' – '+toDate(record.endAt).toLocaleString('he-IL');
  const state=document.createElement('small');state.textContent=record.status==='cancelled'?'בוטלה':'ממתינה לאישור';
  details.append(name,date,state);row.append(details);
  if(record.status==='pending'&&record.createdBy===auth.currentUser?.uid){
   const cancel=document.createElement('button');cancel.textContent='ביטול';
   cancel.onclick=async()=>{cancel.disabled=true;try{await updateDoc(doc(db,'houses',selected.id,'bookingRequests',record.id),{status:'cancelled'});say('הבקשה בוטלה.')}catch(e){say('הביטול נכשל: '+(e.code||e.message),true)}finally{cancel.disabled=false}};
   row.append(cancel)
  }
  list.append(row)
 }
}
function clear(){if(unsubscribe){unsubscribe();unsubscribe=null}records=[];window.dispatchEvent(new CustomEvent('familyauto:requests',{detail:[]}));list.replaceChildren();selected=null;form.hidden=true}
window.addEventListener('familyauto:house',e=>{
 clear();selected=e.detail;if(!selected||!auth.currentUser)return;
 form.hidden=false;
 const owner=selected.ownerUid===auth.currentUser.uid;
 const ref=collection(db,'houses',selected.id,'bookingRequests');
 const q=owner?query(ref):query(ref,where('createdBy','==',auth.currentUser.uid));
 unsubscribe=onSnapshot(q,snap=>{
  records=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  say(owner?'יש לך '+records.filter(x=>x.status==='pending').length+' בקשות ממתינות.':'בקשות הבית מסונכרנות בזמן אמת.');
  window.dispatchEvent(new CustomEvent('familyauto:requests',{detail:records}));render()
 },e=>say('טעינת בקשות נכשלה: '+(e.code||e.message)+'. בדוק כללי Firestore.',true))
});
window.addEventListener('familyauto:signout',()=>{clear();say('התחבר ובחר בית כדי לראות בקשות.')});
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!selected||!auth.currentUser)return;
 const data=new FormData(form),start=new Date(String(data.get('start'))),end=new Date(String(data.get('end')));
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start.getTime()<=Date.now()||end<=start||end-start>30*86400000)return say('יש לבחור טווח עתידי תקין שאינו ארוך מ־30 ימים.',true);
 if(!navigator.onLine)return say('אין חיבור לאינטרנט. הבקשה לא נשלחה ולא נשמרה לתור אופליין עדיין.',true);
 const button=form.querySelector('button[type="submit"]');button.disabled=true;
 try{
  await addDoc(collection(db,'houses',selected.id,'bookingRequests'),{
   createdBy:auth.currentUser.uid,displayName:(auth.currentUser.displayName||auth.currentUser.email||'חבר בית').slice(0,60),
   startAt:Timestamp.fromDate(start),endAt:Timestamp.fromDate(end),note:String(data.get('note')||'').trim(),status:'pending',createdAt:serverTimestamp()
  });
  form.reset();say('הבקשה נשלחה לשרת ונשמרה במצב ממתין לאישור.')
 }catch(e){say('שליחת הבקשה נכשלה: '+(e.code||e.message),true)}
 finally{button.disabled=false}
});