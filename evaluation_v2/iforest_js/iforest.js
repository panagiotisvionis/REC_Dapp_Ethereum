/**
 * Isolation Forest — dependency-free implementation.
 *
 * Written to settle an empirical question the manuscript previously answered by
 * assertion: whether an isolation forest can execute inside the CRE workflow
 * environment (TypeScript compiled to WASM), or whether it is excluded and the
 * issuance path is therefore restricted to closed-form statistics.
 *
 * The earlier argument rested on the 239 ms/decision of the scikit-learn
 * implementation. That reasoning was weak: CRE permits workflow executions far
 * longer than that. The substantive question is whether the method can be
 * expressed without a numerical stack, which is what this file tests.
 */

'use strict';

function harmonic(n) {
  return n <= 1 ? 0 : Math.log(n - 1) + 0.5772156649 + 0.5 / (n - 1);
}
function cFactor(n) {
  return n <= 1 ? 1 : 2 * harmonic(n) - (2 * (n - 1)) / n;
}

// Deterministic PRNG: workflow execution must be reproducible across DON nodes.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTree(rows, dims, depth, limit, rnd) {
  if (depth >= limit || rows.length <= 1) {
    return { leaf: true, size: rows.length };
  }
  const d = Math.floor(rnd() * dims);
  let lo = Infinity, hi = -Infinity;
  for (const r of rows) { if (r[d] < lo) lo = r[d]; if (r[d] > hi) hi = r[d]; }
  if (lo === hi) return { leaf: true, size: rows.length };

  const split = lo + rnd() * (hi - lo);
  const left = [], right = [];
  for (const r of rows) (r[d] < split ? left : right).push(r);
  return {
    leaf: false, d, split,
    l: buildTree(left, dims, depth + 1, limit, rnd),
    r: buildTree(right, dims, depth + 1, limit, rnd),
  };
}

function pathLength(node, row, depth) {
  if (node.leaf) return depth + cFactor(node.size);
  return pathLength(row[node.d] < node.split ? node.l : node.r, row, depth + 1);
}

/**
 * Fit a forest on `rows` and return the anomaly score of `query`.
 * Score in (0,1); higher is more anomalous, as in Liu et al.
 */
function isolationScore(rows, query, nTrees, seed) {
  const n = rows.length;
  const dims = rows[0].length;
  const limit = Math.ceil(Math.log2(Math.max(n, 2)));
  const rnd = mulberry32(seed);
  let total = 0;
  for (let t = 0; t < nTrees; t++) {
    total += pathLength(buildTree(rows, dims, 0, limit, rnd), query, 0);
  }
  return Math.pow(2, -(total / nTrees) / cFactor(n));
}

module.exports = { isolationScore };
