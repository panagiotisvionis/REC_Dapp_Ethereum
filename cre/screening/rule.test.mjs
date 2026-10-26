import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screen} from './rule.ts';
const now=Date.parse('2026-10-26T12:00:00Z');
const cfg={threshold:3,lambda:.5,windowDays:30,minKwh:1000,maxReadingAgeSeconds:7200,maxHistoryAgeDays:45,maxKwh:20000};
const current={timestampUtc:new Date(now).toISOString(),kwh:2080};
const history=Array.from({length:30},(_,i)=>({timestampUtc:new Date(now-(30-i)*86400000).toISOString(),kwh:2000+(i%5)*40}));
const run=(c=current,h=history,p=cfg)=>screen(c,h,p,now);
test('admission includes ordered evidence and aligned production interval',()=>{
 const r=run();assert.equal(r.kwh,2080);assert.equal(r.end-r.start,3600);assert.equal(JSON.parse(r.evidence).history.length,30);
});
test('unordered history is sorted deterministically',()=>assert.deepEqual(run(current,[...history].reverse()),run()));
test('rejects duplicate dates instead of fabricating a 30-day baseline',()=>assert.ok(run(current,Array(30).fill(history[0])).reject));
test('rejects history containing the current or a later reading',()=>{assert.ok(run(current,[...history,current]).reject);assert.ok(run(current,[...history,{...current,timestampUtc:new Date(now+86400000).toISOString()}]).reject);});
test('rejects old or absent history',()=>{assert.ok(run(current,history.slice(1)).reject);assert.ok(run(current,history.map(r=>({...r,timestampUtc:new Date(Date.parse(r.timestampUtc)-60*86400000).toISOString()}))).reject);});
test('rejects malformed, future, stale or unaligned current timestamps',()=>{
 for(const timestampUtc of ['invalid','2026-10-26 12:00:00','2026-10-27T12:00:00Z','2026-10-25T12:00:00Z','2026-10-26T12:00:01Z'])assert.ok(run({...current,timestampUtc}).reject);
});
test('rejects negative/nonfinite values and invalid policy',()=>{
 for(const kwh of [-1,NaN,Infinity,2e8])assert.ok(run({...current,kwh}).reject);
 assert.ok(run(current,history,{...cfg,lambda:NaN}).reject || !('kwh' in run(current,history,{...cfg,lambda:NaN})));
 assert.ok(run(current,history,{...cfg,threshold:0}).reject);
});
test('blocks a statistical spike and a below-floor quantity',()=>{assert.ok(run({...current,kwh:9000}).reject);assert.ok(run({...current,kwh:999}).reject);});
test('evidence commits to the selected historical readings and policy',()=>{
 const a=run(),b=run(current,history.map((r,i)=>i===0?{...r,kwh:r.kwh+1}:r));assert.notEqual(a.evidence,b.evidence);
 const c=run(current,history,{...cfg,threshold:4});assert.notEqual(a.policy,c.policy);
});

test('fails closed on finite historical inputs whose moments overflow',()=>assert.ok(run(current,history.map(r=>({...r,kwh:1e308}))).reject));
