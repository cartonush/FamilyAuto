const KEY='familyauto-demo-bookings-v1';const $=s=>document.querySelector(s);let bookings=[];try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(value))bookings=value.filter(b=>b&&typeof b.id==='string'&&typeof b.start==='string'&&typeof b.end==='string')}catch{}const format=date=>new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(date));const save=()=>localStorage.setItem(KEY,JSON.stringify(bookings));function render(){const now=Date.now();const active=bookings.find(b=>new Date(b.start).getTime()<=now&&new Date(b.end).getTime()>now);$('#statusPill').textContent=active?'בשימוש':'פנוי';$('#statusPill').className='pill'+(active?' busy':'');$('#statusText').textContent=active?'הרכב שמור כרגע בהדגמה.':'אין הזמנה פעילה כרגע בנתוני ההדגמה.';$('#bookingCount').textContent=bookings.length;$('#pendingCount').textContent='0';const list=$('#bookingList');list.replaceChildren();if(!bookings.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='עדיין אין הזמנות. אפשר ליצור הזמנה לבדיקה.';list.append(empty);return}for(const b of [...bookings].sort((a,b)=>a.start.localeCompare(b.start))){const row=document.createElement('div');row.className='booking';const details=document.createElement('div');const title=document.createElement('strong');title.textContent=b.name;const when=document.createElement('small');when.textContent=format(b.start)+' ← '+format(b.end);details.append(title,when);if(b.note){const note=document.createElement('small');note.textContent=b.note;details.append(note)}const del=document.createElement('button');del.textContent='מחק';del.setAttribute('aria-label','מחק הזמנה של '+b.name);del.addEventListener('click',()=>{bookings=bookings.filter(x=>x.id!==b.id);save();render()});row.append(details,del);list.append(row)}}$('#newBtn').addEventListener('click',()=>$('#bookingDialog').showModal());$('#closeDialog').addEventListener('click',()=>$('#bookingDialog').close());$('#bookingForm').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.currentTarget);const name=String(data.get('name')||'').trim();const start=String(data.get('start')||'');const end=String(data.get('end')||'');const startMs=new Date(start).getTime(),endMs=new Date(end).getTime();let error='';if(!name)error='יש להזין שם';else if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<Date.now()-60000||endMs<=startMs)error='יש לבחור טווח זמנים עתידי ותקין';else if(bookings.some(b=>startMs<new Date(b.end).getTime()&&endMs>new Date(b.start).getTime()))error='הזמנה זו חופפת להזמנה קיימת';$('#formError').textContent=error;if(error)return;bookings.push({id:crypto.randomUUID(),name,start:new Date(startMs).toISOString(),end:new Date(endMs).toISOString(),note:String(data.get('note')||'').trim()});save();render();e.currentTarget.reset();$('#bookingDialog').close()});const appearanceDefaults={light:{background:'#f4f7fb',surface:'#ffffff',primary:'#2364c4',secondary:'#eaf2ff',highlight:'#2364c4',highlightsEnabled:true,dividersEnabled:true,text:'black'},dark:{background:'#0d1725',surface:'#19283b',primary:'#14263f',secondary:'#26384d',highlight:'#77b0ff',highlightsEnabled:true,dividersEnabled:true,text:'white'}};
const appearanceKey='familyauto-color-palettes-v1';
const appearancePresets=[
 {id:'red',name:'אדום',background:'#fff4f3',surface:'#fffafa',primary:'#efb3b0',secondary:'#fbe0de',highlight:'#d78380',text:'black'},
 {id:'orange',name:'כתום',background:'#fff7ef',surface:'#fffaf5',primary:'#f3c39e',secondary:'#fce7d3',highlight:'#d99766',text:'black'},
 {id:'yellow',name:'צהוב',background:'#fffced',surface:'#fffef6',primary:'#efdf9a',secondary:'#faf1c9',highlight:'#c3a954',text:'black'},
 {id:'light-green',name:'ירוק בהיר',background:'#f5fbed',surface:'#fcfff8',primary:'#c6e6a9',secondary:'#e7f5d7',highlight:'#91ba78',text:'black'},
 {id:'green',name:'ירוק',background:'#f0f8f2',surface:'#fafffb',primary:'#add9b7',secondary:'#d9efdf',highlight:'#79ae87',text:'black'},
 {id:'light-blue',name:'תכלת',background:'#f0faff',surface:'#faffff',primary:'#b0e1ef',secondary:'#dcf3fa',highlight:'#78b9cc',text:'black'},
 {id:'blue',name:'כחול',background:'#f2f6ff',surface:'#fbfcff',primary:'#b5c9ee',secondary:'#dfe9fa',highlight:'#819ed0',text:'black'},
 {id:'purple',name:'סגול',background:'#f8f4ff',surface:'#fdfaff',primary:'#d6bfeb',secondary:'#ede0f7',highlight:'#aa8ac9',text:'black'},
 {id:'pink',name:'ורוד',background:'#fff3f8',surface:'#fffafd',primary:'#f0bed6',secondary:'#fae1ed',highlight:'#ce8eae',text:'black'},
 {id:'brown',name:'חום וחאקי',background:'#f8f5ed',surface:'#fdfbf5',primary:'#d8c8ac',secondary:'#eae8d6',highlight:'#a59974',text:'black'},
 {id:'turquoise',name:'טורקיז',background:'#effbf8',surface:'#fafffd',primary:'#9cddd3',secondary:'#d5f2eb',highlight:'#66aea4',text:'black'},
 {id:'cyan',name:'ציאן',background:'#effcff',surface:'#faffff',primary:'#a1e8f2',secondary:'#d5f5fa',highlight:'#66b9ca',text:'black'},
 {id:'burgundy',name:'בורדו',background:'#fdf1f3',surface:'#fff9fa',primary:'#dfb1bc',secondary:'#f2dce2',highlight:'#a96878',text:'black'},
 {id:'magenta',name:'מג׳נטה',background:'#fff1fa',surface:'#fff9fd',primary:'#eab4d8',secondary:'#f9def0',highlight:'#bb78a5',text:'black'},
 {id:'cream',name:'בז׳ ושמנת',background:'#fcf8ed',surface:'#fffdf6',primary:'#e9d7b6',secondary:'#f5ead4',highlight:'#b6a07e',text:'black'},
 {id:'peach',name:'אפרסק',background:'#fff5ef',surface:'#fffcf9',primary:'#f4c7ae',secondary:'#fce5d6',highlight:'#d59d7f',text:'black'},
 {id:'olive',name:'זית',background:'#f6f7eb',surface:'#fcfdf5',primary:'#cbd5a9',secondary:'#e7ebd4',highlight:'#9ca977',text:'black'},
 {id:'lime',name:'ליים',background:'#f8fdea',surface:'#fdfff6',primary:'#d9ed9d',secondary:'#edf7cc',highlight:'#acc872',text:'black'},
 {id:'navy',name:'נייבי',background:'#151e31',surface:'#24324a',primary:'#364b6a',secondary:'#2c3d58',highlight:'#b2c6dd',text:'white'},
 {id:'light-purple',name:'סגול בהיר',background:'#fbf7ff',surface:'#fefbff',primary:'#e1d2f1',secondary:'#f1e9fa',highlight:'#b8a1d4',text:'black'},
 {id:'light-pink',name:'ורוד בהיר',background:'#fff8fb',surface:'#fffdfd',primary:'#f7d7e6',secondary:'#fceaf2',highlight:'#d9a6bf',text:'black'},
 {id:'gray-1',name:'אפור בהיר',background:'#f2f3f4',surface:'#fcfcfc',primary:'#d9dcdf',secondary:'#e9ebed',highlight:'#9da4aa',text:'black'},
 {id:'gray-2',name:'אפור עדין',background:'#e3e5e7',surface:'#f5f6f7',primary:'#c5c9cd',secondary:'#d8dbde',highlight:'#858c92',text:'black'},
 {id:'gray-3',name:'אפור בינוני',background:'#c8cccf',surface:'#e3e6e8',primary:'#a9afb4',secondary:'#d3d7da',highlight:'#69737a',text:'black'},
 {id:'gray-4',name:'אפור כהה',background:'#34393c',surface:'#41474b',primary:'#596167',secondary:'#4b5358',highlight:'#b9c2c7',text:'white'},
 {id:'white',name:'לבן לגמרי',background:'#ffffff',surface:'#ffffff',primary:'#f0f0f0',secondary:'#f7f7f7',highlight:'#777777',text:'black'},
 {id:'black',name:'שחור לגמרי',background:'#101112',surface:'#1b1d1e',primary:'#303335',secondary:'#25282a',highlight:'#b9c1bd',text:'white'}
];
const presetGrid=$('#appearancePresets');
for(const preset of appearancePresets){
 const button=document.createElement('button');button.type='button';button.className='appearance-preset';button.dataset.preset=preset.id;
 button.innerHTML='<span class="appearance-preset-swatches" aria-hidden="true"><i></i><i></i><i></i></span><span></span>';
 button.querySelectorAll('i').forEach((swatch,index)=>swatch.style.background=[preset.background,preset.primary,preset.highlight][index]);
 button.querySelector('span:last-child').textContent=preset.name;
 button.addEventListener('click',()=>{
  const mode=preset.text==='white'?'dark':'light';
  document.documentElement.classList.toggle('dark',mode==='dark');localStorage.setItem('familyauto-theme',mode);
  savedPalettes[mode]={background:preset.background,surface:preset.surface,primary:preset.primary,secondary:preset.secondary,highlight:preset.highlight,highlightsEnabled:true,dividersEnabled:true,text:preset.text,preset:preset.id};
  localStorage.setItem(appearanceKey,JSON.stringify(savedPalettes));applyAppearance();
  const message=$('#appearanceSaved');if(message)message.textContent='ערכת '+preset.name+' נבחרה ונשמרה במכשיר הזה. אפשר לשנות את הצבעים שלה למטה.';
 });
 presetGrid?.append(button);
}
let savedPalettes={};
try{const parsed=JSON.parse(localStorage.getItem(appearanceKey)||'{}');if(parsed&&typeof parsed==='object')savedPalettes=parsed}catch{}
const appearanceMode=()=>document.documentElement.classList.contains('dark')?'dark':'light';
const validHex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
for(const mode of ['light','dark']){
 const saved=savedPalettes[mode];
 if(saved&&validHex(saved.primary)&&validHex(saved.secondary)&&['white','black'].includes(saved.text)){if(!validHex(saved.background))saved.background=appearanceDefaults[mode].background;if(!validHex(saved.surface))saved.surface=appearanceDefaults[mode].surface;if(!validHex(saved.highlight))saved.highlight=saved.primary||appearanceDefaults[mode].highlight;if(typeof saved.highlightsEnabled!=='boolean')saved.highlightsEnabled=true;if(typeof saved.dividersEnabled!=='boolean')saved.dividersEnabled=true;}
}
function readPalette(mode){
 const saved=savedPalettes[mode];
 return saved&&validHex(saved.background)&&validHex(saved.surface)&&validHex(saved.primary)&&validHex(saved.secondary)&&validHex(saved.highlight)&&typeof saved.highlightsEnabled==='boolean'&&typeof saved.dividersEnabled==='boolean'&&['white','black'].includes(saved.text)?saved:appearanceDefaults[mode];
}
function syncAppearanceControls(){
 const mode=appearanceMode(),palette=readPalette(mode);
 const background=$('#appearanceBackground'),surface=$('#appearanceSurface'),primary=$('#appearancePrimary'),secondary=$('#appearanceSecondary'),highlight=$('#appearanceHighlight'),highlightsEnabled=$('#appearanceHighlightsEnabled'),dividersEnabled=$('#appearanceDividersEnabled'),modeName=$('#appearanceModeName');
 if(surface)surface.value=palette.surface;
 if(background)background.value=palette.background;
 if(primary)primary.value=palette.primary;
 if(secondary)secondary.value=palette.secondary;
 if(highlight)highlight.value=palette.highlight;
 if(highlightsEnabled)highlightsEnabled.checked=palette.highlightsEnabled;
 if(dividersEnabled)dividersEnabled.checked=palette.dividersEnabled;
 if(modeName)modeName.textContent=mode==='dark'?'כהה':'בהיר';
 document.querySelectorAll('input[name="appearanceTextColor"]').forEach(input=>input.checked=input.value===palette.text);
 document.querySelectorAll('.appearance-preset').forEach(button=>{const selected=button.dataset.preset===palette.preset;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected))});
 const selectedName=appearancePresets.find(preset=>preset.id===palette.preset)?.name;
 const presetName=$('#appearancePresetName');if(presetName)presetName.textContent=selectedName||'מותאם אישית';
}
function applyAppearance(){
 const mode=appearanceMode(),palette=readPalette(mode),root=document.documentElement;
 const saved=savedPalettes[mode],hasCustom=saved&&validHex(saved.background)&&validHex(saved.surface)&&validHex(saved.primary)&&validHex(saved.secondary)&&validHex(saved.highlight)&&typeof saved.highlightsEnabled==='boolean'&&typeof saved.dividersEnabled==='boolean'&&['white','black'].includes(saved.text);
 if(hasCustom){
  root.style.setProperty('--app-background',palette.background);
  root.style.setProperty('--app-surface',palette.surface);
  root.style.setProperty('--app-text',palette.text==='black'?'#000000':'#ffffff');
  root.style.setProperty('--app-muted',palette.text==='black'?'#000000':'#ffffff');
  root.style.setProperty('--brand-primary',palette.primary);
  root.style.setProperty('--brand-secondary',palette.secondary);
  root.style.setProperty('--brand-highlight',palette.highlight);
  root.style.setProperty('--brand-on-primary',palette.text==='black'?'#000000':'#ffffff');
 }else{
  for(const name of ['--app-background','--app-surface','--app-text','--app-muted','--brand-primary','--brand-secondary','--brand-highlight','--brand-on-primary'])root.style.removeProperty(name);
 }
 root.classList.toggle('appearance-highlights-off',!palette.highlightsEnabled);
 root.classList.toggle('appearance-dividers-off',!palette.dividersEnabled);
 const themeColor=document.querySelector('meta[name="theme-color"]');if(themeColor)themeColor.content=palette.background;
 syncAppearanceControls();
}
function saveAppearancePalette(){
 const mode=appearanceMode(),background=$('#appearanceBackground'),surface=$('#appearanceSurface'),primary=$('#appearancePrimary'),secondary=$('#appearanceSecondary'),highlight=$('#appearanceHighlight');
 const text=document.querySelector('input[name="appearanceTextColor"]:checked')?.value||'white';
 savedPalettes[mode]={background:background?.value||appearanceDefaults[mode].background,surface:surface?.value||appearanceDefaults[mode].surface,primary:primary?.value||appearanceDefaults[mode].primary,secondary:secondary?.value||appearanceDefaults[mode].secondary,highlight:highlight?.value||appearanceDefaults[mode].highlight,highlightsEnabled:$('#appearanceHighlightsEnabled')?.checked??true,dividersEnabled:$('#appearanceDividersEnabled')?.checked??true,text};
 localStorage.setItem(appearanceKey,JSON.stringify(savedPalettes));applyAppearance();
 const message=$('#appearanceSaved');if(message)message.textContent='הצבעים נשמרו במכשיר הזה.';
}
$('#themeBtn').addEventListener('click',()=>{
 const dark=!document.documentElement.classList.contains('dark');
 document.documentElement.classList.toggle('dark',dark);localStorage.setItem('familyauto-theme',dark?'dark':'light');applyAppearance();
});
if(localStorage.getItem('familyauto-theme')==='dark')document.documentElement.classList.add('dark');
applyAppearance();
$('#appearanceBackground')?.addEventListener('input',saveAppearancePalette);
$('#appearanceSurface')?.addEventListener('input',saveAppearancePalette);
$('#appearancePrimary')?.addEventListener('input',saveAppearancePalette);
$('#appearanceSecondary')?.addEventListener('input',saveAppearancePalette);
$('#appearanceHighlight')?.addEventListener('input',saveAppearancePalette);
$('#appearanceHighlightsEnabled')?.addEventListener('change',saveAppearancePalette);
$('#appearanceDividersEnabled')?.addEventListener('change',saveAppearancePalette);
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
