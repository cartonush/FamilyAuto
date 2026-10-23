import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,collection,addDoc,Timestamp,serverTimestamp} from 'firebase/firestore';

let env;
const HID='0123456789abcdef0123456789abcdef';
before(async()=>{
 env=await initializeTestEnvironment({projectId:'familyauto-rules-test',firestore:{rules:readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'houses',HID),{name:'Test House',ownerUid:'owner',memberIds:['owner','member'],createdAt:Timestamp.now()});
  await setDoc(doc(db,'houses',HID,'memberSettings','member'),{displayName:'Member',role:'user',suspendedUntil:null,updatedAt:Timestamp.now()});
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
 await assertFails(setDoc(doc(db,'houses',HID,'memberSettings','member'),{displayName:'Member',role:'authorized',suspendedUntil:null,updatedAt:serverTimestamp()}));
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
