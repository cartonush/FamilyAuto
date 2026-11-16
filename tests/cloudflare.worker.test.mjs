import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{recordActivity} from '../cloudflare/worker.js';

test('Cloudflare Worker health endpoint does not require secrets',async()=>{
 const response=await worker.fetch(new Request('https://example.workers.dev/health'),{});
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,service:'FamilyAuto push'});
});
test('Cloudflare Worker permits GitHub Pages CORS preflight',async()=>{
 const response=await worker.fetch(new Request('https://example.workers.dev/dispatch',{method:'OPTIONS',headers:{Origin:'https://cartonush.github.io'}}),{});
 assert.equal(response.status,204);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://cartonush.github.io');
});
test('Cloudflare Worker refuses unauthenticated push dispatch',async()=>{
 const response=await worker.fetch(new Request('https://example.workers.dev/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),{});
 assert.equal(response.status,401);
});
test('Cloudflare Worker rejects unrecognized endpoints',async()=>{
 const response=await worker.fetch(new Request('https://example.workers.dev/unknown'),{});
 assert.equal(response.status,404);
});

test('Cloudflare Worker configuration uses the existing familyauto domain',()=>{
 const config=readFileSync(new URL('../cloudflare/wrangler.toml',import.meta.url),'utf8');
 assert.match(config,/^name\s*=\s*"familyauto"\s*$/m);
 assert.match(config,/^workers_dev\s*=\s*true\s*$/m);
 assert.match(config,/^crons\s*=\s*\["\* \* \* \* \*"\]\s*$/m);
});

test('Cloudflare activity recorder is idempotent and preserves actor identity',async()=>{
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async (url,options={})=>{
  calls.push({url:String(url),options});
  if(String(url).includes('/memberSettings/'))return new Response(JSON.stringify({fields:{displayName:{stringValue:'בודק'}}}),{status:200});
  if(String(url).includes('/activity?documentId='))return new Response('',{status:409});
  throw Error('Unexpected Firestore URL: '+url);
 };
 try{
  const hid='a'.repeat(32),bid='B'.repeat(20);
  const event={name:'projects/familyauto-s/databases/(default)/documents/notificationEvents/'+hid+'_'+bid+'_approved',fields:{
   houseId:{stringValue:hid},bookingId:{stringValue:bid},status:{stringValue:'approved'},
   actorUid:{stringValue:'test-owner'},createdAt:{timestampValue:'2026-11-16T10:00:00Z'}
  }};
  const booking={fields:{
   createdBy:{stringValue:'test-requester'},
   startAt:{timestampValue:'2026-11-17T10:00:00Z'},
   endAt:{timestampValue:'2026-11-17T11:00:00Z'}
  }};
  await recordActivity(event,booking,'fake-oauth');
  assert.equal(calls.length,2);
  const body=JSON.parse(calls[1].options.body).fields;
  assert.equal(body.actorUid.stringValue,'test-owner');
  assert.equal(body.createdBy.stringValue,'test-requester');
  assert.equal(body.displayName.stringValue,'בודק');
  assert.equal(body.occurredAt.timestampValue,'2026-11-16T10:00:00Z');
  assert.equal(calls[1].options.method,'POST');
 }finally{globalThis.fetch=original}
});
test('Cloudflare activity recorder fails closed on Firestore write errors',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  if(String(url).includes('/memberSettings/'))return new Response(JSON.stringify({fields:{}}),{status:200});
  return new Response('',{status:403});
 };
 try{
  const hid='a'.repeat(32),bid='B'.repeat(20);
  await assert.rejects(()=>recordActivity({name:'notificationEvents/'+hid+'_'+bid+'_pending',fields:{
   houseId:{stringValue:hid},bookingId:{stringValue:bid},status:{stringValue:'pending'},actorUid:{stringValue:'user'}
  }},{fields:{createdBy:{stringValue:'user'}}},'fake-oauth'),/Firestore activity 403/);
 }finally{globalThis.fetch=original}
});
