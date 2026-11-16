// Queued notifications are immutable to clients and validated against the real booking.
// Cloudflare Worker alone is permitted to change their state via Firestore Admin REST.
import {app} from './firebase-config.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const db=getFirestore(app),auth=getAuth(app);
const WORKER_URL=''; // Set after deploying the Cloudflare Worker.
export async function queueBookingNotification(houseId,bookingId,status){
 const user=auth.currentUser;
 if(!user||!houseId||!bookingId||!['pending','approved','rejected','cancelled','ended'].includes(status))return;
 const eventId=houseId+'_'+bookingId+'_'+status;
 try{
  await setDoc(doc(db,'notificationEvents',eventId),{
   houseId,bookingId,status,actorUid:user.uid,state:'queued',createdAt:serverTimestamp()
  });
 }catch(error){
  // Existing event means it was already queued. A network failure can be retried
  // by opening the booking in the app; never fail the booking itself over a push.
  if(error.code!=='permission-denied')console.warn('FamilyAuto push event queue:',error.code||error);
  return;
 }
 if(!WORKER_URL)return; // Cloudflare scheduled trigger will process the queue.
 try{
  const token=await user.getIdToken();
  const response=await fetch(WORKER_URL.replace(/\/$/,'')+'/dispatch',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({eventId})
  });
  if(!response.ok)console.warn('FamilyAuto push dispatch:',response.status);
 }catch(error){console.warn('FamilyAuto push dispatch deferred to scheduled worker',error)}
}
