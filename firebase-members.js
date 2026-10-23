import {app} from './firebase-config.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const auth=getAuth(app),db=getFirestore(app),root=document.getElementById('membersRoot');
root.innerHTML='<div class="section-title"><h2>חברי הבית והרשאות</h2><span class="pill">ניהול</span></div><p id="membersStatus">בחר בית כדי לראות את חבריו.</p><div id="membersList"></div>';
const list=document.getElementById('membersList'),status=document.getElementById('membersStatus');
let unsubscribe=null,selected=null,settings={};
const say=(s,bad=false)=>{status.textContent=s;status.style.color=bad?'#b3261e':''};
const label=(uid,setting)=>setting?.displayName||('משתמש '+uid.slice(0,8));
const localValue=date=>{if(!date)return '';const d=date.toDate?date.toDate():new Date(date);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)};
function render(){
  list.replaceChildren();
  if(!selected)return;
  const owner=auth.currentUser?.uid===selected.ownerUid;
  say(owner?'כבעל הבית, תוכל לשנות הרשאת שימוש ולהרחיק משתמש זמנית.':'הרשאות חברי הבית (לצפייה בלבד).');
  for(const uid of selected.memberIds||[]){
    const setting=settings[uid],isOwner=uid===selected.ownerUid;
    const row=document.createElement('div');row.className='member-row';
    const title=document.createElement('strong');title.textContent=isOwner?(owner?'בעל הבית (אתה)':'בעל הבית'):label(uid,setting);
    const summary=document.createElement('small');summary.textContent=isOwner?'בעל הבית · הרשאות מלאות':(setting?.role==='authorized'?'משתמש מורשה':'משתמש רגיל')+(setting?.canTakeCar?' · יכול לקחת רכב מיד':'');
    row.append(title,summary);
    if(setting?.suspendedUntil){
      const until=setting.suspendedUntil.toDate?setting.suspendedUntil.toDate():new Date(setting.suspendedUntil);
      if(until>Date.now()){const p=document.createElement('small');p.textContent='מורחק מבקשות רכב עד '+until.toLocaleString('he-IL');row.append(p)}
    }
    if(owner&&!isOwner){
      const controls=document.createElement('div');controls.className='member-controls';
      const role=document.createElement('select');role.setAttribute('aria-label','הרשאת משתמש');
      for(const [value,text] of [['user','משתמש רגיל'],['authorized','משתמש מורשה']]){
        const option=document.createElement('option');option.value=value;option.textContent=text;role.append(option)
      }
      role.value=setting?.role||'user';
      const instantLabel=document.createElement('label');instantLabel.className='member-permission';const instant=document.createElement('input');instant.type='checkbox';instant.checked=setting?.canTakeCar===true;instantLabel.append(instant,document.createTextNode(' הרשאה ל״הרכב אצלי״ (ללא אישור מוקדם)'));
      const suspension=document.createElement('input');suspension.type='datetime-local';suspension.setAttribute('aria-label','הרחקה עד תאריך');suspension.value=localValue(setting?.suspendedUntil);
      const save=document.createElement('button');save.className='primary';save.textContent='שמירת הרשאות';
      save.onclick=async()=>{
        const date=suspension.value?new Date(suspension.value):null;
        if(date&&(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()))return say('תאריך הרחקה חייב להיות בעתיד.',true);
        save.disabled=true;
        try{
          await setDoc(doc(db,'houses',selected.id,'memberSettings',uid),{
            displayName:label(uid,setting).slice(0,60),
            role:role.value,
            canTakeCar:instant.checked,
            suspendedUntil:date,
            updatedAt:serverTimestamp()
          });
          say('הרשאות המשתמש נשמרו.');
        }catch(e){say('שמירת הרשאות נכשלה: '+(e.code||e.message)+'. ודא שפרסמת את כללי Firestore החדשים.',true)}
        finally{save.disabled=false}
      };
      controls.append(role,instantLabel,suspension,save);row.append(controls);
    }
    list.append(row);
  }
}
window.addEventListener('familyauto:house',event=>{
  if(unsubscribe){unsubscribe();unsubscribe=null}
  selected=event.detail;settings={};window.dispatchEvent(new CustomEvent('familyauto:permissions',{detail:{houseId:selected?.id||null,settings}}));render();
  if(!selected)return;
  unsubscribe=onSnapshot(collection(db,'houses',selected.id,'memberSettings'),snap=>{
    settings={};snap.forEach(d=>{settings[d.id]=d.data()});window.dispatchEvent(new CustomEvent('familyauto:permissions',{detail:{houseId:selected.id,settings}}));render();
  },e=>say('טעינת ההרשאות נכשלה: '+(e.code||e.message),true));
});
window.addEventListener('familyauto:signout',()=>{
  if(unsubscribe){unsubscribe();unsubscribe=null}
  selected=null;settings={};list.replaceChildren();say('בחר בית כדי לראות את חבריו.');
});