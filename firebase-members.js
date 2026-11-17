import {app} from './firebase-config.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const auth=getAuth(app),db=getFirestore(app),root=document.getElementById('membersRoot');
root.innerHTML='<div class="section-title"><h2>חברי הבית והרשאות</h2><span class="pill">ניהול</span></div><p id="membersStatus">בחר בית כדי לראות את חבריו.</p><div id="membersList"></div>';
const list=document.getElementById('membersList'),status=document.getElementById('membersStatus');
const WORKER_URL='https://familyauto.roisuissa6.workers.dev';
let unsubscribe=null,selected=null,settings={};
const say=(s,bad=false)=>{status.textContent=s;status.style.color=bad?'#b3261e':''};
const label=(uid,setting)=>setting?.displayName||('משתמש '+uid.slice(0,8));
async function changeMembership(targetUid){
  const user=auth.currentUser;
  if(!user||!selected)throw Error('יש להתחבר ולבחור בית.');
  let response;
  try{response=await fetch(WORKER_URL+'/account/membership',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},
    body:JSON.stringify({houseId:selected.id,targetUid})
  })}catch{throw Error('אין חיבור לשרת. בדוק את האינטרנט ונסה שוב.')}
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||'לא ניתן לשנות את החברות בבית. נסה שוב.');
}
function render(){
  list.replaceChildren();
  if(!selected)return;
  const owner=auth.currentUser?.uid===selected.ownerUid;
  say(owner?'כבעל הבית, תוכל לשנות הרשאות שימוש של חברי הבית.':'הרשאות חברי הבית (לצפייה בלבד).');
  for(const uid of selected.memberIds||[]){
    const setting=settings[uid],isOwner=uid===selected.ownerUid;
    const row=document.createElement('div');row.className='member-row';
    const title=document.createElement('strong');title.textContent=isOwner?(owner?'בעל הבית (אתה)':'בעל הבית'):label(uid,setting);
    const summary=document.createElement('small');summary.textContent=isOwner?'בעל הבית · הרשאות מלאות':(setting?.role==='authorized'?'משתמש מורשה':'משתמש רגיל')+(setting?.canTakeCar?' · יכול לקחת רכב מיד':'');
    row.append(title,summary);
    if(owner&&!isOwner){
      const controls=document.createElement('div');controls.className='member-controls';
      const role=document.createElement('select');role.setAttribute('aria-label','הרשאת משתמש');
      for(const [value,text] of [['user','משתמש רגיל'],['authorized','משתמש מורשה']]){
        const option=document.createElement('option');option.value=value;option.textContent=text;role.append(option)
      }
      role.value=setting?.role||'user';
      const instantLabel=document.createElement('label');instantLabel.className='member-permission';const instant=document.createElement('input');instant.type='checkbox';instant.checked=setting?.canTakeCar===true;instantLabel.append(instant,document.createTextNode(' הרשאה ל״הרכב אצלי״ (ללא אישור מוקדם)'));
      const save=document.createElement('button');save.className='primary';save.textContent='שמירת הרשאות';
      save.onclick=async()=>{
        save.disabled=true;
        try{
          await setDoc(doc(db,'houses',selected.id,'memberSettings',uid),{
            displayName:label(uid,setting).slice(0,60),
            role:role.value,
            canTakeCar:instant.checked,
            suspendedUntil:null,
            updatedAt:serverTimestamp()
          });
          say('הרשאות המשתמש נשמרו.');
        }catch(e){say('לא ניתן לשמור את ההרשאות כרגע. בדוק את החיבור ונסה שוב.',true)}
        finally{save.disabled=false}
      };
      const remove=document.createElement('button');remove.type='button';remove.className='danger-action';remove.textContent='הוצאת חבר מהבית';
      remove.onclick=async()=>{
        const name=label(uid,setting);
        if(!confirm('להוציא את '+name+' מהבית? בקשות ממתינות והזמנות עתידיות צריכות להסתיים קודם.'))return;
        remove.disabled=true;
        try{await changeMembership(uid);say(name+' הוסר מהבית.');}
        catch(e){say(e.message||'לא ניתן להוציא את החבר מהבית.',true)}
        finally{remove.disabled=false}
      };
      controls.append(role,instantLabel,save,remove);row.append(controls);
    }else if(!owner&&uid===auth.currentUser?.uid){
      const leave=document.createElement('button');leave.type='button';leave.className='danger-action';leave.textContent='עזיבת הבית';
      leave.onclick=async()=>{
        if(!confirm('לעזוב את הבית? בקשות ממתינות והזמנות עתידיות שלך צריכות להסתיים קודם.'))return;
        leave.disabled=true;
        try{await changeMembership(uid);say('עזבת את הבית.');}
        catch(e){say(e.message||'לא ניתן לעזוב את הבית.',true)}
        finally{leave.disabled=false}
      };
      row.append(leave);
    }
    list.append(row);
  }
}
function handleHouseChange(event){
  if(unsubscribe){unsubscribe();unsubscribe=null}
  selected=event.detail;settings={};window.dispatchEvent(new CustomEvent('familyauto:permissions',{detail:{houseId:selected?.id||null,settings}}));render();
  if(!selected)return;
  unsubscribe=onSnapshot(collection(db,'houses',selected.id,'memberSettings'),snap=>{
    settings={};snap.forEach(d=>{settings[d.id]=d.data()});window.dispatchEvent(new CustomEvent('familyauto:permissions',{detail:{houseId:selected.id,settings}}));render();
  },()=>say('לא ניתן לטעון את ההרשאות כרגע. בדוק את החיבור ונסה שוב.',true));
}
window.addEventListener('familyauto:house',handleHouseChange);
// House loading may finish before this module registers its listener.
if(window.familyautoSelectedHouse)handleHouseChange({detail:window.familyautoSelectedHouse});
window.addEventListener('familyauto:signout',()=>{
  if(unsubscribe){unsubscribe();unsubscribe=null}
  selected=null;settings={};list.replaceChildren();say('בחר בית כדי לראות את חבריו.');
});
