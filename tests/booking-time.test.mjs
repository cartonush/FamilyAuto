import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {instantUseEnd,nextClockEnd,INSTANT_HOLD_MS} from '../booking-time.mjs';

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

test('instant home popup has two modes, hour/minute wheels and 24-hour fallback',()=>{
 const source=readFileSync(new URL('../firebase-requests.js',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../navigation.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(source,/id="instantChoiceDialog"/);
 assert.match(source,/id="instantUntilDone"/);
 assert.match(source,/id="instantFixed"/);
 assert.match(source,/id="instantTimeFields" hidden/);
 assert.ok(source.indexOf('id="instantMinute"')<source.indexOf('id="instantHour"'),'Minute wheel should appear first in RTL markup');
 assert.match(source,/const instantWheels=\[instantMinute,instantHour\]/);
 assert.match(source,/instantUseEnd\(start,mode,chosenEnd\)/);
 assert.match(source,/ל־24 שעות/);
 assert.match(source,/window.addEventListener\('familyauto:instant-open',openInstantDialog\)/);
 assert.doesNotMatch(nav,/navigate\('requests'\);\s*window.dispatchEvent\(new Event\('familyauto:instant-open'\)\)/);
 assert.match(css,/\.instant-clock-wheels\s*\{[^}]*direction:\s*rtl/);
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

test('selected end time in past today rolls to tomorrow',()=>{
 const start=new Date(2026,10,16,21,22);
 const end=nextClockEnd(start,20,45);
 assert.equal(end.getDate(),17);
 assert.equal(end.getHours(),20);
 assert.equal(end.getMinutes(),45);
});

test('selected future clock time stays today',()=>{
 const start=new Date(2026,10,16,9,12);
 const end=nextClockEnd(start,10,30);
 assert.equal(end.getDate(),16);
 assert.equal(end.getHours(),10);
 assert.equal(end.getMinutes(),30);
});

test('selection within 15 minutes rolls to tomorrow',()=>{
 const start=new Date(2026,10,16,10,1);
 const end=nextClockEnd(start,10,15);
 assert.equal(end.getDate(),17);
});

test('minutes must be in 15-minute increments',()=>{
 assert.throws(()=>nextClockEnd(new Date(),12,17),/Invalid/);
});

test('home instant booking opens a dialog rather than switching tabs',()=>{
 const nav=readFileSync(new URL('../navigation.js',import.meta.url),'utf8');
 assert.match(nav,/instantHomeButton\?\.addEventListener\('click'/);
 assert.match(nav,/window\.dispatchEvent\(new Event\('familyauto:instant-open'\)\)/);
 const source=readFileSync(new URL('../firebase-requests.js',import.meta.url),'utf8');
 assert.match(source,/instantDialog\.showModal\(\)/);
 assert.match(source,/await startInstant\(mode,chosen\)/);
});

test('normal active booking early return is limited to renter or house owner',()=>{
 const source=readFileSync(new URL('../firebase-requests.js',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../navigation.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(source,/record\.createdBy===currentUser\.uid\|\|selected\.ownerUid===currentUser\.uid/);
 assert.match(source,/async function finishApproved\(record\)/);
 assert.match(source,/status:'ended',endedAt:serverTimestamp\(\),endedBy:uid/);
 assert.match(source,/reservations:entries\.filter\(r=>r\.id!==record\.id\)/);
 assert.match(source,/החזרה כפויה — שחרור הרכב/);
 assert.match(source,/r\.startAt\?\.toMillis\?\.\(\)>Date\.now\(\)/);
 assert.match(nav,/id===active\.id&&r\.status==='approved'/);
 assert.match(nav,/familyauto:finish-active/);
 assert.match(html,/id="homeFinishBtn"/);
 assert.match(nav,/!\['cancelled','rejected','ended'\]\.includes\(r\.status\)/);
});
