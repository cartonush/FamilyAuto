import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,collection,addDoc,Timestamp,serverTimestamp,writeBatch,runTransaction,query,getDocs} from 'firebase/firestore';

let env;
const HID='0123456789abcdef0123456789abcdef';
before(async()=>{
 env=await initializeTestEnvironment({projectId:'familyauto-rules-test',firestore:{rules:readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',HID),{name:'Test House',ownerUid:'owner',memberIds:['owner','member'],createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',HID,'memberSettings','member'),{displayName:'Member',role:'user',canTakeCar:false,suspendedUntil:null,updatedAt:Timestamp.now()});
 });
});
after(async()=>{if(env)await env.cleanup()});
test('outsider cannot read another house',async()=>{
 const db=env.authenticatedContext('outsider').firestore();
 await assertFails(getDoc(doc(db,'houses',HID)));
});
test('member can read house',async()=>{
 const db=env.authenticatedContext('member').firestore();
 await assertSucceeds(getDoc(doc(db,'houses',HID)));
});
test('member cannot elevate own vehicle role',async()=>{
 const db=env.authenticatedContext('member').firestore();
 await assertFails(setDoc(doc(db,'houses',HID,'memberSettings','member'),{displayName:'Member',role:'authorized',canTakeCar:false,suspendedUntil:null,updatedAt:serverTimestamp()}));
});
test('owner can update member role',async()=>{
 const db=env.authenticatedContext('owner').firestore();
 await assertSucceeds(setDoc(doc(db,'houses',HID,'memberSettings','member'),{displayName:'Member',role:'authorized',suspendedUntil:null,updatedAt:serverTimestamp()}));
});
test('member can submit a pending booking request',async()=>{
 const db=env.authenticatedContext('member').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+3600000));
 const end=Timestamp.fromDate(new Date(Date.now()+7200000));
 await assertSucceeds(addDoc(collection(db,'houses',HID,'bookingRequests'),{createdBy:'member',displayName:'Member',startAt:start,endAt:end,note:'',status:'pending',createdAt:serverTimestamp()}));
});
test('outsider cannot submit booking request',async()=>{
 const db=env.authenticatedContext('outsider').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+3600000));
 const end=Timestamp.fromDate(new Date(Date.now()+7200000));
 await assertFails(addDoc(collection(db,'houses',HID,'bookingRequests'),{createdBy:'outsider',displayName:'Outsider',startAt:start,endAt:end,note:'',status:'pending',createdAt:serverTimestamp()}));
});
test('member cannot mark own request approved',async()=>{
 const db=env.authenticatedContext('member').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+3600000));
 const end=Timestamp.fromDate(new Date(Date.now()+7200000));
 await assertFails(addDoc(collection(db,'houses',HID,'bookingRequests'),{createdBy:'member',displayName:'Member',startAt:start,endAt:end,note:'',status:'approved',createdAt:serverTimestamp()}));
});

test('members can read a request created by another member',async()=>{
 const ownerDb=env.authenticatedContext('owner').firestore();
 const memberDb=env.authenticatedContext('member').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+10800000));
 const end=Timestamp.fromDate(new Date(Date.now()+14400000));
 const created=await addDoc(collection(ownerDb,'houses',HID,'bookingRequests'),{
  createdBy:'owner',displayName:'Owner',startAt:start,endAt:end,note:'',status:'pending',createdAt:serverTimestamp()
 });
 await assertSucceeds(getDoc(doc(memberDb,'houses',HID,'bookingRequests',created.id)));
});
test('ordinary member cannot approve another booking',async()=>{
 const ownerDb=env.authenticatedContext('owner').firestore();
 const memberDb=env.authenticatedContext('member').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+18000000));
 const end=Timestamp.fromDate(new Date(Date.now()+21600000));
 const created=await addDoc(collection(ownerDb,'houses',HID,'bookingRequests'),{
  createdBy:'owner',displayName:'Owner',startAt:start,endAt:end,note:'',status:'pending',createdAt:serverTimestamp()
 });
 await assertFails(updateDoc(doc(memberDb,'houses',HID,'bookingRequests',created.id),{status:'approved'}));
});
test('house members can read the shared schedule, outsiders cannot',async()=>{
 const memberDb=env.authenticatedContext('member').firestore();
 const outsiderDb=env.authenticatedContext('outsider').firestore();
 await assertSucceeds(getDoc(doc(memberDb,'houses',HID,'system','schedule')));
 await assertFails(getDoc(doc(outsiderDb,'houses',HID,'system','schedule')));
});

