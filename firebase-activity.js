// Activity view is derived from the same Firestore booking records as the calendar.
// No separate copy of personal information or extra database writes are required.
const root=document.getElementById('activityRoot');
if(root){
 root.innerHTML='<div class="section-title"><h2>היסטוריית פעולות</h2><span class="pill">יומן הרכב</span></div><p id="activityStatus" class="muted">בחר בית כדי לראות את ההיסטוריה שלו.</p><div id="activityList"></div>';
 const status=document.getElementById('activityStatus'),list=document.getElementById('activityList');
 let houseId=null,records=[];
 const format=value=>value?.toDate?value.toDate().toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'לא ידוע';
 const render=()=>{
  list.replaceChildren();
  if(!houseId){status.textContent='בחר בית כדי לראות את ההיסטוריה שלו.';return}
  if(!records.length){status.textContent='אין עדיין פעולות בבית הזה.';return}
  status.textContent='פעולות אחרונות בבית הפעיל · מוצגות עד 50 הזמנות ובקשות.';
  for(const record of [...records].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,50)){
   const card=document.createElement('div');card.className='booking';
   const details=document.createElement('div');details.className='request-details';
   const name=document.createElement('strong');name.textContent=record.displayName||'חבר בית';
   const created=document.createElement('small');created.textContent='בקשה נוצרה: '+format(record.createdAt);
   const range=document.createElement('small');range.textContent='זמן הרכב: '+format(record.startAt)+' – '+format(record.endAt);
   const statusText=document.createElement('small');statusText.className='request-state '+record.status;
   statusText.textContent=({pending:'ממתינה לאישור',approved:'אושרה',rejected:'נדחתה',cancelled:'בוטלה',ended:'השימוש הסתיים'})[record.status]||record.status||'לא ידוע';
   details.append(name,created,range,statusText);
   if(record.approvedAt){
    const approved=document.createElement('small');approved.textContent='מועד אישור: '+format(record.approvedAt);
    details.append(approved);
   }
   if(record.endedAt){
    const ended=document.createElement('small');ended.textContent='מועד סיום בפועל: '+format(record.endedAt);
    details.append(ended);
   }
   card.append(details);list.append(card);
  }
 };
 window.addEventListener('familyauto:house',event=>{houseId=event.detail?.id||null;records=[];render()});
 window.addEventListener('familyauto:requests',event=>{
  if(event.detail?.houseId!==houseId)return;
  records=event.detail.records||[];render();
 });
 window.addEventListener('familyauto:signout',()=>{houseId=null;records=[];render()});
}
