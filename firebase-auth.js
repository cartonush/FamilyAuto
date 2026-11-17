import {app} from './firebase-config.js';
import {unregisterPushForCurrentUser} from './firebase-push.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,deleteUser,sendPasswordResetEmail,updateProfile,reauthenticateWithCredential,EmailAuthProvider} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const auth=getAuth(app),WORKER_URL='https://familyauto.roisuissa6.workers.dev';
const root=document.getElementById('authRoot');
const accountMount=document.getElementById('authSettingsMount');
if(accountMount)accountMount.innerHTML='<h2>החשבון שלי</h2><p id="settingsAccountSummary">טוען פרטי חשבון...</p><form id="settingsResetForm"><label>אימייל לשחזור סיסמה<input type="email" id="settingsResetEmail" autocomplete="email" required placeholder="כתובת האימייל של החשבון"></label><button type="submit" id="settingsResetBtn" class="primary wide">שליחת קישור לאיפוס סיסמה</button><p id="settingsResetStatus" role="status" aria-live="polite"></p></form><button type="button" class="primary wide" id="settingsLoginLink" data-goto="home" hidden>מעבר להתחברות / הרשמה</button>';
if(accountMount)accountMount.insertAdjacentHTML('beforeend','<div id="deleteAccountArea" hidden><h3>מחיקת חשבון</h3><p class="muted">לפני מחיקת החשבון, יש להעביר את ניהול כל הבתים למשתמש אחר. אם אתה החבר היחיד בבית, יש למחוק את הבית לצמיתות. הפעולה אינה ניתנת לביטול.</p><label>סיסמה לאימות מחיקת חשבון<input type="password" id="deleteAccountPassword" autocomplete="current-password"></label><button type="button" id="deleteAccountBtn" class="danger-action wide">מחיקת החשבון שלי לצמיתות</button><p id="deleteAccountStatus" role="status" aria-live="polite"></p></div>');
root.innerHTML='<div class="section-title"><h2>החשבון שלי</h2><span class="pill" id="authState">טוען...</span></div><p id="authMessage" aria-live="polite">בודק מצב התחברות...</p><div id="authGuest" hidden><div class="auth-switch"><button type="button" id="loginTab" class="primary">התחברות</button><button type="button" id="registerTab">הרשמה</button></div><form id="authForm"><label id="nameWrap" hidden>שם לתצוגה<input id="authName" autocomplete="name" maxlength="40"></label><label>אימייל<input id="authEmail" type="email" autocomplete="email" required></label><label>סיסמה<input id="authPassword" type="password" autocomplete="current-password" minlength="6" required></label><button id="authSubmit" type="submit" class="primary">התחברות</button><button type="button" id="resetPassword">שכחתי סיסמה</button></form></div><div id="authUser" hidden><p id="userEmail"></p><button id="logoutBtn" type="button">התנתקות</button></div>';
let mode='login';const el=id=>document.getElementById(id);const message=(value,isError=false)=>{el('authMessage').textContent=value;el('authMessage').style.color=isError?'#b3261e':''};const setMode=next=>{mode=next;el('nameWrap').hidden=mode!=='register';el('authName').required=mode==='register';el('authPassword').autocomplete=mode==='register'?'new-password':'current-password';el('authPassword').minLength=mode==='register'?12:6;el('authSubmit').textContent=mode==='register'?'יצירת חשבון':'התחברות';el('loginTab').className=mode==='login'?'primary':'';el('registerTab').className=mode==='register'?'primary':'';message('החשבון מאפשר סנכרון של בתים ובקשות רכב.')};
el('loginTab').onclick=()=>setMode('login');el('registerTab').onclick=()=>setMode('register');
const errors={'auth/strong-password-required':'בהרשמה נדרשת סיסמה של 12 תווים לפחות, כולל אותיות ומספרים.','auth/email-already-in-use':'כתובת האימייל כבר רשומה. נסה להתחבר.','auth/invalid-email':'כתובת האימייל אינה תקינה.','auth/weak-password':'הסיסמה חלשה מדי. בחר סיסמה חזקה יותר.','auth/invalid-credential':'האימייל או הסיסמה שגויים.','auth/operation-not-allowed':'ההרשמה אינה זמינה כרגע. נסה שוב מאוחר יותר.','auth/too-many-requests':'בוצעו יותר מדי ניסיונות. נסה שוב מאוחר יותר.','auth/network-request-failed':'אין חיבור זמין. בדוק את האינטרנט ונסה שוב.','auth/unauthorized-domain':'לא ניתן להתחבר כרגע מהמכשיר הזה. נסה שוב מאוחר יותר.','auth/requires-recent-login':'כדי להמשיך, התנתק והתחבר מחדש.'};
const fail=e=>message(errors[e.code]||'לא ניתן להשלים את הפעולה כרגע. בדוק את הפרטים ונסה שוב.',true);
el('authForm').onsubmit=async event=>{event.preventDefault();const email=el('authEmail').value.trim();const password=el('authPassword').value;el('authSubmit').disabled=true;try{if(mode==='register'){if(password.length<12||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))throw {code:'auth/strong-password-required'};const user=await createUserWithEmailAndPassword(auth,email,password);const name=el('authName').value.trim();if(name)await updateProfile(user.user,{displayName:name})}else await signInWithEmailAndPassword(auth,email,password);el('authForm').reset()}catch(e){fail(e)}finally{el('authSubmit').disabled=false}};
const resetMessage='אם כתובת האימייל משויכת לחשבון, נשלח אליה קישור לאיפוס הסיסמה. כדאי לבדוק גם בתיקיית הספאם.';
const requestPasswordReset=async(email,button,show)=>{if(!email){show('יש להזין כתובת אימייל תקינה.',true);return}button.disabled=true;try{await sendPasswordResetEmail(auth,email);show(resetMessage,false)}catch(e){show(errors[e.code]||'לא ניתן לשלוח קישור איפוס כרגע. בדוק את כתובת האימייל ונסה שוב.',true)}finally{button.disabled=false}};
el('resetPassword').onclick=()=>requestPasswordReset(el('authEmail').value.trim(),el('resetPassword'),message);
if(el('settingsResetForm'))el('settingsResetForm').onsubmit=event=>{event.preventDefault();const status=el('settingsResetStatus');requestPasswordReset(el('settingsResetEmail').value.trim(),el('settingsResetBtn'),(msg,bad)=>{status.textContent=msg;status.style.color=bad?'#b3261e':''})};
const deleteButton=el('deleteAccountBtn');
if(deleteButton)deleteButton.onclick=async()=>{
 const current=auth.currentUser;
 if(!current?.email)return;
 const password=el('deleteAccountPassword').value;
 const status=el('deleteAccountStatus');
 if(!password){status.textContent='יש להזין את הסיסמה כדי לאמת את מחיקת החשבון.';return}
 if(!confirm('למחוק את חשבון FamilyAuto לצמיתות? לא ניתן לשחזר אותו.'))return;
 if(prompt('לאישור מחיקת החשבון, הקלד מחק')!=='מחק')return;
 deleteButton.disabled=true;
 try{
  await reauthenticateWithCredential(current,EmailAuthProvider.credential(current.email,password));
  await unregisterPushForCurrentUser().catch(e=>console.warn('Push cleanup before account deletion:',e.code||e.message));
  const response=await fetch(WORKER_URL+'/account/cleanup',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await current.getIdToken()},body:JSON.stringify({})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||'לא ניתן להשלים את מחיקת החשבון.');
  await deleteUser(current);
  el('deleteAccountPassword').value='';
  status.textContent='החשבון נמחק לצמיתות.';
 }catch(e){
  status.textContent='מחיקת החשבון נכשלה: '+(errors[e.code]||(!e.code?e.message:'בדוק את החיבור ונסה שוב.')||'בדוק את החיבור ונסה שוב.');
 }finally{deleteButton.disabled=false}
};
const logout=async()=>{const buttons=['logoutBtn','settingsLogoutBtn'].map(el).filter(Boolean);buttons.forEach(b=>b.disabled=true);try{await unregisterPushForCurrentUser().catch(e=>console.warn('Push cleanup before logout:',e.code||e.message));await signOut(auth)}catch(e){fail(e)}finally{buttons.forEach(b=>b.disabled=false)}};for(const id of ['logoutBtn','settingsLogoutBtn']){const button=el(id);if(button)button.onclick=logout;}
onAuthStateChanged(auth,user=>{window.dispatchEvent(new CustomEvent('familyauto:auth',{detail:user?{uid:user.uid}:null}));el('authState').textContent=user?'מחובר':'לא מחובר';if(el('homeGuest'))el('homeGuest').hidden=!!user;if(el('homeLoggedIn'))el('homeLoggedIn').hidden=!user;if(el('settingsAccountSummary'))el('settingsAccountSummary').textContent=user?'מחובר בתור '+(user.displayName||user.email||'משתמש'):'אינך מחובר לחשבון. אפשר להתחבר או להירשם מדף הבית.';if(el('settingsResetEmail'))el('settingsResetEmail').value=user?.email||'';if(el('settingsResetStatus'))el('settingsResetStatus').textContent='';if(el('settingsLoginLink'))el('settingsLoginLink').hidden=!!user;if(el('settingsLogoutArea'))el('settingsLogoutArea').hidden=!user;if(el('deleteAccountArea'))el('deleteAccountArea').hidden=!user;el('authGuest').hidden=!!user;el('authUser').hidden=!user;if(user){el('userEmail').textContent=(user.displayName?user.displayName+' · ':'')+user.email;message('התחברת בהצלחה. הבקשות וההזמנות מסתנכרנות מול השרת.')}else {setMode('login');document.querySelector('.nav-item[data-goto="home"]')?.click()}},fail);
