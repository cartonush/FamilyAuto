const mainPages=['home','calendar','requests','settings'];
const subs=['profile','houses','members','appearance','account','preview'];
let activePage='home',activeSub=null,activeHouse=null,requestItems=[],myUid=null,selectedDate=new Date(),calendarCursor=new Date();
const $=id=>document.getElementById(id);
for(const sub of subs){
 const button=document.querySelector('.settings-link[data-goto="settings-'+sub+'"]');
 const panel=$('sub-'+sub);
 if(button&&panel){
  panel.querySelector('.back-link')?.remove();
  button.insertAdjacentElement('afterend',panel);
  button.setAttribute('aria-controls','sub-'+sub);
  button.setAttribute('aria-expanded','false');
 }
}

function navigate(target,replace=false){
  const parts=target.split('-');
  const sub=parts[0]==='settings'&&parts.length>1?parts.slice(1).join('-'):null;
  const page=sub?'settings':mainPages.includes(target)?target:'home';
  if(sub&&!subs.includes(sub))return navigate('settings',replace);
  const expanded=sub&&page==='settings'&&activePage==='settings'&&activeSub===sub;
  activePage=page;activeSub=expanded?null:sub;
  document.querySelectorAll('.app-page').forEach(el=>el.hidden=el.dataset.page!==page);
  $('settingsMenu').hidden=false;
  document.querySelectorAll('.settings-subpage').forEach(el=>el.hidden=el.dataset.subpage!==activeSub);
  document.querySelectorAll('.settings-link').forEach(el=>{const open=el.dataset.goto==='settings-'+activeSub;el.classList.toggle('expanded',open);el.setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('.nav-item').forEach(el=>{
    const on=el.dataset.goto===page;
    el.classList.toggle('active',on);
    if(on)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')
  });
  const hash='#'+(activeSub?'settings-'+activeSub:page);
  if(location.hash!==hash){
    if(replace)history.replaceState(null,'',hash);else history.pushState(null,'',hash)
  }
  if(page==='settings'&&activeSub){document.querySelector('.settings-link[data-goto="settings-'+activeSub+'"]').scrollIntoView({block:'nearest',behavior:'smooth'})}else window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-goto]');
  if(btn){e.preventDefault();navigate(btn.dataset.goto)}
});
window.addEventListener('popstate',()=>{activeSub=null;navigate(location.hash.slice(1)||'home',true)});
window.addEventListener('hashchange',()=>{activeSub=null;navigate(location.hash.slice(1)||'home',true)});
navigate(location.hash.slice(1)||'home',true);
$('appearanceToggle').addEventListener('click',()=>$('themeBtn').click());
function home(){
 $('homeHouseName').textContent=activeHouse?'משפחת '+activeHouse.name:'בחר בית בהגדרות כדי להתחיל.';
 $('homeHouseSummary').textContent=activeHouse?activeHouse.name+' · '+(activeHouse.memberIds?.length||0)+' חברים':'עדיין לא נבחר בית. אפשר ליצור בית בהגדרות.';
 $('homeHouseRole').textContent=!activeHouse?'—':activeHouse.ownerUid===myUid?'בעל בית':'חבר בית';
 const own=requestItems.filter(x=>x.createdBy===myUid);
 $('homePendingCount').textContent=activeHouse?own.filter(x=>x.status==='pending').length:'—';
 $('homeRequestsMessage').textContent=!activeHouse?'בחר בית כדי להציג את הבקשות שלך.':own.length?'בקשה אחרונה: '+new Date((own[0].startAt?.seconds||0)*1000).toLocaleString('he-IL'):'אין בקשות שהגשת בבית הזה.';
}
window.addEventListener('familyauto:house',e=>{activeHouse=e.detail;requestItems=[];home();drawCalendar()});
window.addEventListener('familyauto:requests',e=>{requestItems=e.detail||[];home();drawCalendar()});
window.addEventListener('familyauto:signout',()=>{activeHouse=null;requestItems=[];myUid=null;home();drawCalendar()});
window.addEventListener('familyauto:auth',e=>{myUid=e.detail?.uid||null;home()});
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
  const relevant=requestItems.filter(r=>r.createdBy===myUid&&r.startAt?.seconds&&r.endAt?.seconds&&r.startAt.seconds*1000<next.getTime()&&r.endAt.seconds*1000>date.getTime());
  const btn=document.createElement('button');btn.type='button';btn.className='calendar-day';btn.textContent=String(day);
  if(relevant.length){btn.classList.add('has-request');btn.setAttribute('aria-label',day+' בחודש, '+relevant.length+' בקשות')}
  if(date.toDateString()===new Date().toDateString())btn.classList.add('today');
  btn.onclick=()=>{selectedDate=date;document.querySelectorAll('.calendar-day').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');dayDetails()};
  if(date.toDateString()===selectedDate.toDateString())btn.classList.add('selected');
  grid.append(btn)
 }
 dayDetails()
}
function dayDetails(){
 const day=selectedDate,next=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1);
 const relevant=requestItems.filter(r=>r.createdBy===myUid&&r.startAt?.seconds&&r.endAt?.seconds&&r.startAt.seconds*1000<next.getTime()&&r.endAt.seconds*1000>day.getTime());
 const root=$('calendarDayDetails');root.replaceChildren();
 const title=document.createElement('h3');title.textContent=dayFmt.format(day);root.append(title);
 if(!relevant.length){const p=document.createElement('p');p.textContent='אין בקשות שלך בתאריך הזה.';root.append(p);return}
 for(const r of relevant){const p=document.createElement('p');p.textContent=new Date(r.startAt.seconds*1000).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})+' · '+(r.status==='pending'?'ממתינה לאישור':'בוטלה');root.append(p)}
}
$('calPrev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);drawCalendar()});
$('calNext').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);drawCalendar()});
home();drawCalendar();
