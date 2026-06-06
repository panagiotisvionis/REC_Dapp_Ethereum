const { Router } = require('express');

const router = Router();

// Simulated meter registry: meterId → config
const METERS = {
  'METER_GR_001': { source: 'Solar',  region: 'GR-AT', peakKwh: 2000, noiseStd: 150 },
  'METER_GR_002': { source: 'Wind',   region: 'GR-MA', peakKwh: 3500, noiseStd: 400 },
  'METER_GR_003': { source: 'Hydro',  region: 'GR-EP', peakKwh: 1800, noiseStd: 100 },
  'METER_GR_004': { source: 'Solar',  region: 'GR-CR', peakKwh: 2200, noiseStd: 180 },
  'METER_GR_005': { source: 'Wind',   region: 'GR-AG', peakKwh: 4000, noiseStd: 500 },
};

// Seed-based deterministic "random" so history is consistent
function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// Generate realistic production curve for a meter
// Solar follows a bell curve through the day; wind is more uniform
function simulateReading(meter, dateSeed) {
  const hourOfDay = new Date().getUTCHours();
  let curve = 1.0;

  if (meter.source === 'Solar') {
    // Bell curve peaking at 13:00 UTC
    const h = (hourOfDay - 13) / 5;
    curve = Math.exp(-0.5 * h * h);
    if (hourOfDay < 5 || hourOfDay > 21) curve = 0;
  }

  const base  = meter.peakKwh * curve;
  const noise = (seededRandom(dateSeed) - 0.5) * 2 * meter.noiseStd;
  return Math.max(0, base + noise);
}

// Generate 30-day history for statistical baseline
function generateHistory(meter, today) {
  const readings = [];
  for (let d = 1; d <= 30; d++) {
    readings.push(simulateReading(meter, today - d));
  }
  return readings;
}

// GET /api/iot/meters — list all available meters
router.get('/meters', (_req, res) => {
  const list = Object.entries(METERS).map(([id, m]) => ({ id, ...m }));
  res.json(list);
});

// GET /api/iot/meter/:meterId — get current reading + statistical baseline
router.get('/meter/:meterId', (req, res) => {
  const { meterId } = req.params;
  const meter = METERS[meterId];

  if (!meter) {
    return res.status(404).json({ valid: false, reason: `Unknown meter: ${meterId}` });
  }

  const today      = Math.floor(Date.now() / 86400000); // day index
  const history    = generateHistory(meter, today);
  const current    = simulateReading(meter, today);

  const sum     = history.reduce((a, b) => a + b, 0);
  const avg     = sum / history.length;
  const variance = history.reduce((a, b) => a + (b - avg) ** 2, 0) / history.length;
  const stdDev  = Math.sqrt(variance);

  const kwhProduced   = Math.round(current);
  const historicalAvg = Math.round(avg);
  const zScore        = stdDev > 0 ? Math.abs((kwhProduced - historicalAvg) / stdDev) : 0;

  // Inject a rare anomaly flag for demo purposes (5% chance)
  const anomalyInjected = seededRandom(today * 100 + meterId.charCodeAt(8)) < 0.05;

  res.json({
    meterId,
    source:         meter.source,
    region:         meter.region,
    kwhProduced:    anomalyInjected ? kwhProduced * 15 : kwhProduced,
    historicalAvg,
    stdDev:         Math.round(stdDev),
    zScore:         parseFloat(zScore.toFixed(2)),
    timestamp:      Math.floor(Date.now() / 1000),
    valid:          !anomalyInjected,
    reason:         anomalyInjected ? 'Statistical anomaly — z-score > 3 (automated rejection)' : null,
    anomalyInjected,
  });
});

// GET /api/iot/meter/:meterId/history — 30-day history for charts
router.get('/meter/:meterId/history', (req, res) => {
  const { meterId } = req.params;
  const meter = METERS[meterId];
  if (!meter) return res.status(404).json({ error: 'Unknown meter' });

  const today   = Math.floor(Date.now() / 86400000);
  const history = [];

  for (let d = 29; d >= 0; d--) {
    const date = new Date((today - d) * 86400000).toISOString().slice(0, 10);
    history.push({ date, kwh: Math.round(simulateReading(meter, today - d)) });
  }

  res.json({ meterId, source: meter.source, region: meter.region, history });
});

module.exports = router;
