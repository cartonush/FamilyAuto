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
async function sendFCM(token,target,body,eventId,destination){
 const response=await fetch('https://fcm.googleapis.com/v1/projects/'+PROJECT+'/messages:send',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({message:{token:target,data:{
   title:'FamilyAuto',body,eventId,destination
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
 const titles={pending:'בקשה חדשה',approved:'הרכב הוזמן',rejected:'הבקשה נדחתה',cancelled:'ההזמנה בוטלה',ended:'השימוש הסתיים'};
 const member=await firestore('houses/'+houseId+'/memberSettings/'+encodeURIComponent(actorUid),token);
 const displayName=str(member,'displayName')||'חבר בית';
 const startAt=field(booking,'startAt')?.timestampValue;
 const endAt=field(booking,'endAt')?.timestampValue;
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
  occurredAt:{timestampValue:createdAt||new Date().toISOString()}
 }};
 const url=BASE+'/houses/'+houseId+'/activity?documentId='+encodeURIComponent(eventId);
 const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(response.status===409)return;
 if(!response.ok)throw Error('Firestore activity '+response.status);
}
async function processEvent(event,token){
 const eventId=event.name.split('/').pop();
 const hid=str(event,'houseId'),bid=str(event,'bookingId'),status=str(event,'status');
 const actorUid=str(event,'actorUid');
 if(!/^[a-f0-9]{32}$/.test(hid)||!/^[A-Za-z0-9]{20}$/.test(bid)
    ||!['pending','approved','rejected','cancelled','ended'].includes(status)
    ||eventId!==hid+'_'+bid+'_'+status)return markInvalid(event,token);
 const house=await firestore('houses/'+hid,token);
 const booking=await firestore('houses/'+hid+'/bookingRequests/'+bid,token);
 if(!house||!booking||field(house,'deletedAt')?.timestampValue||str(booking,'status')!==status)return markInvalid(event,token);
 const members=arr(house,'memberIds'),owner=str(house,'ownerUid'),requester=str(booking,'createdBy'),approver=str(booking,'approvedBy');
 if(!members.includes(actorUid)||!(actorUid===requester||actorUid===owner))return markInvalid(event,token);
 let recipients=[];
 if(status==='pending')recipients=[owner].filter(uid=>uid!==requester);
 else if(status==='rejected')recipients=[requester].filter(uid=>uid!==actorUid);
 else recipients=members.filter(uid=>uid!==actorUid);
 recipients=[...new Set(recipients)].filter(uid=>members.includes(uid));
 const claimed=await patchEvent(event,token,{state:'processing',leaseUntil:new Date(Date.now()+120000)});
 if(!claimed)return {skipped:true};
 // Record the booking action even when no device has enabled notifications.
 try{await recordActivity(event,booking,token)}
 catch(error){
  await patchEvent(claimed,token,{state:'queued',lastAttemptAt:new Date()});
  throw error;
 }
 const bodyFor=uid=>{
  if(status==='pending')return 'התקבלה בקשה חדשה לשימוש ברכב.';
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
   try{await sendFCM(token,device.token,bodyFor(uid),eventId,destination);sent++}
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
async function markInvalid(event,token){
 await patchEvent(event,token,{state:'invalid',lastAttemptAt:new Date()});
 return {invalid:true};
}
async function processBatch(env,specificId=null){
 const token=await googleAccessToken(env);
 if(specificId){
  if(!/^[a-f0-9]{32}_[A-Za-z0-9]{20}_(pending|approved|rejected|cancelled|ended)$/.test(specificId))return {invalid:true};
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
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='OPTIONS'&&url.pathname==='/dispatch')return new Response(null,{status:204,headers:CORS});
  if(url.pathname==='/health'&&request.method==='GET')return jsonResponse({ok:true,service:'FamilyAuto push'});
  if(url.pathname!=='/dispatch'||request.method!=='POST')return jsonResponse({error:'Not found'},404);
  try{
   const bearer=request.headers.get('Authorization')||'';
   if(!bearer.startsWith('Bearer '))return jsonResponse({error:'Unauthorized'},401);
   const uid=await verifyFirebaseIdToken(bearer.slice(7));
   const data=await request.json();
   if(typeof data.eventId!=='string')return jsonResponse({error:'Bad request'},400);
   const token=await googleAccessToken(env);
   const event=await firestore('notificationEvents/'+encodeURIComponent(data.eventId),token);
   if(!event||str(event,'actorUid')!==uid)return jsonResponse({error:'Forbidden'},403);
   const result=await processBatch(env,data.eventId);
   return jsonResponse(result);
  }catch(error){console.error(error);return jsonResponse({error:'Dispatch failed'},500)}
 },
 async scheduled(controller,env,ctx){
  ctx.waitUntil(processBatch(env).then(result=>console.log('FamilyAuto push batch',result))
   .catch(error=>console.error('FamilyAuto push cron',error)));
 }
};

// Exposed for isolated unit tests; not an HTTP endpoint.
export {recordActivity};
