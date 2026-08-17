/**
 * End-to-end smoke test of the screening path against the mock meter endpoint.
 * This is NOT a CRE simulation: it exercises the fetch-and-screen logic outside
 * the runtime. Run `cre workflow simulate .` for the real thing.
 */
import { spawn } from "node:child_process";

const CFG = { threshold: 3.48, lambda: 0.5, windowDays: 30, minKwh: 1000 };
const PHYSICAL_MAX_KWH = 100_000_000;

function ewmaStats(xs, lambda) {
  const n = xs.length; let num = 0, den = 0;
  for (let i = 0; i < n; i++) { const w = lambda * Math.pow(1 - lambda, n - 1 - i); num += w * xs[i]; den += w; }
  const mu = num / den;
  const flat = xs.reduce((a, b) => a + b, 0) / n;
  const varr = xs.reduce((a, b) => a + (b - flat) ** 2, 0) / (n - 1);
  return { mu, sd: Math.sqrt(varr) };
}
function screen(current, history, cfg) {
  if (!current || typeof current.kwh !== "number") return { reject: "no current reading" };
  const x = current.kwh;
  if (!Number.isFinite(x) || x < 0) return { reject: "non-finite or negative reading" };
  if (x > PHYSICAL_MAX_KWH) return { reject: "exceeds physical bound" };
  const hour = new Date(current.timestampUtc).getUTCHours();
  const sameHour = history.filter(r => Number.isFinite(r.kwh) &&
      new Date(r.timestampUtc).getUTCHours() === hour).slice(-cfg.windowDays).map(r => r.kwh);
  if (sameHour.length < cfg.windowDays) return { reject: "insufficient history" };
  const { mu, sd } = ewmaStats(sameHour, cfg.lambda);
  if (Math.abs((x - mu) / Math.max(sd, 1)) > cfg.threshold) return { reject: "score above threshold" };
  if (x < cfg.minKwh) return { reject: "below 1 MWh issuance floor" };
  return { kwh: Math.floor(x) };
}

async function run(anomaly) {
  const args = ["mock-meter-api.js"]; if (anomaly) args.push("--anomaly");
  const srv = spawn("node", args, { cwd: import.meta.dirname, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 400));
  const out = [];
  try {
    for (const id of ["METER_GR_001", "METER_GR_002", "METER_GR_003"]) {
      const cur = await fetch(`http://localhost:3001/api/iot/meter/${id}`).then(r => r.json());
      const hist = await fetch(`http://localhost:3001/api/iot/meter/${id}/history?days=30`).then(r => r.json());
      out.push([id, screen(cur, hist, CFG)]);
    }
    // fail-closed: endpoint down
    const dead = screen(undefined, [], CFG);
    out.push(["ENDPOINT_DOWN", dead]);
  } finally { srv.kill(); }
  return out;
}

let pass = 0, total = 0;
function check(label, cond, detail) { total++; if (cond) pass++; console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); }

console.log("Normal operation:");
for (const [id, r] of await run(false)) {
  if (id === "ENDPOINT_DOWN") check("endpoint down -> fail-closed", r.reject === "no current reading", JSON.stringify(r));
  else check(`${id} admitted`, r.kwh > 0, JSON.stringify(r));
}
console.log("\nAnomaly injected on METER_GR_001 (4x):");
for (const [id, r] of await run(true)) {
  if (id === "METER_GR_001") check("anomalous meter rejected", r.reject === "score above threshold", JSON.stringify(r));
  else if (id === "ENDPOINT_DOWN") check("endpoint down -> fail-closed", r.reject === "no current reading", JSON.stringify(r));
  else check(`${id} still admitted`, r.kwh > 0, JSON.stringify(r));
}
console.log(`\n  ${pass}/${total} passing`);
process.exit(pass === total ? 0 : 1);
