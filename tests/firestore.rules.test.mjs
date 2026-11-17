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
  tx.set(schedule,{reservations:[...entries,{id:booking.id,createdBy:'member',startAt:start,endAt:end}],updatedAt:serverTimestamp()});
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


const permissionMatrix=[
 {id:'10000000000000000000000000000001',name:'Nisoi1: authorized with instant-use',role:'authorized',canTakeCar:true},
 {id:'10000000000000000000000000000002',name:'Nisoi2: authorized without instant-use',role:'authorized',canTakeCar:false},
 {id:'10000000000000000000000000000003',name:'Nisoi3: ordinary with instant-use',role:'user',canTakeCar:true},
 {id:'10000000000000000000000000000004',name:'Nisoi4: ordinary without instant-use',role:'user',canTakeCar:false}
];
for(const combination of permissionMatrix){
 test('permission matrix: '+combination.name,async()=>{
  const hid=combination.id;
  await env.withSecurityRulesDisabled(async ctx=>{
   const adminDb=ctx.firestore();
   await setDoc(doc(adminDb,'houses',hid),{name:'Permissions Matrix',ownerUid:'owner',memberIds:['owner','test-user'],createdAt:Timestamp.now()});
   await setDoc(doc(adminDb,'houses',hid,'memberSettings','test-user'),{displayName:'Test User',role:combination.role,canTakeCar:combination.canTakeCar,suspendedUntil:null,updatedAt:Timestamp.now()});
  });
  const db=env.authenticatedContext('test-user').firestore();
  const start=Timestamp.fromDate(new Date(Date.now()+60_000));
  const end=Timestamp.fromDate(new Date(Date.now()+3_600_000));
  const booking=doc(collection(db,'houses',hid,'bookingRequests'));
  const bookingData={createdBy:'test-user',displayName:'Test User',startAt:start,endAt:end,note:'Permission test',status:'approved',instantMode:'fixed',createdAt:serverTimestamp()};
  if(combination.canTakeCar){
   const schedule=doc(db,'houses',hid,'system','schedule');
   await assertSucceeds(runTransaction(db,async tx=>{
    const snap=await tx.get(schedule);
    const reservations=snap.exists()?snap.data().reservations||[]:[];
    tx.set(booking,bookingData);
    tx.set(schedule,{reservations:[...reservations,{id:booking.id,createdBy:'test-user',startAt:start,endAt:end}],updatedAt:serverTimestamp()});
   }));
   await assertSucceeds(getDoc(booking));
  }else{
   await assertFails(setDoc(booking,bookingData));
  }
 });
}
test('suspended user cannot create a pending booking or use the car immediately',async()=>{
 const hid='20000000000000000000000000000001';
 await env.withSecurityRulesDisabled(async ctx=>{
  const adminDb=ctx.firestore();
  await setDoc(doc(adminDb,'houses',hid),{name:'Suspension Test',ownerUid:'owner',memberIds:['owner','suspended'],createdAt:Timestamp.now()});
  await setDoc(doc(adminDb,'houses',hid,'memberSettings','suspended'),{displayName:'Suspended',role:'authorized',canTakeCar:true,suspendedUntil:Timestamp.fromDate(new Date(Date.now()+86_400_000)),updatedAt:Timestamp.now()});
 });
 const db=env.authenticatedContext('suspended').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const end=Timestamp.fromDate(new Date(Date.now()+7_200_000));
 await assertFails(addDoc(collection(db,'houses',hid,'bookingRequests'),{createdBy:'suspended',displayName:'Suspended',startAt:start,endAt:end,note:'',status:'pending',createdAt:serverTimestamp()}));
 await assertFails(addDoc(collection(db,'houses',hid,'bookingRequests'),{createdBy:'suspended',displayName:'Suspended',startAt:start,endAt:end,note:'',status:'approved',instantMode:'fixed',createdAt:serverTimestamp()}));
});


