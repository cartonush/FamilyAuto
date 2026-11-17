const KEY='familyauto-demo-bookings-v1';const $=s=>document.querySelector(s);let bookings=[];try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(value))bookings=value.filter(b=>b&&typeof b.id==='string'&&typeof b.start==='string'&&typeof b.end==='string')}catch{}const format=date=>new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(date));const save=()=>localStorage.setItem(KEY,JSON.stringify(bookings));function render(){const now=Date.now();const active=bookings.find(b=>new Date(b.start).getTime()<=now&&new Date(b.end).getTime()>now);$('#statusPill').textContent=active?'בשימוש':'פנוי';$('#statusPill').className='pill'+(active?' busy':'');$('#statusText').textContent=active?'הרכב שמור כרגע בהדגמה.':'אין הזמנה פעילה כרגע בנתוני ההדגמה.';$('#bookingCount').textContent=bookings.length;$('#pendingCount').textContent='0';const list=$('#bookingList');list.replaceChildren();if(!bookings.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='עדיין אין הזמנות. אפשר ליצור הזמנה לבדיקה.';list.append(empty);return}for(const b of [...bookings].sort((a,b)=>a.start.localeCompare(b.start))){const row=document.createElement('div');row.className='booking';const details=document.createElement('div');const title=document.createElement('strong');title.textContent=b.name;const when=document.createElement('small');when.textContent=format(b.start)+' ← '+format(b.end);details.append(title,when);if(b.note){const note=document.createElement('small');note.textContent=b.note;details.append(note)}const del=document.createElement('button');del.textContent='מחק';del.setAttribute('aria-label','מחק הזמנה של '+b.name);del.addEventListener('click',()=>{bookings=bookings.filter(x=>x.id!==b.id);save();render()});row.append(details,del);list.append(row)}}$('#newBtn').addEventListener('click',()=>$('#bookingDialog').showModal());$('#closeDialog').addEventListener('click',()=>$('#bookingDialog').close());$('#bookingForm').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.currentTarget);const name=String(data.get('name')||'').trim();const start=String(data.get('start')||'');const end=String(data.get('end')||'');const startMs=new Date(start).getTime(),endMs=new Date(end).getTime();let error='';if(!name)error='יש להזין שם';else if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<Date.now()-60000||endMs<=startMs)error='יש לבחור טווח זמנים עתידי ותקין';else if(bookings.some(b=>startMs<new Date(b.end).getTime()&&endMs>new Date(b.start).getTime()))error='הזמנה זו חופפת להזמנה קיימת';$('#formError').textContent=error;if(error)return;bookings.push({id:crypto.randomUUID(),name,start:new Date(startMs).toISOString(),end:new Date(endMs).toISOString(),note:String(data.get('note')||'').trim()});save();render();e.currentTarget.reset();$('#bookingDialog').close()});const appearanceDefaults={light:{primary:'#2364c4',secondary:'#eaf2ff',text:'white'},dark:{primary:'#14263f',secondary:'#527cac',text:'white'}};
const appearanceKey='familyauto-color-palettes-v1';
let savedPalettes={};
try{const parsed=JSON.parse(localStorage.getItem(appearanceKey)||'{}');if(parsed&&typeof parsed==='object')savedPalettes=parsed}catch{}
const appearanceMode=()=>document.documentElement.classList.contains('dark')?'dark':'light';
const validHex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function readPalette(mode){
 const saved=savedPalettes[mode];
 return saved&&validHex(saved.primary)&&validHex(saved.secondary)&&['white','black'].includes(saved.text)?saved:appearanceDefaults[mode];
}
function syncAppearanceControls(){
 const mode=appearanceMode(),palette=readPalette(mode);
 const primary=$('#appearancePrimary'),secondary=$('#appearanceSecondary'),modeName=$('#appearanceModeName');
 if(primary)primary.value=palette.primary;
 if(secondary)secondary.value=palette.secondary;
 if(modeName)modeName.textContent=mode==='dark'?'כהה':'בהיר';
 document.querySelectorAll('input[name="appearanceTextColor"]').forEach(input=>input.checked=input.value===palette.text);
}
function applyAppearance(){
 const palette=readPalette(appearanceMode()),root=document.documentElement;
 root.style.setProperty('--brand-primary',palette.primary);
 root.style.setProperty('--brand-secondary',palette.secondary);
 root.style.setProperty('--brand-on-primary',palette.text==='black'?'#111111':'#ffffff');
 syncAppearanceControls();
}
function saveAppearancePalette(){
 const mode=appearanceMode(),primary=$('#appearancePrimary'),secondary=$('#appearanceSecondary');
 const text=document.querySelector('input[name="appearanceTextColor"]:checked')?.value||'white';
 savedPalettes[mode]={primary:primary?.value||appearanceDefaults[mode].primary,secondary:secondary?.value||appearanceDefaults[mode].secondary,text};
 localStorage.setItem(appearanceKey,JSON.stringify(savedPalettes));applyAppearance();
 const message=$('#appearanceSaved');if(message)message.textContent='הצבעים נשמרו במכשיר הזה.';
}
$('#themeBtn').addEventListener('click',()=>{
 const dark=!document.documentElement.classList.contains('dark');
 document.documentElement.classList.toggle('dark',dark);localStorage.setItem('familyauto-theme',dark?'dark':'light');applyAppearance();
});
if(localStorage.getItem('familyauto-theme')==='dark')document.documentElement.classList.add('dark');
applyAppearance();
$('#appearancePrimary')?.addEventListener('input',saveAppearancePalette);
$('#appearanceSecondary')?.addEventListener('input',saveAppearancePalette);
document.querySelectorAll('input[name="appearanceTextColor"]').forEach(input=>input.addEventListener('change',saveAppearancePalette));
$('#resetAppearanceColors')?.addEventListener('click',()=>{
 const mode=appearanceMode();delete savedPalettes[mode];localStorage.setItem(appearanceKey,JSON.stringify(savedPalettes));applyAppearance();
 const message=$('#appearanceSaved');if(message)message.textContent='הוחזרו צבעי ברירת המחדל למצב '+(mode==='dark'?'כהה':'בהיר')+'.';
});if('serviceWorker'in navigator){
 let refreshed=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!refreshed){refreshed=true;location.reload()}
 });
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  reg.update().catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{})});
 }).catch(()=>{});
}render();

// Disable page zoom gestures across every screen while preserving one-finger scrolling.
const preventMultiTouchZoom=event=>{if(event.touches?.length>1)event.preventDefault()};
document.addEventListener('touchmove',preventMultiTouchZoom,{passive:false});
for(const eventName of ['gesturestart','gesturechange','gestureend']){
 document.addEventListener(eventName,event=>event.preventDefault(),{passive:false});
}
