import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {instantUseEnd,INSTANT_HOLD_MS} from '../booking-time.mjs';

test('untilDone reserves exactly 24 hours, not 30 days',()=>{
 const start=new Date('2026-11-16T19:22:00.000Z');
 const end=instantUseEnd(start,'untilDone',new Date('2026-12-16T19:22:00.000Z'));
 assert.equal(end.toISOString(),'2026-11-17T19:22:00.000Z');
 assert.equal(end.getTime()-start.getTime(),INSTANT_HOLD_MS);
 assert.equal(INSTANT_HOLD_MS,86_400_000);
});

test('24 elapsed hours remain exact across daylight saving transitions',()=>{
 const start=new Date('2027-03-26T19:00:00Z');
 const end=instantUseEnd(start,'untilDone');
 assert.equal(end.getTime()-start.getTime(),86_400_000);
});

test('fixed mode respects chosen end time',()=>{
 const start=new Date('2026-11-16T19:22:00Z');
 const selected=new Date('2026-11-16T22:45:00Z');
 assert.equal(instantUseEnd(start,'fixed',selected).getTime(),selected.getTime());
});

test('invalid modes are rejected',()=>{
 assert.throws(()=>instantUseEnd(new Date(),'wrong'),/Unknown/);
});

test('instant UI retains both modes and displays 24-hour explanation',()=>{
 const source=readFileSync(new URL('../firebase-requests.js',import.meta.url),'utf8');
 assert.match(source,/name="instantMode" value="untilDone" checked/);
 assert.match(source,/name="instantMode" value="fixed"/);
 assert.match(source,/instantUseEnd\(start,mode,chosenEnd\)/);
 assert.match(source,/ל־24 שעות/);
 assert.doesNotMatch(source,/חסימה זמנית של עד 30 יום/);
});

test('Hebrew wheel order is day, minute, hour and matches submitted values',()=>{
 const source=readFileSync(new URL('../firebase-requests.js',import.meta.url),'utf8');
 const day=source.indexOf('id="iosDay"');
 const minute=source.indexOf('id="iosMinute"');
 const hour=source.indexOf('id="iosHour"');
 assert.ok(day>=0&&minute>day&&hour>minute);
 assert.match(source,/const wheels=\[dayWheel,minuteWheel,hourWheel\]/);
 assert.match(source,/selectedDate\(indexes\[0\],indexes\[2\],indexes\[1\]\*15\)/);
});
