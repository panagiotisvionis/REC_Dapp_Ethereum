/**
 * End-to-end smoke test of the screening path against the mock meter endpoint.
 * This is NOT a CRE simulation: it exercises the fetch-and-screen logic outside
 * the runtime. Run `cre workflow simulate .` for the real thing.
 */
import { spawn } from "node:child_process";

const CFG = { threshold: 3.48, lambda: 0.5, windowDays: 30, minKwh: 1000, maxReadingAgeSeconds:7200, maxHistoryAgeDays:45,maxKwh:20000 };
import { screen } from "./screening/rule.ts";
async function run(anomaly) {
  const args = ["mock-meter-api.js"]; if (anomaly) args.push("--anomaly");
  const srv = spawn("node", args, { cwd: import.meta.dirname, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 400));
  const out = [];
  try {
    for (const id of ["METER_GR_001", "METER_GR_002", "METER_GR_003"]) {
      const cur = await fetch(`http://localhost:3001/api/iot/meter/${id}`).then(r => r.json());
      const hist = await fetch(`http://localhost:3001/api/iot/meter/${id}/history?days=30`).then(r => r.json());
      out.push([id, screen(cur, hist, CFG, Date.now())]);
    }
    // fail-closed: endpoint down
    const dead = screen(undefined, [], CFG, Date.now());
    out.push(["ENDPOINT_DOWN", dead]);
  } finally { srv.kill(); }
  return out;
}

let pass = 0, total = 0;
function check(label, cond, detail) { total++; if (cond) pass++; console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); }

console.log("Normal operation:");
for (const [id, r] of await run(false)) {
  if (id === "ENDPOINT_DOWN") check("endpoint down -> fail-closed", r.reject === "invalid reading", JSON.stringify(r));
  else check(`${id} admitted`, r.kwh > 0, JSON.stringify(r));
}
console.log("\nAnomaly injected on METER_GR_001 (4x):");
for (const [id, r] of await run(true)) {
  if (id === "METER_GR_001") check("anomalous meter rejected", r.reject === "score above threshold", JSON.stringify(r));
  else if (id === "ENDPOINT_DOWN") check("endpoint down -> fail-closed", r.reject === "invalid reading", JSON.stringify(r));
  else check(`${id} still admitted`, r.kwh > 0, JSON.stringify(r));
}
console.log(`\n  ${pass}/${total} passing`);
process.exit(pass === total ? 0 : 1);
