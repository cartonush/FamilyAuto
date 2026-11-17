const KEY='familyauto-demo-bookings-v1';const $=s=>document.querySelector(s);let bookings=[];try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(value))bookings=value.filter(b=>b&&typeof b.id==='string'&&typeof b.start==='string'&&typeof b.end==='string')}catch{}const format=date=>new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(date));const save=()=>localStorage.setItem(KEY,JSON.stringify(bookings));function render(){const now=Date.now();const active=bookings.find(b=>new Date(b.start).getTime()<=now&&new Date(b.end).getTime()>now);$('#statusPill').textContent=active?'בשימוש':'פנוי';$('#statusPill').className='pill'+(active?' busy':'');$('#statusText').textContent=active?'הרכב שמור כרגע בהדגמה.':'אין הזמנה פעילה כרגע בנתוני ההדגמה.';$('#bookingCount').textContent=bookings.length;$('#pendingCount').textContent='0';const list=$('#bookingList');list.replaceChildren();if(!bookings.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='עדיין אין הזמנות. אפשר ליצור הזמנה לבדיקה.';list.append(empty);return}for(const b of [...bookings].sort((a,b)=>a.start.localeCompare(b.start))){const row=document.createElement('div');row.className='booking';const details=document.createElement('div');const title=document.createElement('strong');title.textContent=b.name;const when=document.createElement('small');when.textContent=format(b.start)+' ← '+format(b.end);details.append(title,when);if(b.note){const note=document.createElement('small');note.textContent=b.note;details.append(note)}const del=document.createElement('button');del.textContent='מחק';del.setAttribute('aria-label','מחק הזמנה של '+b.name);del.addEventListener('click',()=>{bookings=bookings.filter(x=>x.id!==b.id);save();render()});row.append(details,del);list.append(row)}}$('#newBtn').addEventListener('click',()=>$('#bookingDialog').showModal());$('#closeDialog').addEventListener('click',()=>$('#bookingDialog').close());$('#bookingForm').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.currentTarget);const name=String(data.get('name')||'').trim();const start=String(data.get('start')||'');const end=String(data.get('end')||'');const startMs=new Date(start).getTime(),endMs=new Date(end).getTime();let error='';if(!name)error='יש להזין שם';else if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<Date.now()-60000||endMs<=startMs)error='יש לבחור טווח זמנים עתידי ותקין';else if(bookings.some(b=>startMs<new Date(b.end).getTime()&&endMs>new Date(b.start).getTime()))error='הזמנה זו חופפת להזמנה קיימת';$('#formError').textContent=error;if(error)return;bookings.push({id:crypto.randomUUID(),name,start:new Date(startMs).toISOString(),end:new Date(endMs).toISOString(),note:String(data.get('note')||'').trim()});save();render();e.currentTarget.reset();$('#bookingDialog').close()});const appearanceDefaults={light:{background:'#f4f7fb',surface:'#ffffff',primary:'#2364c4',secondary:'#eaf2ff',highlight:'#2364c4',highlightsEnabled:true,dividersEnabled:true,text:'black'},dark:{background:'#0d1725',surface:'#19283b',primary:'#14263f',secondary:'#26384d',highlight:'#77b0ff',highlightsEnabled:true,dividersEnabled:true,text:'white'}};
const appearanceKey='familyauto-color-palettes-v1';
const appearanceThemes=[
 {id:'red',name:'אדום',hue:2,saturation:62},
 {id:'orange',name:'כתום',hue:29,saturation:66},
 {id:'yellow',name:'צהוב',hue:49,saturation:67},
 {id:'light-green',name:'ירוק בהיר',hue:106,saturation:42},
 {id:'green',name:'ירוק',hue:146,saturation:42},
 {id:'light-blue',name:'תכלת',hue:200,saturation:61},
 {id:'blue',name:'כחול',hue:222,saturation:57},
 {id:'purple',name:'סגול',hue:269,saturation:51},
 {id:'pink',name:'ורוד',hue:331,saturation:59},
 {id:'brown',name:'חום וחאקי',hue:35,saturation:37,secondaryHue:56},
 {id:'turquoise',name:'טורקיז',hue:170,saturation:49},
 {id:'cyan',name:'ציאן',hue:188,saturation:64},
 {id:'burgundy',name:'בורדו',hue:346,saturation:47},
 {id:'magenta',name:'מג׳נטה',hue:310,saturation:58},
 {id:'cream',name:'בז׳ ושמנת',hue:42,saturation:28},
 {id:'peach',name:'אפרסק',hue:19,saturation:62},
 {id:'olive',name:'זית',hue:78,saturation:35},
 {id:'lime',name:'ליים',hue:88,saturation:62},
 {id:'navy',name:'נייבי',hue:222,saturation:34},
 {id:'light-purple',name:'סגול בהיר',hue:278,saturation:34},
 {id:'light-pink',name:'ורוד בהיר',hue:338,saturation:38}
];
const grayPalettes=[
 {id:'gray-1',name:'אפור בהיר',light:['#f7f8f9','#ffffff','#dce2e6','#edf0f2','#53616a'],dark:['#293239','#354048','#455661','#3a4852','#d5e0e5']},
 {id:'gray-2',name:'אפור עדין',light:['#ebedf0','#f8f9fa','#c5cbd0','#dde1e5','#46515c'],dark:['#1e252b','#2b343a','#3a464e','#323d45','#c8d5da']},
 {id:'gray-3',name:'אפור בינוני',light:['#dce0e3','#eef0f2','#abb2b9','#c6cbd0','#394650'],dark:['#13191d','#222a30','#303b43','#28343b','#c1ced4']},
 {id:'gray-4',name:'אפור כהה',light:['#cbd0d4','#e3e6e8','#89939c','#b4bbc1','#293641'],dark:['#0a0d10','#171c20','#28323a','#20282e','#bdcbd2']}
];
const hslHex=(h,s,l)=>{
 const k=n=>(n+h/30)%12,a=s/100*Math.min(l/100,1-l/100);
 return '#'+[0,8,4].map(n=>Math.round(255*(l/100-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1)))).toString(16).padStart(2,'0')).join('');
};
const palette=(background,surface,primary,secondary,highlight,text)=>({background,surface,primary,secondary,highlight,text});
const appearancePresets=[
 ...appearanceThemes.flatMap(theme=>{
  const {hue,saturation,secondaryHue=hue}=theme;
  const light=palette(hslHex(hue,Math.min(saturation,40),95),hslHex(hue,Math.min(saturation,32),99),hslHex(hue,saturation,72),hslHex(secondaryHue,Math.min(saturation,50),86),hslHex(hue,saturation,35),'black');
  const dark=palette(hslHex(hue,24,10),hslHex(hue,27,22),hslHex(hue,Math.min(saturation,50),hue>=40&&hue<=110?27:34),hslHex(secondaryHue,28,30),hslHex(hue,Math.min(saturation,58),76),'white');
  return [{...light,id:theme.id+'-light',name:theme.name+' · בהיר',mode:'light',family:theme.id},
   {...dark,id:theme.id+'-dark',name:theme.name+' · כהה',mode:'dark',family:theme.id}];
 }),
 ...grayPalettes.flatMap(theme=>['light','dark'].map(mode=>{
  const [background,surface,primary,secondary,highlight]=theme[mode];
  return {...palette(background,surface,primary,secondary,highlight,mode==='dark'?'white':'black'),id:theme.id+'-'+mode,name:theme.name+' · '+(mode==='dark'?'כהה':'בהיר'),mode,family:theme.id};
 })),
 {...palette('#ffffff','#ffffff','#e0e0e0','#f2f2f2','#555555','black'),id:'white',name:'לבן לגמרי'},
 {...palette('#08090a','#17191b','#30363a','#23282c','#d6e1e7','white'),id:'black',name:'שחור לגמרי'}
];
const presetGrid=$('#appearancePresets');
for(const preset of appearancePresets){
 const button=document.createElement('button');button.type='button';button.className='appearance-preset';button.dataset.preset=preset.id;
 button.innerHTML='<span class="appearance-preset-swatches" aria-hidden="true"><i></i><i></i><i></i></span><span></span>';
 button.querySelectorAll('i').forEach((swatch,index)=>swatch.style.background=[preset.background,preset.primary,preset.highlight][index]);
 button.querySelector('span:last-child').textContent=preset.name;
 button.addEventListener('click',()=>{
  const mode=preset.mode||(preset.text==='white'?'dark':'light');
  document.documentElement.classList.toggle('dark',mode==='dark');localStorage.setItem('familyauto-theme',mode);
  const pair=preset.family?appearancePresets.filter(item=>item.family===preset.family):appearancePresets.filter(item=>['white','black'].includes(item.id));
  for(const item of pair){
   const targetMode=item.mode||(item.text==='white'?'dark':'light');
   savedPalettes[targetMode]={background:item.background,surface:item.surface,primary:item.primary,secondary:item.secondary,highlight:item.highlight,highlightsEnabled:true,dividersEnabled:true,text:item.text,preset:item.id};
  }
  localStorage.setItem(appearanceKey,JSON.stringify(savedPalettes));applyAppearance();
  const message=$('#appearanceSaved');if(message)message.textContent='ערכת '+preset.name+' נבחרה ונשמרה במכשיר הזה. אפשר לשנות את הצבעים שלה למטה.';
 });
 presetGrid?.append(button);
}
let savedPalettes={};
try{const parsed=JSON.parse(localStorage.getItem(appearanceKey)||'{}');if(parsed&&typeof parsed==='object')savedPalettes=parsed}catch{}
for(const mode of ['light','dark']){
 const saved=savedPalettes[mode],legacy=appearanceThemes.concat(grayPalettes).find(item=>item.id===saved?.preset);
 if(legacy&&appearancePresets.some(item=>item.id===legacy.id+'-'+mode)){
  saved.preset=legacy.id+'-'+mode;
  const otherMode=mode==='light'?'dark':'light';
  if(!savedPalettes[otherMode]){
   const partner=appearancePresets.find(item=>item.id===legacy.id+'-'+otherMode);
   savedPalettes[otherMode]={background:partner.background,surface:partner.surface,primary:partner.primary,secondary:partner.secondary,highlight:partner.highlight,highlightsEnabled:true,dividersEnabled:true,text:partner.text,preset:partner.id};
  }
  localStorage.setItem(appearanceKey,JSON.stringify(savedPalettes));
 }
}
for(const mode of ['light','dark']){
 const saved=savedPalettes[mode],preset=appearancePresets.find(item=>item.id===saved?.preset);
 if(preset){
  Object.assign(saved,{background:preset.background,surface:preset.surface,primary:preset.primary,secondary:preset.secondary,highlight:preset.highlight,text:preset.text});
  localStorage.setItem(appearanceKey,JSON.stringify(savedPalettes));
 }
}
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
