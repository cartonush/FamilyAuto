// FamilyAuto 2.0 — Cloudflare Worker (free tier)
// Requires secret FIREBASE_SERVICE_ACCOUNT_JSON, containing a Firebase service
// account with Firestore read/write and Firebase Cloud Messaging send permissions.
// Never expose this credential in GitHub or in a browser.
const PROJECT='familyauto-s';
const BASE='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const encoder=new TextEncoder();
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decodeB64url=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const CORS={'Access-Control-Allow-Origin':'https://cartonush.github.io','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...CORS}});
const field=(obj,key)=>obj?.fields?.[key];
const str=(obj,key)=>field(obj,key)?.stringValue||'';
const arr=(obj,key)=>field(obj,key)?.arrayValue?.values?.map(x=>x.stringValue).filter(Boolean)||[];
const state=(obj)=>str(obj,'state');
const fields=(values)=>Object.fromEntries(Object.entries(values).map(([k,v])=>[k,typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:{timestampValue:v.toISOString()}]));
async function signRS256(data,privateKey){
 const stripped=privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const binary=Uint8Array.from(atob(stripped),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',binary,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 return b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(data))));
}
async function googleAccessToken(env){
 const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}');
 if(!account.client_email||!account.private_key)throw Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON secret');
 const now=Math.floor(Date.now()/1000);
 const header=b64url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const payload=b64url(encoder.encode(JSON.stringify({
  iss:account.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',
  aud:GOOGLE_TOKEN,iat:now,exp:now+3500
 })));
 const unsigned=header+'.'+payload;
 const assertion=unsigned+'.'+await signRS256(unsigned,account.private_key);
 const body=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion});
 const response=await fetch(GOOGLE_TOKEN,{method:'POST',body});
 const data=await response.json();
 if(!response.ok||!data.access_token)throw Error('Google OAuth: '+response.status);
 return data.access_token;
}
async function firestore(path,token,init={}){
 const response=await fetch(BASE+'/'+path,{...init,headers:{Authorization:'Bearer '+token,...init.headers}});
 if(response.status===404)return null;
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error('Firestore '+response.status+': '+JSON.stringify(data).slice(0,250));
 return data;
}
async function queryEvents(token,eventState,limit=50){
 const response=await fetch(BASE+':runQuery',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({structuredQuery:{
   from:[{collectionId:'notificationEvents'}],
   where:{fieldFilter:{field:{fieldPath:'state'},op:'EQUAL',value:{stringValue:eventState}}},
   limit
  }})
 });
 if(!response.ok)throw Error('Firestore runQuery '+response.status);
 const data=await response.json();
 return data.map(row=>row.document).filter(Boolean);
}
async function patchEvent(event,token,updates){
 const name=event.name;
 const url=new URL('https://firestore.googleapis.com/v1/'+name);
 for(const key of Object.keys(updates))url.searchParams.append('updateMask.fieldPaths',key);
 url.searchParams.set('currentDocument.updateTime',event.updateTime);
 const response=await fetch(url,{method:'PATCH',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },body:JSON.stringify({name,fields:fields(updates)})});
 if(response.status===409||response.status===412)return null;
 if(!response.ok)throw Error('Claim update '+response.status);
 return response.json();
}
async function listTokens(uid,token){
 const result=await firestore('users/'+encodeURIComponent(uid)+'/pushTokens?pageSize=100',token);
 return (result?.documents||[]).filter(d=>field(d,'enabled')?.booleanValue===true).map(d=>({
  token:str(d,'token'),name:d.name
 })).filter(d=>d.token);
}
async function sendFCM(token,target,title,body,eventId,destination){
 const response=await fetch('https://fcm.googleapis.com/v1/projects/'+PROJECT+'/messages:send',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({message:{token:target,data:{
   title,body,eventId,destination
  },webpush:{headers:{TTL:'3600',Urgency:'normal'}}}})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error('FCM '+response.status+' '+(result?.error?.status||''));
}
// Append-only activity history on the free Cloudflare backend. An event ID is
// deterministic, so scheduled retries cannot create duplicate history entries.
async function recordActivity(event,booking,token){
 const eventId=event.name.split('/').pop();
 const houseId=str(event,'houseId'),actorUid=str(event,'actorUid'),status=str(event,'status');
 const titles={pending:'בקשה חדשה',approved:str(booking,'instantMode')?'הרכב נלקח עכשיו':'הרכב הוזמן',rejected:'הבקשה נדחתה',cancelled:'ההזמנה בוטלה',ended:'השימוש הסתיים'};
 const member=await firestore('houses/'+houseId+'/memberSettings/'+encodeURIComponent(actorUid),token);
 const displayName=str(member,'displayName')||'חבר בית';
 const startAt=field(booking,'startAt')?.timestampValue;
 const endAt=field(booking,'endAt')?.timestampValue;
 const endedAt=field(booking,'endedAt')?.timestampValue;
 const createdAt=field(event,'createdAt')?.timestampValue;
 const payload={fields:{
  bookingId:{stringValue:str(event,'bookingId')},
  eventType:{stringValue:status},
  title:{stringValue:titles[status]},
  displayName:{stringValue:displayName.slice(0,60)},
  actorUid:{stringValue:actorUid},
  createdBy:{stringValue:str(booking,'createdBy')},
  ...(startAt?{startAt:{timestampValue:startAt}}:{}),
  ...(endAt?{endAt:{timestampValue:endAt}}:{}),
  ...(endedAt?{endedAt:{timestampValue:endedAt}}:{}),
  occurredAt:{timestampValue:createdAt||new Date().toISOString()}
 }};
 const url=BASE+'/houses/'+houseId+'/activity?documentId='+encodeURIComponent(eventId);
 const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(response.status===409)return;
 if(!response.ok)throw Error('Firestore activity '+response.status);
}
async function processEvent(event,token){
 if(str(event,'kind')==='join')return processJoinEvent(event,token);
 const eventId=event.name.split('/').pop();
 const hid=str(event,'houseId'),bid=str(event,'bookingId'),status=str(event,'status');
 const actorUid=str(event,'actorUid');
 if(!/^[a-f0-9]{32}$/.test(hid)||!/^[A-Za-z0-9]{20}$/.test(bid)
    ||!['pending','approved','rejected','cancelled','ended'].includes(status)
    ||eventId!==hid+'_'+bid+'_'+status)return markInvalid(event,token);
 const house=await firestore('houses/'+hid,token);
 const booking=await firestore('houses/'+hid+'/bookingRequests/'+bid,token);
 if(!house||!booking||field(house,'deletedAt')?.timestampValue||str(booking,'status')!==status)return markInvalid(event,token);
 const members=arr(house,'memberIds'),owner=str(house,'ownerUid'),requester=str(booking,'createdBy');
 if(!members.includes(actorUid)||!(actorUid===requester||actorUid===owner))return markInvalid(event,token);
 let recipients=[];
 if(status==='pending')recipients=[owner].filter(uid=>uid!==requester);
 else if(status==='rejected')recipients=[requester].filter(uid=>uid!==actorUid);
 else recipients=members.filter(uid=>uid!==actorUid);
 if(status==='approved'&&requester!==actorUid)recipients.push(requester);
 recipients=[...new Set(recipients)].filter(uid=>members.includes(uid)||(['approved','rejected'].includes(status)&&uid===requester));
 const claimed=await patchEvent(event,token,{state:'processing',leaseUntil:new Date(Date.now()+120000)});
 if(!claimed)return {skipped:true};
 // Record the booking action even when no device has enabled notifications.
 try{await recordActivity(event,booking,token)}
 catch(error){
  await patchEvent(claimed,token,{state:'queued',lastAttemptAt:new Date()});
  throw error;
 }
 const instantMode=status==='approved'?str(booking,'instantMode'):'';
 const requesterName=str(booking,'displayName')||'חבר בית';
 const titleFor=uid=>instantMode?'הרכב נלקח עכשיו':status==='approved'&&uid===requester?'הבקשה שלך אושרה':'FamilyAuto';
 const bodyFor=uid=>{
  if(status==='pending')return 'התקבלה בקשה חדשה לשימוש ברכב.';
  if(instantMode)return requesterName+' התחיל עכשיו להשתמש ברכב.';
  if(status==='approved')return uid===requester?'הבקשה שלך לשימוש ברכב אושרה!':'עדכון חדש על הרכב התקבל, בדקו!';
  if(status==='rejected')return 'הבקשה שלך לשימוש ברכב נדחתה.';
  if(status==='cancelled')return 'הזמנה או בקשה לרכב בוטלה. בדקו את לוח השנה.';
  return 'השימוש ברכב הסתיים. בדקו את הזמינות.';
 };
 const destination=['pending','rejected'].includes(status)?'requests':'calendar';
 let sent=0,failed=0;
 for(const uid of recipients){
  const tokens=await listTokens(uid,token);
  for(const device of tokens){
   try{await sendFCM(token,device.token,titleFor(uid),bodyFor(uid),eventId,destination);sent++}
   catch(error){failed++;console.error('FCM delivery failed',eventId,error.message)}
  }
 }
 const result=await patchEvent(claimed,token,{
  state:failed?'queued':'sent',
  lastAttemptAt:new Date(),
  lastResult:'sent='+sent+';failed='+failed
 });
 return {sent,failed,completed:!!result};
}
async function processJoinEvent(event,token){
 const eventId=event.name.split('/').pop();
 const hid=str(event,'houseId'),targetUid=str(event,'targetUid'),status=str(event,'status'),actorUid=str(event,'actorUid');
 if(!/^[a-f0-9]{32}$/.test(hid)||!targetUid||targetUid.length>128
    ||!['pending','accepted','rejected'].includes(status)
    ||eventId!==hid+'_join_'+targetUid+'_'+status)return markInvalid(event,token);
 const house=await firestore('houses/'+hid,token);
 const joinRequest=await firestore('houses/'+hid+'/joinRequests/'+encodeURIComponent(targetUid),token);
 if(!house||!joinRequest||field(house,'deletedAt')?.timestampValue||str(joinRequest,'status')!==status
    ||str(joinRequest,'uid')!==targetUid)return markInvalid(event,token);
 const owner=str(house,'ownerUid'),members=arr(house,'memberIds');
 if((status==='pending'&&(actorUid!==targetUid||owner===targetUid||members.includes(targetUid)))
    ||(status!=='pending'&&actorUid!==owner))return markInvalid(event,token);
 const recipient=status==='pending'?owner:targetUid;
 if(!recipient||recipient===actorUid)return markInvalid(event,token);
 const claimed=await patchEvent(event,token,{state:'processing',leaseUntil:new Date(Date.now()+120000)});
 if(!claimed)return {skipped:true};
 const displayName=str(joinRequest,'displayName')||'משתמש';
 const houseName=str(house,'name')||'הבית';
 const title=status==='pending'?'בקשת הצטרפות לבית':status==='accepted'?'בקשת ההצטרפות אושרה':'בקשת ההצטרפות נדחתה';
 const body=status==='pending'?displayName+' מבקש להצטרף ל'+houseName+'.':status==='accepted'?'בקשת ההצטרפות שלך ל'+houseName+' אושרה.':'בקשת ההצטרפות שלך ל'+houseName+' נדחתה.';
 let sent=0,failed=0;
 const tokens=await listTokens(recipient,token);
 for(const device of tokens){
  try{await sendFCM(token,device.token,title,body,eventId,'settings-houses');sent++}
  catch(error){failed++;console.error('FCM join delivery failed',eventId,error.message)}
 }
 const result=await patchEvent(claimed,token,{state:failed?'queued':'sent',lastAttemptAt:new Date(),lastResult:'sent='+sent+';failed='+failed});
 return {sent,failed,completed:!!result};
}
async function markInvalid(event,token){
 await patchEvent(event,token,{state:'invalid',lastAttemptAt:new Date()});
 return {invalid:true};
}
async function processBatch(env,specificId=null){
 const token=await googleAccessToken(env);
 if(specificId){
  const bookingEvent=/^[a-f0-9]{32}_[A-Za-z0-9]{20}_(pending|approved|rejected|cancelled|ended)$/.test(specificId);
  const joinEvent=/^[a-f0-9]{32}_join_.+_(pending|accepted|rejected)$/.test(specificId);
  if(!bookingEvent&&!joinEvent)return {invalid:true};
  const event=await firestore('notificationEvents/'+specificId,token);
  if(!event)return {missing:true};
  if(state(event)!=='queued')return {skipped:true};
  return processEvent(event,token);
 }
 const queued=await queryEvents(token,'queued',50);
 const processing=await queryEvents(token,'processing',50);
 const expired=processing.filter(e=>{
  const lease=field(e,'leaseUntil')?.timestampValue;
  return lease&&Date.parse(lease)<Date.now();
 });
 for(const e of expired)await patchEvent(e,token,{state:'queued'});
 let sent=0,failed=0;
 for(const event of queued){
  try{const result=await processEvent(event,token);sent+=result?.sent||0;failed+=result?.failed||0}
  catch(error){failed++;console.error('FamilyAuto event',event.name,error.message)}
 }
 return {processed:queued.length,sent,failed,recovered:expired.length};
}
async function verifyFirebaseIdToken(jwt){
 // Verify RS256 signature against Google's Firebase Secure Token public certificates.
 const parts=jwt.split('.');
 if(parts.length!==3)throw Error('Invalid JWT');
 const header=JSON.parse(new TextDecoder().decode(decodeB64url(parts[0])));
 const payload=JSON.parse(new TextDecoder().decode(decodeB64url(parts[1])));
 if(header.alg!=='RS256'||!header.kid||payload.aud!==PROJECT||
  payload.iss!=='https://securetoken.google.com/'+PROJECT||
  !payload.sub||payload.sub.length>128||payload.exp<=Date.now()/1000||
  payload.iat>Date.now()/1000)throw Error('Invalid Firebase token claims');
 const keysResponse=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
 if(!keysResponse.ok)throw Error('Unable to verify Firebase token');
 const jwks=await keysResponse.json();
 const jwk=jwks.keys?.find(k=>k.kid===header.kid);
 if(!jwk)throw Error('Unknown token signing key');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeB64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
 if(!valid)throw Error('Invalid Firebase token signature');
 return payload.sub;
}
// Atomic ownership transfer via Firestore REST commit. This runs on Workers
// Free and does not require Firebase Cloud Functions / Blaze.
async function transferOwnership(uid,houseId,successorUid,token){
 if(typeof houseId!=='string'||!/^[a-f0-9]{32}$/.test(houseId)||
    typeof successorUid!=='string'||successorUid.length>128||!successorUid||successorUid===uid)
  return jsonResponse({error:'יש לבחור בית וחבר בית אחר.'},400);
 const house=await firestore('houses/'+houseId,token);
 if(!house)return jsonResponse({error:'הבית לא נמצא.'},404);
 if(str(house,'ownerUid')!==uid)return jsonResponse({error:'רק מנהל הבית יכול להעביר בעלות.'},403);
 if(field(house,'deletedAt')?.timestampValue)return jsonResponse({error:'יש לשחזר את הבית לפני העברת בעלות.'},409);
 if(!arr(house,'memberIds').includes(successorUid))return jsonResponse({error:'יש לבחור חבר מאושר בבית.'},409);
 const memberName='projects/'+PROJECT+'/databases/(default)/documents/houses/'+houseId+'/memberSettings/'+encodeURIComponent(uid);
 const response=await fetch(BASE+':commit',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({writes:[
   {update:{name:house.name,fields:{ownerUid:{stringValue:successorUid}}},
    updateMask:{fieldPaths:['ownerUid']},currentDocument:{updateTime:house.updateTime}},
   {update:{name:memberName,fields:{role:{stringValue:'user'},canTakeCar:{booleanValue:false},
     updatedAt:{timestampValue:new Date().toISOString()}}},
    updateMask:{fieldPaths:['role','canTakeCar','updatedAt']}}
  ]})
 });
 if(response.status===409||response.status===412)return jsonResponse({error:'פרטי הבית השתנו. רענן ונסה שוב.'},409);
 if(!response.ok)throw Error('Ownership transfer '+response.status);
 return jsonResponse({success:true});
}
async function listAllDocuments(collectionPath,token){
 const documents=[];let pageToken='';
 do{
  const path=collectionPath+'?pageSize=1000'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
  const result=await firestore(path,token);
  documents.push(...(result?.documents||[]));pageToken=result?.nextPageToken||'';
 }while(pageToken);
 return documents;
}
async function listHouseEvents(collectionId,houseId,token){
 const documents=[];let startAfter='';
 while(true){
  const structuredQuery={from:[{collectionId}],
   where:{fieldFilter:{field:{fieldPath:'houseId'},op:'EQUAL',value:{stringValue:houseId}}},
   orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:500};
  if(startAfter)structuredQuery.startAt={values:[{referenceValue:startAfter}],before:false};
  const response=await fetch(BASE+':runQuery',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({structuredQuery})
  });
  if(!response.ok)throw Error('Firestore query '+collectionId+' '+response.status);
  const page=(await response.json()).map(row=>row.document).filter(Boolean);
  documents.push(...page);if(page.length<500)break;startAfter=page[page.length-1].name;
 }
 return documents;
}
async function deleteDocuments(documents,token){
 const names=[...new Set(documents.map(item=>item.name).filter(Boolean))];
 for(let index=0;index<names.length;index+=400){
  const response=await fetch(BASE+':commit',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({writes:names.slice(index,index+400).map(name=>({delete:name}))})
  });
  if(!response.ok)throw Error('Firestore delete batch '+response.status);
 }
}
async function permanentlyDeleteHouse(uid,houseId,confirmName,token){
 if(typeof houseId!=='string'||!/^[a-f0-9]{32}$/.test(houseId)||typeof confirmName!=='string')
  return jsonResponse({error:'פרטי הבית או האישור אינם תקינים.'},400);
 const house=await firestore('houses/'+houseId,token);
 if(!house)return jsonResponse({error:'הבית לא נמצא.'},404);
 if(str(house,'ownerUid')!==uid)return jsonResponse({error:'רק מנהל הבית יכול למחוק אותו.'},403);
 if(!field(house,'deletedAt')?.timestampValue)return jsonResponse({error:'יש להעביר את הבית לאזור השחזור לפני מחיקה לצמיתות.'},409);
 if(str(house,'name')!==confirmName)return jsonResponse({error:'שם הבית שהוקלד אינו תואם.'},409);
 const [bookings,joinRequests,memberSettings,activity,system,events,deliveries]=await Promise.all([
  listAllDocuments('houses/'+houseId+'/bookingRequests',token),
  listAllDocuments('houses/'+houseId+'/joinRequests',token),
  listAllDocuments('houses/'+houseId+'/memberSettings',token),
  listAllDocuments('houses/'+houseId+'/activity',token),
  listAllDocuments('houses/'+houseId+'/system',token),
  listHouseEvents('notificationEvents',houseId,token),
  listHouseEvents('notificationDeliveries',houseId,token)
 ]);
 await deleteDocuments([...bookings,...joinRequests,...memberSettings,...activity,...system,...events,...deliveries],token);
 const latest=await firestore('houses/'+houseId,token);
 if(!latest)return jsonResponse({success:true});
 if(str(latest,'ownerUid')!==uid||str(latest,'name')!==confirmName||!field(latest,'deletedAt')?.timestampValue)
  return jsonResponse({error:'פרטי הבית השתנו בזמן המחיקה. רענן ונסה שוב.'},409);
 const url=new URL(BASE+'/houses/'+houseId);
 url.searchParams.set('currentDocument.updateTime',latest.updateTime);
 const response=await fetch(url,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
 if(response.status===409||response.status===412)return jsonResponse({error:'פרטי הבית השתנו בזמן המחיקה. רענן ונסה שוב.'},409);
 if(!response.ok)throw Error('Firestore house delete '+response.status);
 return jsonResponse({success:true});
}
function activeBookingForUser(booking){
 const status=str(booking,'status'),end=field(booking,'endAt')?.timestampValue;
 return status==='pending'||(status==='approved'&&end&&Date.parse(end)>Date.now());
}
async function loadMemberBookings(houseId,uid,token){
 const bookings=await listAllDocuments('houses/'+houseId+'/bookingRequests',token);
 return bookings.filter(item=>str(item,'createdBy')===uid);
}
async function changeHouseMember(actorUid,houseId,targetUid,token){
 if(typeof houseId!=='string'||!/^[a-f0-9]{32}$/.test(houseId)||typeof targetUid!=='string'||!targetUid||targetUid.length>128)
  return jsonResponse({error:'פרטי הבית או המשתמש אינם תקינים.'},400);
 const house=await firestore('houses/'+houseId,token);
 if(!house)return jsonResponse({error:'הבית לא נמצא.'},404);
 if(field(house,'deletedAt')?.timestampValue)return jsonResponse({error:'יש לשחזר את הבית לפני שינוי החברים.'},409);
 const members=arr(house,'memberIds'),ownerUid=str(house,'ownerUid');
 const leaving=actorUid===targetUid&&actorUid!==ownerUid;
 const ownerRemoving=actorUid===ownerUid&&targetUid!==ownerUid;
 if(!leaving&&!ownerRemoving)return jsonResponse({error:'רק חבר יכול לעזוב, ומנהל הבית יכול להוציא חבר אחר.'},403);
 if(!members.includes(targetUid))return jsonResponse({error:'המשתמש אינו חבר בבית הזה.'},409);
 const bookings=await loadMemberBookings(houseId,targetUid,token);
 if(bookings.some(activeBookingForUser))return jsonResponse({error:'יש למשתמש בקשה ממתינה או הזמנת רכב עתידית. יש לטפל בה לפני עזיבת הבית.'},409);
 const newMembers=members.filter(id=>id!==targetUid);
 const memberSettingsName='projects/'+PROJECT+'/databases/(default)/documents/houses/'+houseId+'/memberSettings/'+encodeURIComponent(targetUid);
 const joinRequestName='projects/'+PROJECT+'/databases/(default)/documents/houses/'+houseId+'/joinRequests/'+encodeURIComponent(targetUid);
 const response=await fetch(BASE+':commit',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({writes:[
   {update:{name:house.name,fields:{memberIds:{arrayValue:{values:newMembers.map(uid=>({stringValue:uid}))}}}},updateMask:{fieldPaths:['memberIds']},currentDocument:{updateTime:house.updateTime}},
   {delete:memberSettingsName},{delete:joinRequestName}
  ]})
 });
 if(response.status===409||response.status===412)return jsonResponse({error:'רשימת החברים השתנתה. רענן ונסה שוב.'},409);
 if(!response.ok)throw Error('House membership update '+response.status);
 return jsonResponse({success:true});
}
async function cleanupAccountData(uid,token){
 const allHouses=await listAllDocuments('houses',token);
 const houses=allHouses.filter(h=>arr(h,'memberIds').includes(uid));
 if(houses.some(h=>str(h,'ownerUid')===uid))
  return jsonResponse({error:'לפני מחיקת החשבון יש להעביר את ניהול הבתים שלך או למחוק אותם.'},409);
 const bookingsByHouse=await Promise.all(houses.map(h=>loadMemberBookings(h.name.split('/').pop(),uid,token)));
 if(bookingsByHouse.some(bookings=>bookings.some(activeBookingForUser)))
  return jsonResponse({error:'יש לך בקשה ממתינה או הזמנת רכב עתידית. יש לטפל בה לפני מחיקת החשבון.'},409);
 for(let index=0;index<houses.length;index++){
  const house=houses[index],houseId=house.name.split('/').pop();
  const bookings=bookingsByHouse[index];
  for(const booking of bookings)if(str(booking,'displayName'))await replaceDisplayName(booking,token);
  const activities=await listAllDocuments('houses/'+houseId+'/activity',token);
  for(const activity of activities)if(str(activity,'actorUid')===uid&&str(activity,'displayName'))await replaceDisplayName(activity,token);
  const members=arr(house,'memberIds').filter(memberUid=>memberUid!==uid);
  const response=await fetch(BASE+':commit',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({writes:[
    {update:{name:house.name,fields:{memberIds:{arrayValue:{values:members.map(memberUid=>({stringValue:memberUid}))}}}},updateMask:{fieldPaths:['memberIds']},currentDocument:{updateTime:house.updateTime}},
    {delete:'projects/'+PROJECT+'/databases/(default)/documents/houses/'+houseId+'/memberSettings/'+encodeURIComponent(uid)},
    {delete:'projects/'+PROJECT+'/databases/(default)/documents/houses/'+houseId+'/joinRequests/'+encodeURIComponent(uid)}
   ]})
  });
  if(!response.ok)throw Error('Account house cleanup '+response.status);
 }
 await firestore('profiles/'+encodeURIComponent(uid),token,{method:'DELETE'});
 const tokens=await listAllDocuments('users/'+encodeURIComponent(uid)+'/pushTokens',token);
 await deleteDocuments(tokens,token);
 await firestore('users/'+encodeURIComponent(uid),token,{method:'DELETE'});
 return jsonResponse({success:true});
}
async function replaceDisplayName(document,token){
 const url=new URL('https://firestore.googleapis.com/v1/'+document.name);
 url.searchParams.append('updateMask.fieldPaths','displayName');
 url.searchParams.set('currentDocument.updateTime',document.updateTime);
 const response=await fetch(url,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name:document.name,fields:{displayName:{stringValue:'משתמש שנמחק'}}})});
 if(response.status===409||response.status===412)return;
 if(!response.ok)throw Error('Account history cleanup '+response.status);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='OPTIONS'&&['/dispatch','/account/transfer','/account/delete','/account/membership','/account/cleanup'].includes(url.pathname))return new Response(null,{status:204,headers:CORS});
  if(url.pathname==='/health'&&request.method==='GET')return jsonResponse({ok:true,service:'FamilyAuto push'});
  if(!['/dispatch','/account/transfer','/account/delete','/account/membership','/account/cleanup'].includes(url.pathname)||request.method!=='POST')return jsonResponse({error:'הפעולה לא נמצאה.'},404);
  try{
   const bearer=request.headers.get('Authorization')||'';
   if(!bearer.startsWith('Bearer '))return jsonResponse({error:'יש להתחבר לחשבון כדי לבצע את הפעולה.'},401);
   const uid=await verifyFirebaseIdToken(bearer.slice(7));
   const data=await request.json();
   if(url.pathname==='/account/transfer'){
    const token=await googleAccessToken(env);
    return transferOwnership(uid,data?.houseId,data?.successorUid,token);
   }
   if(url.pathname==='/account/delete'){
    const token=await googleAccessToken(env);
    return permanentlyDeleteHouse(uid,data?.houseId,data?.confirmName,token);
   }
   if(url.pathname==='/account/membership'){
    const token=await googleAccessToken(env);
    return changeHouseMember(uid,data?.houseId,data?.targetUid,token);
   }
   if(url.pathname==='/account/cleanup'){
    const token=await googleAccessToken(env);
    return cleanupAccountData(uid,token);
   }
   if(typeof data.eventId!=='string')return jsonResponse({error:'הבקשה אינה תקינה.'},400);
   const token=await googleAccessToken(env);
   const event=await firestore('notificationEvents/'+encodeURIComponent(data.eventId),token);
   if(!event||str(event,'actorUid')!==uid)return jsonResponse({error:'אין לך הרשאה לבצע את הפעולה הזאת.'},403);
   const result=await processBatch(env,data.eventId);
   return jsonResponse(result);
  }catch(error){console.error(error);return jsonResponse({error:'לא ניתן להשלים את הפעולה כרגע. בדוק את החיבור ונסה שוב.'},500)}
 },
 async scheduled(controller,env,ctx){
  ctx.waitUntil(processBatch(env).then(result=>console.log('FamilyAuto push batch',result))
   .catch(error=>console.error('FamilyAuto push cron',error)));
 }
};

// Exposed for isolated unit tests; not an HTTP endpoint.
export {recordActivity,transferOwnership};