const directMatrix=[
 {id:'30000000000000000000000000000001',name:'Nisoi1 authorized and instant',role:'authorized',canTakeCar:true,allowed:true},
 {id:'30000000000000000000000000000002',name:'Nisoi2 authorized only',role:'authorized',canTakeCar:false,allowed:true},
 {id:'30000000000000000000000000000003',name:'Nisoi3 instant only',role:'user',canTakeCar:true,allowed:false},
 {id:'30000000000000000000000000000004',name:'Nisoi4 ordinary',role:'user',canTakeCar:false,allowed:false}
];
for(const config of directMatrix){
 test('future direct reservation: '+config.name,async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'houses',config.id),{name:'Direct Booking',ownerUid:'owner',memberIds:['owner','tester'],createdAt:Timestamp.now()});
   await setDoc(doc(db,'houses',config.id,'memberSettings','tester'),{displayName:'Tester',role:config.role,canTakeCar:config.canTakeCar,suspendedUntil:null,updatedAt:Timestamp.now()});
  });
  const db=env.authenticatedContext('tester').firestore();
  const booking=doc(collection(db,'houses',config.id,'bookingRequests'));
  const schedule=doc(db,'houses',config.id,'system','schedule');
  const start=Timestamp.fromDate(new Date(Date.now()+3_600_000));
  const end=Timestamp.fromDate(new Date(Date.now()+7_200_000));
  const action=()=>runTransaction(db,async tx=>{
   const scheduleSnap=await tx.get(schedule);
   const reservations=scheduleSnap.exists()?scheduleSnap.data().reservations||[]:[];
   tx.set(booking,{createdBy:'tester',displayName:'Tester',startAt:start,endAt:end,note:'Test',status:'approved',approvedBy:'tester',approvedAt:serverTimestamp(),createdAt:serverTimestamp()});
   tx.set(schedule,{reservations:[...reservations,{id:booking.id,createdBy:'tester',startAt:start,endAt:end}],updatedAt:serverTimestamp()});
  });
  if(config.allowed){
   await assertSucceeds(action());
   const booked=await getDoc(booking);
   assert.equal(booked.data().status,'approved');
   await assertSucceeds(runTransaction(db,async tx=>{
    const [bookedSnap,scheduleSnap]=await Promise.all([tx.get(booking),tx.get(schedule)]);
    const reservations=scheduleSnap.data().reservations;
    tx.update(booking,{status:'cancelled'});
    tx.set(schedule,{reservations:reservations.filter(x=>x.id!==booking.id),updatedAt:serverTimestamp()});
   }));
  }else{
   await assertFails(action());
  }
 });
}
test('ordinary member cannot forge a direct approval without updating schedule',async()=>{
 const hid='30000000000000000000000000000005';
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',hid),{name:'No Forgery',ownerUid:'owner',memberIds:['owner','regular'],createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',hid,'memberSettings','regular'),{displayName:'Regular',role:'user',canTakeCar:false,suspendedUntil:null,updatedAt:Timestamp.now()});
 });
 const db=env.authenticatedContext('regular').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const end=Timestamp.fromDate(new Date(Date.now()+7_200_000));
 await assertFails(addDoc(collection(db,'houses',hid,'bookingRequests'),{createdBy:'regular',displayName:'Regular',startAt:start,endAt:end,note:'',status:'approved',approvedBy:'regular',approvedAt:serverTimestamp(),createdAt:serverTimestamp()}));
});
test('suspended authorized member cannot create direct approved booking',async()=>{
 const hid='30000000000000000000000000000006';
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',hid),{name:'Suspended',ownerUid:'owner',memberIds:['owner','suspended'],createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',hid,'memberSettings','suspended'),{displayName:'Suspended',role:'authorized',canTakeCar:true,suspendedUntil:Timestamp.fromDate(new Date(Date.now()+86_400_000)),updatedAt:Timestamp.now()});
 });
 const db=env.authenticatedContext('suspended').firestore();
 const start=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const end=Timestamp.fromDate(new Date(Date.now()+7_200_000));
 const booking=doc(collection(db,'houses',hid,'bookingRequests'));
 const schedule=doc(db,'houses',hid,'system','schedule');
 await assertFails(runTransaction(db,async tx=>{
  await tx.get(schedule);
  tx.set(booking,{createdBy:'suspended',displayName:'Suspended',startAt:start,endAt:end,note:'',status:'approved',approvedBy:'suspended',approvedAt:serverTimestamp(),createdAt:serverTimestamp()});
  tx.set(schedule,{reservations:[{id:booking.id,createdBy:'suspended',startAt:start,endAt:end}],updatedAt:serverTimestamp()});
 }));
});


