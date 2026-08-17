const { isolationScore } = require('./iforest');
const fs = require('fs');

// Representative window: 30 same-hour readings plus the reading under test.
function makeWindow(rnd) {
  const w = [];
  for (let i = 0; i < 30; i++) w.push([2000 + (rnd() - 0.5) * 300]);
  return w;
}
let s = 12345;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

const REPS = 2000, TREES = 100;
const w = makeWindow(rnd), q = [2600];
// warm-up
for (let i = 0; i < 200; i++) isolationScore(w, q, TREES, 42);
const t0 = process.hrtime.bigint();
for (let i = 0; i < REPS; i++) isolationScore(w, q, TREES, 42);
const t1 = process.hrtime.bigint();
const us = Number(t1 - t0) / 1000 / REPS;

const src = fs.readFileSync('./iforest.js', 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
                .replace(/\n\s*\n/g, '\n').trim();
console.log('Isolation Forest, dependency-free JavaScript');
console.log('  trees per decision      :', TREES);
console.log('  source (comments stripped):', Buffer.byteLength(code), 'B');
console.log('  dependencies            : none');
console.log('  us/decision             :', us.toFixed(1));
console.log('  score(normal=2000)      :', isolationScore(w, [2000], TREES, 42).toFixed(4));
console.log('  score(query=2600)       :', isolationScore(w, q, TREES, 42).toFixed(4));
console.log('  score(extreme=5000)     :', isolationScore(w, [5000], TREES, 42).toFixed(4));
