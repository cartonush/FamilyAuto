import {getApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,updateProfile} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const auth=getAuth(getApp()), db=getFirestore(getApp()), root=document.getElementById('profileRoot');
root.innerHTML='<div class="section-title"><h2>הפרופיל שלי</h2><span class="pill">פרטי חשבון</span></div><p id="profileStatus" aria-live="polite">התחבר כדי לערוך פרופיל.</p><form id="profileForm" hidden><label>שם לתצוגה<input name="displayName" autocomplete="name" maxlength="40" required></label><label>מספר טלפון (לא חובה)<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0501234567" maxlength="16"></label><button class="primary" type="submit">שמירת פרופיל</button><small>מספר הטלפון נשמר בפרופיל שלך בלבד, ואינו משמש להתחברות או לאימות SMS.</small></form>';
const form=document.getElementById('profileForm'),status=document.getElementById('profileStatus');
let user=null,unsubscribe=null,loaded=false;
const say=(value,error=false)=>{status.textContent=value;status.style.color=error?'#b3261e':''};
onAuthStateChanged(auth,u=>{
  if(unsubscribe){unsubscribe();unsubscribe=null}
  user=u;loaded=false;form.hidden=!u;
  if(!u){form.reset();say('התחבר כדי לערוך פרופיל.');return}
  say('טוען פרופיל...');
  unsubscribe=onSnapshot(doc(db,'profiles',u.uid),snapshot=>{
    loaded=true;
    const data=snapshot.exists()?snapshot.data():{};
    form.elements.displayName.value=data.displayName||u.displayName||'';
    form.elements.phone.value=data.phone||'';
    say('הפרטים נשמרים בחשבון שלך ומסתנכרנים בין מכשירים.');
  },err=>say('לא ניתן לטעון פרופיל: '+(err.code||err.message)+'. בדוק שכללי Firestore עודכנו.',true));
});
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!user)return;
  const uid=user.uid,name=form.elements.displayName.value.trim();
  const phone=form.elements.phone.value.replace(/[\s()-]/g,'');
  if(!name||name.length>40)return say('שם לתצוגה חייב להכיל 1–40 תווים.',true);
  if(phone&&!/^[+]?[0-9]{8,15}$/.test(phone))return say('יש להזין מספר טלפון תקין, עם 8–15 ספרות.',true);
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{
    const reference=doc(db,'profiles',uid);
    await setDoc(reference,{displayName:name,phone,updatedAt:serverTimestamp()},{merge:true});
    if(auth.currentUser?.uid===uid)await updateProfile(auth.currentUser,{displayName:name});
    say('הפרופיל נשמר בהצלחה.');
  }catch(err){say('שמירת הפרופיל נכשלה: '+(err.code||err.message),true)}
  finally{button.disabled=false}
});