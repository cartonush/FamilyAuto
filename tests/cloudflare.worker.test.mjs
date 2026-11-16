import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare/worker.js';

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
