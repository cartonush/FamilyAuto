import {app} from './firebase-config.js';
import {getFirestore,collection,query,orderBy,limit,onSnapshot} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const db=getFirestore(app),root=document.getElementById('activityRoot');
if(root){
 root.innerHTML='<div class="section-title"><h2>היסטוריית פעולות</h2><span class="pill">יומן הרכב</span></div><p id="activityStatus" class="muted">בחר בית כדי לראות את ההיסטוריה שלו.</p><div id="activityList"></div>';
 const status=document.getElementById('activityStatus'),list=document.getElementById('activityList');
 let houseId=null,records=[],events=[],stop=null;
 const format=value=>value?.toDate?value.toDate().toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'לא ידוע';
 const entry=(title,lines)=>{
  const card=document.createElement('div');card.className='booking';
  const details=document.createElement('div');details.className='request-details';
  const heading=document.createElement('strong');heading.textContent=title;details.append(heading);
  for(const line of lines){const small=document.createElement('small');small.textContent=line;details.append(small)}
  card.append(details);list.append(card);
 };
 const render=()=>{
  list.replaceChildren();
  if(!houseId){status.textContent='בחר בית כדי לראות את ההיסטוריה שלו.';return}
  if(events.length){
   status.textContent='יומן פעולות משותף · '+events.length+' אירועים אחרונים.';
   for(const event of events){
    entry(event.title||'עדכון רכב',[
     'מועד הפעולה: '+format(event.occurredAt),
     'משתמש: '+(event.displayName||'חבר בית'),
     'זמן הרכב: '+format(event.startAt)+' – '+format(event.endAt)
    ]);
   }
   return;
  }
  if(!records.length){status.textContent='אין עדיין פעולות בבית הזה.';return}
  status.textContent='הזמנות קיימות · יומן הפעולות החדש יתעד כל שינוי לאחר הפעלת Firebase Functions.';
  for(const record of [...records].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,50)){
   const lines=[
    'בקשה נוצרה: '+format(record.createdAt),
    'זמן הרכב: '+format(record.startAt)+' – '+format(record.endAt),
    'מצב: '+(({pending:'ממתינה',approved:'מאושרת',rejected:'נדחתה',cancelled:'בוטלה',ended:'הסתיימה'})[record.status]||record.status)
   ];
   if(record.approvedAt)lines.push('מועד אישור: '+format(record.approvedAt));
   if(record.endedAt)lines.push('מועד סיום: '+format(record.endedAt));
   entry(record.displayName||'חבר בית',lines);
  }
 };
 window.addEventListener('familyauto:house',event=>{
  if(stop){stop();stop=null}
  houseId=event.detail?.id||null;records=[];events=[];render();
  if(!houseId)return;
  const selectedId=houseId;
  stop=onSnapshot(query(collection(db,'houses',selectedId,'activity'),orderBy('occurredAt','desc'),limit(100)),snap=>{
   if(selectedId!==houseId)return;
   events=snap.docs.map(d=>d.data());render();
  },error=>{if(selectedId===houseId)status.textContent='טעינת יומן הפעולות נכשלה: '+(error.code||error.message)});
 });
 window.addEventListener('familyauto:requests',event=>{
  if(event.detail?.houseId!==houseId)return;
  records=event.detail.records||[];render();
 });
 window.addEventListener('familyauto:signout',()=>{if(stop){stop();stop=null}houseId=null;records=[];events=[];render()});
}
