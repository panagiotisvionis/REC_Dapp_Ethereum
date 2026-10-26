/**
 * Minimal IoT meter endpoint for `cre workflow simulate`.
 *
 * The workflow fetches a current reading and the raw trailing history; this
 * serves both from a deterministic generator so a simulation run is
 * reproducible. Deterministic output also matters for DON consensus: the
 * workflow aggregates node responses with identical-aggregation, so a randomised
 * endpoint would fail consensus rather than fail screening.
 *
 * Usage:  node cre/mock-meter-api.js            # serves on :3001
 *         node cre/mock-meter-api.js --anomaly  # injects a 6-sigma spike
 */
import { createServer } from "node:http";

const PORT = 3001;
const WINDOW = 30;
const ANOMALY = process.argv.includes("--anomaly");

const METERS = {
  METER_GR_001: { peak: 2000, noise: 150 },
  METER_GR_002: { peak: 3500, noise: 400 },
  METER_GR_003: { peak: 1800, noise: 100 },
};

// Deterministic PRNG so every simulation run sees the same series.
function rnd(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Half-sine daylight profile, peak at 10.5 UTC (solar noon for Greece).
function level(peak, hour) {
  if (hour < 4 || hour > 17) return 0;
  return peak * Math.sin((Math.PI * (hour - 4)) / (17 - 4));
}

function reading(meterId, daysAgo, hour) {
  const m = METERS[meterId];
  const seed = daysAgo * 37 + hour * 7 + meterId.charCodeAt(11);
  const kwh = Math.max(0, level(m.peak, hour) + (rnd(seed) - 0.5) * 2 * m.noise);
  const base = Math.floor(Date.now()/3600000)*3600000;
  const d = new Date(base-daysAgo*86400000);
  return { timestampUtc: d.toISOString(), kwh: Math.round(kwh * 1000) / 1000 };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const m = url.pathname.match(/^\/api\/iot\/meter\/([^/]+)(\/history)?$/);
  res.setHeader("content-type", "application/json");

  if (!m || !METERS[decodeURIComponent(m[1])]) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "unknown meter" }));
  }
  const meterId = decodeURIComponent(m[1]);
  const HOUR = 10;                          // near solar noon, non-trivial level

  if (m[2]) {                               // history
    const days = Number(url.searchParams.get("days") || WINDOW);
    const out = [];
    for (let d = days; d >= 1; d--) out.push(reading(meterId, d, HOUR));
    return res.end(JSON.stringify(out));
  }

  const cur = reading(meterId, 0, HOUR);     // current
  if (ANOMALY && meterId === "METER_GR_001") cur.kwh = Math.round(cur.kwh * 4);
  res.end(JSON.stringify(cur));
});

server.listen(PORT, () => {
  console.log(`mock meter API on http://localhost:${PORT}` +
              (ANOMALY ? "  [anomaly injected on METER_GR_001]" : ""));
});
