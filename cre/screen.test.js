/* Logic test for the workflow screening rule, extracted verbatim from
   screening/main.ts. This exercises the decision rule and its fail-closed paths in
   plain Node; it is NOT a CRE simulation, which requires `cre workflow
   simulate` and CRE credentials. */
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
  if (!Number.isFinite(x) || x < 0) return { reject: "non-finite or negative" };
  if (x > PHYSICAL_MAX_KWH) return { reject: "exceeds physical bound" };
  const hour = new Date(current.timestampUtc).getUTCHours();
  const sameHour = history.filter(r => Number.isFinite(r.kwh) &&
      new Date(r.timestampUtc).getUTCHours() === hour).slice(-cfg.windowDays).map(r => r.kwh);
  if (sameHour.length < cfg.windowDays) return { reject: "insufficient history" };
  const { mu, sd } = ewmaStats(sameHour, cfg.lambda);
  const scale = Math.max(sd, 1);
  if (Math.abs((x - mu) / scale) > cfg.zThreshold) return { reject: "anomaly" };
  if (x < cfg.minKwh) return { reject: "below 1 MWh floor" };
  return { kwh: Math.floor(x) };
}

const cfg = { windowDays: 30, lambda: 0.6, zThreshold: 3.0, minKwh: 1000 };
const hist = [];
for (let d = 30; d >= 1; d--) hist.push({ timestampUtc: `2026-07-${String(d).padStart(2,'0')}T10:00:00Z`, kwh: 2000 + (d % 5) * 40 });
const at10 = k => ({ timestampUtc: "2026-08-01T10:00:00Z", kwh: k });

const cases = [
  ["normal reading admitted",            at10(2080),        r => r.kwh === 2080],
  ["gross spike rejected",               at10(9000),        r => r.reject === "anomaly"],
  ["zero reading rejected",              at10(0),           r => r.reject === "anomaly" || r.reject === "below 1 MWh floor"],
  ["negative rejected",                  at10(-5),          r => r.reject === "non-finite or negative"],
  ["physical bound rejected",            at10(2e8),         r => r.reject === "exceeds physical bound"],
  ["sub-floor rejected",                 at10(900),         r => r.reject !== undefined],
  ["missing reading rejected",           undefined,         r => r.reject === "no current reading"],
];
let pass = 0;
for (const [name, cur, ok] of cases) {
  const r = screen(cur, hist, cfg);
  const good = ok(r); pass += good ? 1 : 0;
  console.log(`  ${good ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(r)}`);
}
// fail-closed: short history must reject even for a perfectly normal value
const short = screen(at10(2080), hist.slice(0, 20), cfg);
const fc = short.reject === "insufficient history";
console.log(`  ${fc ? "PASS" : "FAIL"}  FAIL-CLOSED on short history -> ${JSON.stringify(short)}`);
pass += fc ? 1 : 0;
// fail-closed: history with no matching hour
const wrongHour = hist.map(h => ({ ...h, timestampUtc: h.timestampUtc.replace("T10", "T14") }));
const wh = screen(at10(2080), wrongHour, cfg);
const fc2 = wh.reject === "insufficient history";
console.log(`  ${fc2 ? "PASS" : "FAIL"}  FAIL-CLOSED on hour mismatch -> ${JSON.stringify(wh)}`);
pass += fc2 ? 1 : 0;
console.log(`\n  ${pass}/${cases.length + 2} passing`);
process.exit(pass === cases.length + 2 ? 0 : 1);
