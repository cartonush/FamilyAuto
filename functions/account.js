const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const db=getFirestore();
const requireUid=request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','יש להתחבר לחשבון.');
 return request.auth.uid;
};
const options={region:'europe-west1',enforceAppCheck:false};
exports.transferHouseOwnership=onCall(options,async request=>{
 const uid=requireUid(request);
 const {houseId,successorUid}=request.data||{};
 if(typeof houseId!=='string'||!/^[a-f0-9]{32}$/.test(houseId)||typeof successorUid!=='string'||successorUid===uid)
  throw new HttpsError('invalid-argument','יש לבחור חבר בית אחר.');
 const ref=db.doc('houses/'+houseId);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists)throw new HttpsError('not-found','הבית לא נמצא.');
  const house=snap.data();
  if(house.ownerUid!==uid)throw new HttpsError('permission-denied','רק מנהל הבית יכול להעביר בעלות.');
  if(house.deletedAt)throw new HttpsError('failed-precondition','יש לשחזר את הבית לפני העברת בעלות.');
  if(!Array.isArray(house.memberIds)||!house.memberIds.includes(successorUid))
   throw new HttpsError('failed-precondition','המנהל החדש חייב להיות חבר מאושר בבית.');
  tx.update(ref,{ownerUid:successorUid});
  tx.set(ref.collection('memberSettings').doc(uid),{
   displayName:'חבר בית',role:'user',canTakeCar:false,suspendedUntil:null,
   updatedAt:FieldValue.serverTimestamp()
  },{merge:true});
 });
 return {success:true};
});
exports.deleteEmptyHouse=onCall(options,async request=>{
 const uid=requireUid(request);
 const {houseId}=request.data||{};
 if(typeof houseId!=='string'||!/^[a-f0-9]{32}$/.test(houseId))
  throw new HttpsError('invalid-argument','מזהה הבית אינו תקין.');
 const ref=db.doc('houses/'+houseId);
 const snap=await ref.get();
 if(!snap.exists)throw new HttpsError('not-found','הבית לא נמצא.');
 if(snap.data().ownerUid!==uid||snap.data().memberIds?.length!==1||snap.data().memberIds[0]!==uid)
  throw new HttpsError('failed-precondition','אפשר למחוק לצמיתות רק בית שאתה מנהל והחבר היחיד בו.');
 await db.recursiveDelete(ref);
 return {success:true};
});
exports.deleteMyAccount=onCall(options,async request=>{
 const uid=requireUid(request);
 // Require recent sign-in before irreversible account deletion.
 const authTime=request.auth.token.auth_time||0;
 if(Date.now()/1000-authTime>600)
  throw new HttpsError('failed-precondition','יש להתנתק ולהתחבר מחדש לפני מחיקת החשבון.');
 const houses=await db.collection('houses').where('memberIds','array-contains',uid).get();
 if(houses.docs.some(h=>h.data().ownerUid===uid))
  throw new HttpsError('failed-precondition','לפני מחיקת החשבון יש להעביר בעלות על כל הבתים שלך, או למחוק בתים שבהם אתה החבר היחיד.');
 // Remove membership first, preserving the house for other members.
 for(const house of houses.docs){
  await db.runTransaction(async tx=>{
   const current=await tx.get(house.ref);
   if(!current.exists)return;
   if(current.data().ownerUid===uid)
    throw new HttpsError('failed-precondition','יש להעביר בעלות על הבית לפני מחיקת החשבון.');
   tx.update(house.ref,{memberIds:FieldValue.arrayRemove(uid)});
  });
  await house.ref.collection('memberSettings').doc(uid).delete();
  await house.ref.collection('joinRequests').doc(uid).delete();
  // Historical reservations remain to preserve the shared schedule and audit history.
  // Remove the person's displayed name from these records.
  const bookings=await house.ref.collection('bookingRequests').where('createdBy','==',uid).get();
  for(let i=0;i<bookings.docs.length;i+=400){
   const batch=db.batch();
   for(const item of bookings.docs.slice(i,i+400))batch.update(item.ref,{displayName:'משתמש שנמחק'});
   await batch.commit();
  }
  const activities=await house.ref.collection('activity').where('createdBy','==',uid).get();
  for(let i=0;i<activities.docs.length;i+=400){
   const batch=db.batch();
   for(const item of activities.docs.slice(i,i+400))batch.update(item.ref,{displayName:'משתמש שנמחק'});
   await batch.commit();
  }
 }
 await db.doc('profiles/'+uid).delete();
 await db.recursiveDelete(db.collection('users').doc(uid));
 await getAuth().deleteUser(uid);
 return {success:true};
});