test('ordinary member cannot grant own instant-use permission',async()=>{
 const db=env.authenticatedContext('member').firestore();
 await assertFails(updateDoc(doc(db,'houses',HID,'memberSettings','member'),{canTakeCar:true,updatedAt:serverTimestamp()}));
});
test('owner can grant instant-use permission to a member',async()=>{
 const db=env.authenticatedContext('owner').firestore();
 await assertSucceeds(updateDoc(doc(db,'houses',HID,'memberSettings','member'),{canTakeCar:true,updatedAt:serverTimestamp()}));
});
test('owner can soft-delete and restore their own house',async()=>{
 const db=env.authenticatedContext('owner').firestore();
 await assertSucceeds(updateDoc(doc(db,'houses',HID),{deletedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(db,'houses',HID),{deletedAt:null}));
});
test('member cannot delete the house',async()=>{
 const db=env.authenticatedContext('member').firestore();
 await assertFails(updateDoc(doc(db,'houses',HID),{deletedAt:serverTimestamp()}));
});
test('instant-use booking and schedule must be created atomically',async()=>{
 const db=env.authenticatedContext('member').firestore();
 const ownerDb=env.authenticatedContext('owner').firestore();
 await assertSucceeds(updateDoc(doc(ownerDb,'houses',HID,'memberSettings','member'),{canTakeCar:true,updatedAt:serverTimestamp()}));
 const start=Timestamp.fromDate(new Date(Date.now()+60_000));
 const end=Timestamp.fromDate(new Date(Date.now()+3600_000));
 const booking=doc(collection(db,'houses',HID,'bookingRequests'));
 const schedule=doc(db,'houses',HID,'system','schedule');
 await assertSucceeds(runTransaction(db,async tx=>{
  const snap=await tx.get(schedule);
  const entries=snap.exists()?snap.data().reservations||[]:[];
  tx.set(booking,{createdBy:'member',displayName:'Member',startAt:start,endAt:end,note:'Test drive',status:'approved',instantMode:'fixed',createdAt:serverTimestamp()});
  tx.set(schedule,{reservations:[...entries,{id:booking.id,createdBy:'member',startAt:start,endAt:end}],updatedAt:serverTimestamp()});
 }));
});
test('non-member cannot view household bookings',async()=>{
 const db=env.authenticatedContext('outsider').firestore();
 await assertFails(getDocs(collection(db,'houses',HID,'bookingRequests')));
});

test('member without instant permission cannot create an approved instant booking',async()=>{
 const memberDb=env.authenticatedContext('member').firestore();
 const ownerDb=env.authenticatedContext('owner').firestore();
 await assertSucceeds(updateDoc(doc(ownerDb,'houses',HID,'memberSettings','member'),{canTakeCar:false,updatedAt:serverTimestamp()}));
 const start=Timestamp.fromDate(new Date(Date.now()+60_000));
 const end=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const booking=doc(collection(memberDb,'houses',HID,'bookingRequests'));
 await assertFails(setDoc(booking,{createdBy:'member',displayName:'Member',startAt:start,endAt:end,note:'',status:'approved',instantMode:'fixed',createdAt:serverTimestamp()}));
});
test('ordinary member with instant permission can use the car immediately',async()=>{
 const ownerDb=env.authenticatedContext('owner').firestore();
 const db=env.authenticatedContext('member').firestore();
 await assertSucceeds(updateDoc(doc(ownerDb,'houses',HID,'memberSettings','member'),{role:'user',canTakeCar:true,updatedAt:serverTimestamp()}));
 const start=Timestamp.fromDate(new Date(Date.now()+60_000));
 const end=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const booking=doc(collection(db,'houses',HID,'bookingRequests'));
 const schedule=doc(db,'houses',HID,'system','schedule');
 await assertSucceeds(runTransaction(db,async tx=>{
  const snap=await tx.get(schedule);
  const entries=snap.exists()?snap.data().reservations||[]:[];
  tx.set(booking,{createdBy:'member',displayName:'Member',startAt:start,endAt:end,note:'',status:'approved',instantMode:'fixed',createdAt:serverTimestamp()});
  tx.set(schedule,{reservations:[...entries,{id:booking.id,createdBy:'member',startAt:start,endAt}],updatedAt:serverTimestamp()});
 }));
});
test('authorized role without instant permission cannot use the car immediately',async()=>{
 const ownerDb=env.authenticatedContext('owner').firestore();
 const db=env.authenticatedContext('member').firestore();
 await assertSucceeds(updateDoc(doc(ownerDb,'houses',HID,'memberSettings','member'),{role:'authorized',canTakeCar:false,updatedAt:serverTimestamp()}));
 const start=Timestamp.fromDate(new Date(Date.now()+60_000));
 const end=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const booking=doc(collection(db,'houses',HID,'bookingRequests'));
 await assertFails(setDoc(booking,{createdBy:'member',displayName:'Member',startAt:start,endAt:end,note:'',status:'approved',instantMode:'fixed',createdAt:serverTimestamp()}));
});
