const mainPages=['home','calendar','requests','settings'];
const subs=['profile','houses','members','activity','appearance','account'];
let activePage='home',activeSub=null,activeHouse=null,requestItems=[],reservations=[],myUid=null,selectedDate=new Date(),calendarCursor=new Date();
const $=id=>document.getElementById(id);
// Navigation must not depend on Firebase loading: settings always works offline.
const knownTargets=new Set([...mainPages,...subs.map(s=>'settings-'+s)]);
function navigate(target,{replace=false,toggle=false}={}){
  const name=knownTargets.has(target)?target:'home';
  const sub=name.startsWith('settings-')?name.slice(9):null;
  const page=sub?'settings':name;
  const nextSub=toggle&&activePage==='settings'&&activeSub===sub?null:sub;
  activePage=page;
  activeSub=nextSub;
  for(const el of document.querySelectorAll('.app-page')){
    const visible=el.dataset.page===page;
    el.hidden=!visible;
    el.style.display=visible?'':'none';
  }
  const menu=$('settingsMenu');
  if(menu){menu.hidden=false;menu.style.display='grid'}
  for(const el of document.querySelectorAll('.settings-subpage')){
    const visible=page==='settings'&&el.dataset.subpage===nextSub;
    el.hidden=!visible;
    el.style.display=visible?'block':'none';
  }
  for(const el of document.querySelectorAll('.settings-link')){
    const expanded=page==='settings'&&el.dataset.goto==='settings-'+nextSub;
    el.classList.toggle('expanded',expanded);
    el.setAttribute('aria-expanded',String(expanded));
  }
  for(const el of document.querySelectorAll('.nav-item')){
    const selected=el.dataset.goto===page;
    el.classList.toggle('active',selected);
    if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
  }
  const hash='#'+(nextSub?'settings-'+nextSub:page);
  if(location.hash!==hash){
    if(replace)history.replaceState(null,'',hash);
    else history.pushState(null,'',hash);
  }
  if(page==='settings'&&nextSub){
    const btn=document.querySelector('.settings-link[data-goto="settings-'+nextSub+'"]');
    if(btn)requestAnimationFrame(()=>btn.scrollIntoView({block:'nearest',behavior:'smooth'}));
  }else window.scrollTo(0,0);
}
document.addEventListener('click',event=>{
  const control=event.target.closest('[data-goto]');
  if(!control)return;
  event.preventDefault();
  const target=control.dataset.goto;
  navigate(target,{toggle:target.startsWith('settings-')});
});
window.addEventListener('popstate',()=>navigate(location.hash.slice(1)||'home',{replace:true}));
window.addEventListener('familyauto:auth',event=>{
  myUid=event.detail?.uid||null;
  if(!myUid){activeHouse=null;requestItems=[];reservations=[]}
  home();drawCalendar();
});
window.addEventListener('familyauto:signout',()=>{activeHouse=null;requestItems=[];reservations=[];myUid=null;home();drawCalendar()});
navigate(location.hash.slice(1)||'home',{replace:true});
$('appearanceToggle')?.addEventListener('click',()=>$('themeBtn')?.click());
function home(){
 $('homeHouseName').textContent=activeHouse?'משפחת '+activeHouse.name:'בחר בית בהגדרות כדי להתחיל.';
 $('homeHouseSummary').textContent=activeHouse?activeHouse.name+' · '+(activeHouse.memberIds?.length||0)+' חברים':'עדיין לא נבחר בית. אפשר ליצור בית בהגדרות.';
 $('homeHouseRole').textContent=!activeHouse?'—':activeHouse.ownerUid===myUid?'בעל בית':'חבר בית';
 const active=reservations.find(r=>r.startAt?.toMillis&&r.endAt?.toMillis&&r.startAt.toMillis()<=Date.now()&&r.endAt.toMillis()>Date.now());
 const next=reservations.filter(r=>r.startAt?.toMillis&&r.startAt.toMillis()>Date.now()).sort((a,b)=>a.startAt.toMillis()-b.startAt.toMillis())[0];
 const badge=$('liveCarBadge'),message=$('liveCarText');
 if(badge&&message){
  badge.textContent=!activeHouse?'בחר בית':active?'בשימוש':'אין שימוש פעיל';
  badge.className='pill '+(active?'busy':'neutral');
  message.textContent=!activeHouse?'בחר בית כדי לראות זמינות.':active?'הרכב משוריין כעת בהזמנה מאושרת עד '+active.endAt.toDate().toLocaleString('he-IL')+'.':next?'ההזמנה המאושרת הבאה: '+upcomingLabel(next.startAt.toDate()):'לא נמצאה הזמנה מאושרת פעילה בלוח הבית.';
 }
 const finish=$('homeFinishBtn');
 const activeRecord=active&&requestItems.find(r=>r.id===active.id&&r.status==='approved');
 const canRelease=!!(activeRecord&&activeHouse&&myUid&&(activeRecord.createdBy===myUid||activeHouse.ownerUid===myUid));
 if(finish){
  finish.hidden=!canRelease;
  finish.dataset.bookingId=canRelease?activeRecord.id:'';
  finish.textContent=canRelease&&activeRecord.createdBy!==myUid?'החזרה כפויה — שחרור הרכב':'סיימתי — שחררתי את הרכב';
 }
 const own=requestItems.filter(x=>x.createdBy===myUid);
 $('homePendingCount').textContent=activeHouse?own.filter(x=>x.status==='pending').length:'—';
 $('homeRequestsMessage').textContent=!activeHouse?'בחר בית כדי להציג את הבקשות שלך.':own.length?'בקשה אחרונה: '+new Date((own[0].startAt?.seconds||0)*1000).toLocaleString('he-IL'):'אין בקשות שהגשת בבית הזה.';
}
function upcomingLabel(date){
 const target=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 const today=new Date();today.setHours(0,0,0,0);
 const days=Math.round((target-today)/86_400_000);
 const time=date.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
 if(days===0)return 'היום בשעה '+time;
 if(days===1)return 'מחר בשעה '+time;
 if(days<7)return date.toLocaleDateString('he-IL',{weekday:'long'})+' בשעה '+time;
 return date.toLocaleDateString('he-IL')+' בשעה '+time;
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){home();drawCalendar()}});
setInterval(()=>{if(!document.hidden)home()},60_000);
$('homeFinishBtn')?.addEventListener('click',event=>{
 const bookingId=event.currentTarget.dataset.bookingId;
 if(bookingId)window.dispatchEvent(new CustomEvent('familyauto:finish-active',{detail:{bookingId}}));
});
const instantHomeButton=document.getElementById('homeInstantBtn');
instantHomeButton?.addEventListener('click',()=>{
 // Open the instant-use bottom sheet in place, without leaving the home page.
 window.dispatchEvent(new Event('familyauto:instant-open'));
});
window.addEventListener('familyauto:instant-permission',e=>{
 if(instantHomeButton)instantHomeButton.hidden=!e.detail;
});
window.addEventListener('familyauto:house',e=>{activeHouse=e.detail;requestItems=[];reservations=[];home();drawCalendar()});
window.addEventListener('familyauto:requests',e=>{
 const payload=e.detail||{};
 if(payload.houseId&&activeHouse?.id!==payload.houseId)return;
 requestItems=payload.records||[];
 reservations=payload.schedule||[];
 home();drawCalendar()
});