test('house owner can create and cancel a future reservation without approval',async()=>{
 const hid='30000000000000000000000000000007';
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',hid),{name:'Owner Direct',ownerUid:'owner',memberIds:['owner'],createdAt:Timestamp.now()});
 });
 const db=env.authenticatedContext('owner').firestore();
 const booking=doc(collection(db,'houses',hid,'bookingRequests'));
 const schedule=doc(db,'houses',hid,'system','schedule');
 const start=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const end=Timestamp.fromDate(new Date(Date.now()+7_200_000));
 await assertSucceeds(runTransaction(db,async tx=>{
  await tx.get(schedule);
  tx.set(booking,{createdBy:'owner',displayName:'Owner',startAt:start,endAt:end,note:'',status:'approved',approvedBy:'owner',approvedAt:serverTimestamp(),createdAt:serverTimestamp()});
  tx.set(schedule,{reservations:[{id:booking.id,createdBy:'owner',startAt:start,endAt:end}],updatedAt:serverTimestamp()});
 }));
 await assertSucceeds(runTransaction(db,async tx=>{
  const [bookingSnap,scheduleSnap]=await Promise.all([tx.get(booking),tx.get(schedule)]);
  assert.equal(bookingSnap.data().status,'approved');
  tx.update(booking,{status:'cancelled'});
  tx.set(schedule,{reservations:scheduleSnap.data().reservations.filter(x=>x.id!==booking.id),updatedAt:serverTimestamp()});
 }));
});
test('direct booking cancellation must free the schedule in the same transaction',async()=>{
 const hid='30000000000000000000000000000008';
 const start=Timestamp.fromDate(new Date(Date.now()+3_600_000));
 const end=Timestamp.fromDate(new Date(Date.now()+7_200_000));
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',hid),{name:'Atomic Cancel',ownerUid:'owner',memberIds:['owner','authorized'],createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',hid,'memberSettings','authorized'),{displayName:'Authorized',role:'authorized',canTakeCar:false,suspendedUntil:null,updatedAt:Timestamp.now()});
  await setDoc(doc(db,'houses',hid,'bookingRequests','booking'),{createdBy:'authorized',displayName:'Authorized',startAt:start,endAt:end,note:'',status:'approved',approvedBy:'authorized',approvedAt:Timestamp.now(),createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',hid,'system','schedule'),{reservations:[{id:'booking',createdBy:'authorized',startAt:start,endAt:end}],updatedAt:Timestamp.now()});
 });
 const db=env.authenticatedContext('authorized').firestore();
 await assertFails(updateDoc(doc(db,'houses',hid,'bookingRequests','booking'),{status:'cancelled'}));
});


test('user can register own Web Push device token but not another user token',async()=>{
 const tokenId='a'.repeat(64);
 const tokenData={token:'test-fcm-device-token-long-enough-for-validation',enabled:true,platform:'web',updatedAt:serverTimestamp()};
 const mine=env.authenticatedContext('push-user').firestore();
 await assertSucceeds(setDoc(doc(mine,'users','push-user','pushTokens',tokenId),tokenData));
 await assertFails(setDoc(doc(mine,'users','another-user','pushTokens',tokenId),tokenData));
 await assertFails(getDoc(doc(mine,'users','another-user','pushTokens',tokenId)));
});
test('push tokens reject malformed registration and cannot be read by strangers',async()=>{
 const tokenId='b'.repeat(64);
 const mine=env.authenticatedContext('push-user').firestore();
 await assertFails(setDoc(doc(mine,'users','push-user','pushTokens',tokenId),{
  token:'short',enabled:true,platform:'web',updatedAt:serverTimestamp()
 }));
 const outsider=env.authenticatedContext('outsider').firestore();
 await assertFails(getDoc(doc(outsider,'users','push-user','pushTokens','a'.repeat(64))));
});


