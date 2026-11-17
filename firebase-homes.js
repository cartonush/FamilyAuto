import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,setDoc,updateDoc,query,where,onSnapshot,serverTimestamp,arrayUnion,writeBatch,getDocs} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {app} from './firebase-config.js';
import {queueJoinNotification} from './firebase-notification-queue.js';
const auth=getAuth(app),db=getFirestore(app),root=document.getElementById('homesRoot');
const WORKER_URL='https://familyauto.roisuissa6.workers.dev';
async function transferOwnershipOnWorker(houseId,successorUid){
 const token=await auth.currentUser.getIdToken();
 const response=await fetch(WORKER_URL+'/account/transfer',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({houseId,successorUid})
 });
 if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.error||'HTTP '+response.status)}
 return response.json();
}
async function deleteHouseOnWorker(houseId,confirmName){
 const token=await auth.currentUser.getIdToken();
 const response=await fetch(WORKER_URL+'/account/delete',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({houseId,confirmName})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'HTTP '+response.status);
 return result;
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stopHouses=null,stopRequests=null,currentHouse=null,houses=[],user=null,housesLoaded=false,houseLoadError=null,housePickerDialog=null,housePickerBody=null,recentlyCreatedHouse=null;
root.innerHTML='<div class="section-title"><h2>הבתים שלי</h2><span class="pill">בתים משותפים</span></div><p id="houseInfo">התחבר כדי לנהל בתים משותפים.</p><div id="houseControls" hidden><form id="createHouseForm"><label>שם בית חדש<input name="houseName" maxlength="25" required placeholder="לדוגמה: הבית שלנו"></label><button class="primary">יצירת בית</button></form><form id="joinHouseForm"><label>קוד הזמנה לבית<input name="houseCode" maxlength="32" minlength="32" required autocomplete="off" placeholder="הדבק קוד שקיבלת"></label><button>בקשת הצטרפות</button></form><div id="houseList"></div><div id="houseDetails"></div></div>';
const readableError=e=>{
 if(e?.code==='permission-denied')return 'הפעולה לא אושרה. בדוק שאתה מחובר ושיש לך הרשאה מתאימה.';
 if(e?.code==='unavailable'||e?.code==='network-request-failed')return 'אין חיבור לשרת. בדוק את החיבור לאינטרנט ונסה שוב.';
 if(e?.code==='not-found')return 'הבית או הבקשה לא נמצאו. רענן את האפליקציה ונסה שוב.';
 return 'הפעולה נכשלה. נסה שוב.';
};
const $=id=>document.getElementById(id),info=(msg,error=false)=>{$('houseInfo').textContent=msg;$('houseInfo').style.color=error?'#b3261e':''};
function code(){const bytes=crypto.getRandomValues(new Uint8Array(16));return [...bytes].map(n=>n.toString(16).padStart(2,'0')).join('')}
function refreshHousePicker(){
 if(!housePickerDialog?.open||!housePickerBody)return;
 housePickerBody.replaceChildren();
 if(!user){const p=document.createElement('p');p.textContent='יש להתחבר לחשבון כדי לבחור בית.';housePickerBody.append(p);return}
 if(!housesLoaded){const p=document.createElement('p');p.textContent='טוען את הבתים שלך…';housePickerBody.append(p);return}
 if(houseLoadError){const p=document.createElement('p');p.textContent='לא ניתן לטעון את הבתים: '+houseLoadError;housePickerBody.append(p);return}
 const available=houses.filter(h=>!h.deletedAt);
 if(!available.length){
  const p=document.createElement('p');p.textContent='לא נמצאו בתים מאושרים שאתה חבר בהם. אפשר ליצור בית או להצטרף לבית דרך ניהול בתים.';
  const manage=document.createElement('button');manage.type='button';manage.className='primary';manage.textContent='ניהול בתים';manage.onclick=()=>{housePickerDialog?.close();document.querySelector('[data-goto="settings-houses"]')?.click()};
  housePickerBody.append(p,manage);return;
 }
 for(const h of available){
  const button=document.createElement('button');button.type='button';button.className='house-picker-option'+(currentHouse===h.id?' active':'');
  button.textContent=h.name+(currentHouse===h.id?' ✓':'');button.onclick=()=>{selectHouse(h.id);housePickerDialog?.close()};housePickerBody.append(button);
 }
}
function openHousePicker(){
 if(housePickerDialog?.open){refreshHousePicker();return}
 const dialog=document.createElement('dialog');dialog.className='house-picker-dialog';
 const title=document.createElement('h2');title.textContent='בחירת בית';
 const body=document.createElement('div');body.className='house-picker-options';
 const close=document.createElement('button');close.type='button';close.textContent='סגירה';close.onclick=()=>dialog.close();
 dialog.append(title,body,close);document.body.append(dialog);housePickerDialog=dialog;housePickerBody=body;
 dialog.addEventListener('close',()=>{dialog.remove();if(housePickerDialog===dialog){housePickerDialog=null;housePickerBody=null}});
 try{dialog.showModal()}catch{dialog.setAttribute('open','')};refreshHousePicker();
}
window.addEventListener('familyauto:open-house-picker',openHousePicker);
async function permanentlyDeleteHouse(h){
 if(!h.deletedAt||h.ownerUid!==user?.uid)return;
 const dialog=document.createElement('dialog');dialog.className='house-permanent-dialog';dialog.setAttribute('aria-labelledby','permanentDeleteTitle');
 const title=document.createElement('h2');title.id='permanentDeleteTitle';title.textContent='מחיקה לצמיתות של '+h.name;
 const explanation=document.createElement('p');explanation.textContent='המחיקה תמחק לצמיתות את הבית, החברים וההרשאות שלהם, בקשות ההצטרפות, ההזמנות וההיסטוריה. אי אפשר לשחזר את הנתונים.';
 const memberList=document.createElement('ul');memberList.setAttribute('aria-label','חברי הבית וההרשאות שיימחקו');
 const loading=document.createElement('p');loading.className='muted';loading.textContent='טוען את חברי הבית וההרשאות…';
 const input=document.createElement('input');input.type='text';input.autocomplete='off';input.placeholder='הקלד את שם הבית בדיוק';input.setAttribute('aria-label','הקלד את שם הבית לאישור המחיקה');input.dir='auto';
 const error=document.createElement('p');error.className='muted';error.setAttribute('role','status');
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='ביטול';
 const next=document.createElement('button');next.type='button';next.className='danger-action';next.textContent='המשך לאישור נוסף';next.disabled=true;
 const actions=document.createElement('div');actions.className='actions';actions.append(cancel,next);
 dialog.append(title,explanation,loading,memberList,input,error,actions);document.body.append(dialog);
 const finish=()=>{dialog.close();dialog.remove()};
 cancel.onclick=finish;dialog.addEventListener('cancel',e=>{e.preventDefault();finish()});
 try{dialog.showModal()}catch{dialog.setAttribute('open','')}
 try{
  const snapshot=await getDocs(collection(db,'houses',h.id,'memberSettings'));
  const settings={};snapshot.forEach(d=>settings[d.id]=d.data());memberList.replaceChildren();
  for(const uid of h.memberIds||[]){
   const setting=settings[uid]||{},item=document.createElement('li');
   const role=uid===h.ownerUid?'בעל הבית':setting.role==='authorized'?'מורשה':'רגיל';
   const permission=setting.canTakeCar?' · מורשה ל״הרכב אצלי״':'';
   item.textContent=(setting.displayName||'חבר בית')+' — '+role+permission;memberList.append(item);
  }
  loading.remove();
 }catch(e){loading.textContent='לא ניתן לטעון את רשימת החברים וההרשאות. נסה שוב.';error.textContent=readableError(e);input.disabled=true;next.disabled=true;return}
 input.addEventListener('input',()=>{next.disabled=input.value!==h.name});
 next.onclick=()=>{
  if(input.value!==h.name)return;
  const prompt=document.createElement('p');prompt.textContent='אישור נוסף: למחוק את הבית ואת כל נתוניו לצמיתות?';
  const back=document.createElement('button');back.type='button';back.textContent='חזרה';
  const confirmButton=document.createElement('button');confirmButton.type='button';confirmButton.className='danger-action';confirmButton.textContent='כן, למחוק לצמיתות';
  const finalActions=document.createElement('div');finalActions.className='actions';finalActions.append(back,confirmButton);
  dialog.replaceChildren(title,explanation,memberList,prompt,finalActions);
  back.onclick=()=>{dialog.replaceChildren(title,explanation,memberList,input,error,actions);input.value='';next.disabled=true};
  confirmButton.onclick=async()=>{
   confirmButton.disabled=true;back.disabled=true;
   try{
    await deleteHouseOnWorker(h.id,h.name);
    if(user)localStorage.removeItem('familyauto-house-'+user.uid);
    currentHouse=null;if(stopRequests){stopRequests();stopRequests=null}publishHouse(null);$('houseDetails').replaceChildren();info('הבית וכל חבריו, ההרשאות וההיסטוריה נמחקו לצמיתות.');finish();render();
   }catch(e){info('מחיקת הבית נכשלה: '+readableError(e),true);error.textContent='המחיקה לא הושלמה. '+readableError(e);dialog.replaceChildren(title,explanation,memberList,error,finalActions);confirmButton.disabled=false;back.disabled=false}
  };
 };
}
function render(){const list=$('houseList');list.replaceChildren();const active=houses.filter(h=>!h.deletedAt),deleted=houses.filter(h=>h.deletedAt);if(!active.length&&!deleted.length){const p=document.createElement('p');p.textContent='אין לך עדיין בתים מאושרים.';list.append(p)}const addGroup=(title,items)=>{if(!items.length)return;const heading=document.createElement('h3');heading.textContent=title;list.append(heading);for(const h of items){const b=document.createElement('button');const role=h.ownerUid===user?.uid?'אתה בעל הבית':'חבר בית';b.textContent=h.name+' · '+role+(currentHouse===h.id?' ✓':'');b.className=currentHouse===h.id?'primary':'';b.onclick=()=>selectHouse(h.id);list.append(b)}};addGroup('הבתים שלי',active);addGroup('בתים שנמחקו — שחזור או מחיקה לצמיתות',deleted);if(currentHouse&&!houses.some(h=>h.id===currentHouse)){currentHouse=null;publishHouse(null);$('houseDetails').replaceChildren();if(stopRequests){stopRequests();stopRequests=null}}}
function publishHouse(h){window.familyautoSelectedHouse=h||null;window.dispatchEvent(new CustomEvent('familyauto:house',{detail:h||null}))}
function selectHouse(id){if(stopRequests){stopRequests();stopRequests=null}currentHouse=id;if(user)localStorage.setItem('familyauto-house-'+user.uid,id);render();const h=houses.find(h=>h.id===id);if(!h)return;publishHouse(h.deletedAt?null:h);const details=$('houseDetails');details.replaceChildren();const heading=document.createElement('h3');heading.textContent=h.name;const role=document.createElement('p');role.textContent=h.ownerUid===user.uid?'התפקיד שלך: בעל הבית':'התפקיד שלך: חבר בית';const label=document.createElement('p');label.textContent='קוד הזמנה: '+h.id;const copy=document.createElement('button');copy.textContent='העתקת קוד';copy.onclick=()=>navigator.clipboard.writeText(h.id).then(()=>info('הקוד הועתק. אפשר לשלוח אותו לבן משפחה.')).catch(()=>info('לא ניתן להעתיק. אפשר להעתיק את הקוד ידנית.',true));details.append(heading,role,label,copy);if(h.ownerUid===user.uid){
 if((h.memberIds||[]).length>1&&!h.deletedAt){
  const transfer=document.createElement('div');transfer.className='house-deletion';
  const title=document.createElement('h3');title.textContent='העברת ניהול הבית';
  const description=document.createElement('p');description.className='muted';
  description.textContent='לפני מחיקת החשבון שלך, יש לבחור מנהל חדש לכל בית שאתה מנהל.';
  const chooserLabel=document.createElement('label');chooserLabel.className='ownership-transfer-label';chooserLabel.textContent='בחר את חבר הבית שיקבל את הבעלות';
  const chooser=document.createElement('select');chooser.className='ownership-transfer-select';chooser.setAttribute('aria-label','בחירת מנהל חדש');chooser.disabled=true;
  const loading=document.createElement('option');loading.value='';loading.textContent='טוען את חברי הבית…';chooser.append(loading);chooserLabel.append(chooser);
  const candidates=h.memberIds.filter(uid=>uid!==user.uid);
  getDocs(collection(db,'houses',id,'memberSettings')).then(snapshot=>{
   const names={};snapshot.forEach(d=>names[d.id]=d.data().displayName);
   chooser.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='בחר חבר בית';chooser.append(placeholder);
   for(const uid of candidates){const option=document.createElement('option');option.value=uid;option.textContent=names[uid]||'חבר בית '+uid.slice(0,8);chooser.append(option)}
   chooser.disabled=candidates.length===0;
  }).catch(()=>{
   chooser.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='בחר חבר בית';chooser.append(placeholder);
   for(const uid of candidates){const option=document.createElement('option');option.value=uid;option.textContent='חבר בית '+uid.slice(0,8);chooser.append(option)}
   chooser.disabled=candidates.length===0;
  });
  const button=document.createElement('button');button.type='button';button.textContent='העברת בעלות';button.className='primary';
  button.onclick=async()=>{
   const chosen=chooser.value;
   if(!chosen||!confirm('להעביר את ניהול הבית ״'+h.name+'״ לחבר שנבחר? הפעולה תסיר ממך את הרשאות המנהל.'))return;
   button.disabled=true;
   try{await transferOwnershipOnWorker(id,chosen);try{const updated=await getDoc(doc(db,'houses',id));if(updated.exists()){houses=houses.map(item=>item.id===id?{id:updated.id,...updated.data()}:item);selectHouse(id)}}catch{}info('הבעלות הועברה. אתה נשאר חבר בבית, והמשתמש שנבחר הוא כעת בעל הבית.') }
   catch(e){info('העברת הבעלות נכשלה: '+readableError(e),true)}
   finally{button.disabled=false}
  };
  transfer.append(title,description,chooserLabel,button);details.append(transfer);
 }
 const deletion=document.createElement('div');deletion.className='house-deletion';
 const deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.className='danger-action';
 deleteButton.textContent=h.deletedAt?'שחזור הבית':'מחיקת בית';
 const deletionInfo=document.createElement('p');deletionInfo.className='muted';deletionInfo.textContent=h.deletedAt?'הבית מסומן למחיקה. ניתן לשחזר אותו בתוך שבעה ימים.':'מחיקה מעבירה את הבית לאזור שחזור למשך שבעה ימים.';
 deleteButton.onclick=async()=>{
  if(!h.deletedAt&&!confirm('למחוק את הבית ״'+h.name+'״? ניתן לשחזר אותו במשך 7 ימים.'))return;
  deleteButton.disabled=true;
  try{await updateDoc(doc(db,'houses',id),{deletedAt:h.deletedAt?null:serverTimestamp()});info(h.deletedAt?'הבית שוחזר.':'הבית הועבר למחיקה וניתן לשחזרו במשך שבעה ימים.')}
  catch(e){info('שינוי מצב הבית נכשל: '+readableError(e),true)}finally{deleteButton.disabled=false}
 };
 deletion.append(deletionInfo,deleteButton);details.append(deletion);
 if(h.deletedAt){
  const permanent=document.createElement('button');permanent.type='button';permanent.className='danger-action';
  permanent.textContent='מחיקת הבית לצמיתות';permanent.onclick=()=>permanentlyDeleteHouse(h);details.append(permanent);
 }
 const pending=document.createElement('div');details.append(pending);stopRequests=onSnapshot(query(collection(db,'houses',id,'joinRequests'),where('status','==','pending')),snap=>{pending.replaceChildren();const title=document.createElement('h3');title.textContent='בקשות הצטרפות ('+snap.size+')';pending.append(title);snap.forEach(req=>{const row=document.createElement('div');row.className='booking';const name=document.createElement('strong');name.textContent=req.data().displayName||'משתמש';const approve=document.createElement('button');approve.textContent='אישור';approve.className='primary';approve.onclick=async()=>{approve.disabled=true;try{const b=writeBatch(db);b.update(doc(db,'houses',id),{memberIds:arrayUnion(req.id)});b.update(req.ref,{status:'accepted'});b.set(doc(db,'houses',id,'memberSettings',req.id),{displayName:String(req.data().displayName||'חבר בית').slice(0,60),role:'user',canTakeCar:false,suspendedUntil:null,updatedAt:serverTimestamp()});await b.commit();await queueJoinNotification(id,req.id,'accepted');info('המשתמש נוסף לבית')}catch(e){info('האישור נכשל: '+readableError(e),true)}finally{approve.disabled=false}};const reject=document.createElement('button');reject.textContent='דחייה';reject.onclick=async()=>{reject.disabled=true;try{await updateDoc(req.ref,{status:'rejected'});await queueJoinNotification(id,req.id,'rejected');info('בקשת ההצטרפות נדחתה.')}catch(e){info('דחיית הבקשה נכשלה: '+readableError(e),true)}finally{reject.disabled=false}};row.append(name,approve,reject);pending.append(row)})},e=>{if(houses.find(item=>item.id===id)?.ownerUid!==user?.uid)return;info('לא ניתן לקרוא בקשות: '+readableError(e),true)})}else if(stopRequests){stopRequests();stopRequests=null}}
$('createHouseForm').onsubmit=async e=>{e.preventDefault();if(!user)return;const form=e.currentTarget;const name=String(new FormData(form).get('houseName')||'').trim();if(!name||name.length>25)return info('שם הבית חייב להכיל 1–25 תווים.',true);const id=code();try{await setDoc(doc(db,'houses',id),{name,ownerUid:user.uid,memberIds:[user.uid],createdAt:serverTimestamp()});const created={id,name,ownerUid:user.uid,memberIds:[user.uid]};houses=[...houses.filter(h=>h.id!==id),created];currentHouse=id;recentlyCreatedHouse=id;form.reset();render();selectHouse(id);info('הבית נוצר בהצלחה. אפשר להעתיק את קוד ההזמנה.')}catch(err){info(readableError(err),true)}};
$('joinHouseForm').onsubmit=async e=>{
 e.preventDefault();if(!user)return;
 const form=e.currentTarget,id=String(new FormData(form).get('houseCode')||'').trim().toLowerCase();
 if(!/^[a-f0-9]{32}$/.test(id))return info('קוד ההזמנה אינו תקין.',true);
 try{
  const alreadyJoined=houses.find(h=>h.id===id&&!h.deletedAt);
  if(alreadyJoined){selectHouse(id);form.reset();return info('אתה כבר חבר בבית הזה. הבית נבחר עבורך.')}
  const requestRef=doc(db,'houses',id,'joinRequests',user.uid),existing=await getDoc(requestRef);
  if(existing.exists()&&existing.data().status==='pending'){form.reset();return info('בקשת ההצטרפות כבר ממתינה לאישור מנהל הבית.')}
  await setDoc(requestRef,{uid:user.uid,displayName:String(user.displayName||user.email||'משתמש').slice(0,60),status:'pending',createdAt:serverTimestamp()});
  await queueJoinNotification(id,user.uid,'pending');info('בקשת ההצטרפות נשלחה. מנהל הבית צריך לאשר אותה.');form.reset();
 }catch(err){
  info(err.code==='permission-denied'?'לא ניתן לשלוח בקשה. בדוק שקוד ההזמנה נכון ושאתה עדיין לא חבר בבית.':readableError(err),true);
 }
};
onAuthStateChanged(auth,u=>{
 user=u;$('houseControls').hidden=!u;
 if(stopHouses){stopHouses();stopHouses=null}
 if(stopRequests){stopRequests();stopRequests=null}
 houses=[];housesLoaded=false;houseLoadError=null;
 currentHouse=u?(localStorage.getItem('familyauto-house-'+u.uid)||null):null;
 publishHouse(null);
 if(!u){window.dispatchEvent(new Event('familyauto:signout'));info('התחבר כדי ליצור בית או להצטרף לבית.');refreshHousePicker();return}
 $('houseDetails').replaceChildren();info('הבתים והבקשות מסתנכרנים מול השרת.');
 stopHouses=onSnapshot(query(collection(db,'houses'),where('memberIds','array-contains',u.uid)),snap=>{
  houses=snap.docs.map(d=>({id:d.id,...d.data()}));housesLoaded=true;houseLoadError=null;
  if((!currentHouse||!houses.some(h=>h.id===currentHouse))&&houses.length)currentHouse=(houses.find(h=>!h.deletedAt)||houses[0]).id;
  render();if(currentHouse&&houses.some(h=>h.id===currentHouse))selectHouse(currentHouse);refreshHousePicker();
 },async()=>{
  housesLoaded=true;
  if(currentHouse&&user){
   try{
    const selectedSnapshot=await getDoc(doc(db,'houses',currentHouse));
    if(selectedSnapshot.exists()&&(selectedSnapshot.data().memberIds||[]).includes(user.uid)){
     houseLoadError=null;houses=[{id:selectedSnapshot.id,...selectedSnapshot.data()}];render();selectHouse(selectedSnapshot.id);refreshHousePicker();return;
    }
   }catch{}
  }
  houseLoadError='לא הצלחנו לטעון את הבתים. בדוק חיבור ונסה שוב.';
  if(currentHouse!==recentlyCreatedHouse)info(houseLoadError,true);
  refreshHousePicker();
 });
});