const fmt=new Intl.DateTimeFormat('he-IL',{month:'long',year:'numeric'});
const dayFmt=new Intl.DateTimeFormat('he-IL',{weekday:'long',day:'numeric',month:'long'});
function drawCalendar(){
 $('calendarMonth').textContent=fmt.format(calendarCursor);
 const grid=$('calendarGrid');grid.replaceChildren();
 for(const d of ['א','ב','ג','ד','ה','ו','ש']){const n=document.createElement('div');n.className='calendar-weekday';n.textContent=d;grid.append(n)}
 const first=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
 const offset=first.getDay(),days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 for(let i=0;i<offset;i++){const blank=document.createElement('div');blank.className='calendar-blank';grid.append(blank)}
 for(let day=1;day<=days;day++){
  const date=new Date(first.getFullYear(),first.getMonth(),day);
  const next=new Date(first.getFullYear(),first.getMonth(),day+1);
  const relevant=requestItems.filter(r=>['pending','approved','ended','rejected'].includes(r.status)&&r.startAt?.seconds&&r.endAt?.seconds&&r.startAt.seconds*1000<next.getTime()&&r.endAt.seconds*1000>date.getTime());
  const btn=document.createElement('button');btn.type='button';btn.className='calendar-day';
  const number=document.createElement('span');number.className='calendar-day-number';number.textContent=String(day);btn.append(number);
  const statuses=[...new Set(relevant.map(r=>r.status==='ended'?'approved':r.status))];
  if(statuses.length){
   const dots=document.createElement('span');dots.className='calendar-dots';
   for(const status of statuses){const dot=document.createElement('i');dot.className='calendar-dot dot-'+status;dot.setAttribute('aria-hidden','true');dots.append(dot)}
   btn.append(dots);btn.setAttribute('aria-label',day+' בחודש, '+relevant.length+' בקשות או הזמנות');
  }
  if(date.toDateString()===new Date().toDateString())btn.classList.add('today');
  btn.onclick=()=>{selectedDate=date;document.querySelectorAll('.calendar-day').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');dayDetails()};
  if(date.toDateString()===selectedDate.toDateString())btn.classList.add('selected');
  grid.append(btn)
 }
 dayDetails()
}
function dayDetails(){
 const day=selectedDate,next=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1);
 const relevant=requestItems.filter(r=>r.startAt?.seconds&&r.endAt?.seconds&&r.startAt.seconds*1000<next.getTime()&&r.endAt.seconds*1000>day.getTime());
 const root=$('calendarDayDetails');root.replaceChildren();
 const title=document.createElement('h3');title.textContent=dayFmt.format(day);root.append(title);
 if(!relevant.length){const p=document.createElement('p');p.textContent='אין בקשות שלך בתאריך הזה.';root.append(p);return}
 const labels={pending:'ממתינה לאישור',approved:'מאושרת',ended:'הסתיימה — הרכב שוחרר',rejected:'נדחתה',cancelled:'בוטלה'};
 const colors={pending:'pending',approved:'approved',ended:'approved',rejected:'rejected'};
 for(const r of relevant){
  const row=document.createElement('div');row.className='calendar-booking-row';
  const dot=document.createElement('i');dot.className='calendar-dot dot-'+(colors[r.status]||'cancelled');dot.setAttribute('aria-hidden','true');
  const details=document.createElement('div');details.className='calendar-booking-details';
  const name=document.createElement('strong');name.textContent=r.displayName||'חבר בית';
  const range=document.createElement('small');range.textContent=formatCalendarRange(r.startAt.toDate(),r.endAt.toDate());
  const status=document.createElement('small');status.className='request-state '+r.status;status.textContent=labels[r.status]||r.status;
  details.append(name,range,status);row.append(dot,details);root.append(row);
 }
}
function formatCalendarRange(start,end){
 const time=d=>d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
 if(start.toDateString()===end.toDateString())return start.toLocaleDateString('he-IL',{dateStyle:'short'})+' · '+time(start)+'–'+time(end);
 const full=d=>d.toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'});
 return full(start)+' – '+full(end);
}
$('calPrev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);drawCalendar()});
$('calNext').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);drawCalendar()});
home();drawCalendar();
// Refresh active-booking actions as the clock crosses start/end times.
setInterval(home,30_000);