test('activity log is readable by house members but cannot be forged by clients',async()=>{
 const refPath=['houses',HID,'activity','audit-event-1'];
 await env.withSecurityRulesDisabled(async ctx=>{
  await setDoc(doc(ctx.firestore(),...refPath),{
   bookingId:'booking-1',eventType:'approved',title:'הרכב הוזמן',
   displayName:'Member',createdBy:'member',
   startAt:Timestamp.now(),endAt:Timestamp.now(),occurredAt:Timestamp.now()
  });
 });
 const memberDb=env.authenticatedContext('member').firestore();
 const outsiderDb=env.authenticatedContext('outsider').firestore();
 await assertSucceeds(getDoc(doc(memberDb,...refPath)));
 await assertFails(getDoc(doc(outsiderDb,...refPath)));
 await assertFails(setDoc(doc(memberDb,'houses',HID,'activity','forged-event'),{
  title:'forged',occurredAt:serverTimestamp()
 }));
});


test('notification outbox can be queued only for an existing booking in the correct status',async()=>{
 const bid='n'.repeat(20),hid=HID,eventId=hid+'_'+bid+'_pending';
 await env.withSecurityRulesDisabled(async ctx=>{
  await setDoc(doc(ctx.firestore(),'houses',hid,'bookingRequests',bid),{
   createdBy:'member',displayName:'Member',status:'pending',
   startAt:Timestamp.fromDate(new Date(Date.now()+3600000)),
   endAt:Timestamp.fromDate(new Date(Date.now()+7200000)),
   createdAt:Timestamp.now(),note:''
  });
 });
 const memberDb=env.authenticatedContext('member').firestore();
 const outsiderDb=env.authenticatedContext('outsider').firestore();
 const queued={houseId:hid,bookingId:bid,status:'pending',actorUid:'member',state:'queued',createdAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(memberDb,'notificationEvents',eventId),queued));
 await assertFails(updateDoc(doc(memberDb,'notificationEvents',eventId),{state:'sent'}));
 await assertFails(setDoc(doc(outsiderDb,'notificationEvents',hid+'_'+bid+'_approved'),{
  ...queued,status:'approved',actorUid:'outsider'
 }));
 await assertFails(setDoc(doc(memberDb,'notificationEvents',hid+'_'+bid+'_approved'),{
  ...queued,status:'approved'
 }));
});

 
// A normal six-hour booking may be ended after 4.5 hours. Only its renter or
// house owner may atomically release the remaining time.
const earlyReturnCases=[
 {hid:'40000000000000000000000000000001',actor:'renter',allowed:true},
 {hid:'40000000000000000000000000000002',actor:'owner',allowed:true},
 {hid:'40000000000000000000000000000003',actor:'other',allowed:false}
];
for(const scenario of earlyReturnCases){
 test('active regular booking early return by '+scenario.actor+' (allowed='+scenario.allowed+')',async()=>{
  const start=Timestamp.fromDate(new Date(Date.now()-4.5*3600_000));
  const end=Timestamp.fromDate(new Date(Date.now()+1.5*3600_000));
  const bid='early-return';
  await env.withSecurityRulesDisabled(async ctx=>{
   const admin=ctx.firestore();
   await setDoc(doc(admin,'houses',scenario.hid),{
    name:'Early Return Test',ownerUid:'owner',memberIds:['owner','renter','other'],createdAt:Timestamp.now()
   });
   await setDoc(doc(admin,'houses',scenario.hid,'bookingRequests',bid),{
    createdBy:'renter',displayName:'Renter',startAt:start,endAt:end,note:'6 hours',
    status:'approved',approvedBy:'owner',approvedAt:Timestamp.now(),createdAt:Timestamp.now()
   });
   await setDoc(doc(admin,'houses',scenario.hid,'system','schedule'),{
    reservations:[{id:bid,createdBy:'renter',startAt:start,endAt:end}],updatedAt:Timestamp.now()
   });
  });
  const db=env.authenticatedContext(scenario.actor).firestore();
  const booking=doc(db,'houses',scenario.hid,'bookingRequests',bid);
  const schedule=doc(db,'houses',scenario.hid,'system','schedule');
  const finish=()=>runTransaction(db,async tx=>{
   const [bookSnap,schedSnap]=await Promise.all([tx.get(booking),tx.get(schedule)]);
   assert.equal(bookSnap.data().status,'approved');
   tx.update(booking,{status:'ended',endedAt:serverTimestamp(),endedBy:scenario.actor});
   tx.set(schedule,{
    reservations:schedSnap.data().reservations.filter(x=>x.id!==bid),
    updatedAt:serverTimestamp()
   });
  });
  if(scenario.allowed){
   await assertSucceeds(finish());
   const [bookSnap,schedSnap]=await Promise.all([getDoc(booking),getDoc(schedule)]);
   assert.equal(bookSnap.data().status,'ended');
   assert.equal(bookSnap.data().endedBy,scenario.actor);
   assert.equal(schedSnap.data().reservations.length,0);
  }else{
   await assertFails(finish());
   assert.equal((await getDoc(booking)).data().status,'approved');
   assert.equal((await getDoc(schedule)).data().reservations.length,1);
  }
 });
}
test('cannot mark an active booking ended without atomically freeing the schedule',async()=>{
 const hid='40000000000000000000000000000004',bid='booking';
 const start=Timestamp.fromDate(new Date(Date.now()-3600_000));
 const end=Timestamp.fromDate(new Date(Date.now()+3600_000));
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',hid),{name:'Atomic Return',ownerUid:'owner',memberIds:['owner','renter'],createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',hid,'bookingRequests',bid),{
   createdBy:'renter',displayName:'Renter',startAt:start,endAt:end,note:'',status:'approved',
   approvedBy:'owner',approvedAt:Timestamp.now(),createdAt:Timestamp.now()
  });
  await setDoc(doc(db,'houses',hid,'system','schedule'),{
   reservations:[{id:bid,createdBy:'renter',startAt:start,endAt:end}],updatedAt:Timestamp.now()
  });
 });
 const db=env.authenticatedContext('renter').firestore();
 await assertFails(updateDoc(doc(db,'houses',hid,'bookingRequests',bid),{
  status:'ended',endedAt:serverTimestamp(),endedBy:'renter'
 }));
});
test('early-return actor identity cannot be forged',async()=>{
 const hid='40000000000000000000000000000005',bid='booking';
 const start=Timestamp.fromDate(new Date(Date.now()-3600_000));
 const end=Timestamp.fromDate(new Date(Date.now()+3600_000));
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',hid),{name:'Return Actor',ownerUid:'owner',memberIds:['owner','renter'],createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',hid,'bookingRequests',bid),{
   createdBy:'renter',displayName:'Renter',startAt:start,endAt:end,note:'',status:'approved',
   approvedBy:'owner',approvedAt:Timestamp.now(),createdAt:Timestamp.now()
  });
  await setDoc(doc(db,'houses',hid,'system','schedule'),{
   reservations:[{id:bid,createdBy:'renter',startAt:start,endAt:end}],updatedAt:Timestamp.now()
  });
 });
 const db=env.authenticatedContext('renter').firestore();
 await assertFails(runTransaction(db,async tx=>{
  const booking=doc(db,'houses',hid,'bookingRequests',bid);
  const schedule=doc(db,'houses',hid,'system','schedule');
  await Promise.all([tx.get(booking),tx.get(schedule)]);
  tx.update(booking,{status:'ended',endedAt:serverTimestamp(),endedBy:'owner'});
  tx.set(schedule,{reservations:[],updatedAt:serverTimestamp()});
 }));
});
