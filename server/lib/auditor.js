/**
 * RecChain — AI Energy Auditor
 *
 * Analysis engine for IoT meter data.
 * Three modules:
 *   1. Operational Insights   — expected vs actual production, deviation, causes
 *   2. Fraud Detection        — statistical anomaly scoring, spike detection
 *   3. Predictive Maintenance — degradation trend, component health
 */

const METERS = {
  'METER_GR_001': { name: 'Kalamata Solar Farm',    source: 'Solar',  region: 'GR-AT', peakKwh: 2000, noiseStd: 150, degradationRate: 0.0025 },
  'METER_GR_002': { name: 'Makedonia Wind Park',    source: 'Wind',   region: 'GR-MA', peakKwh: 3500, noiseStd: 400, degradationRate: 0.0010 },
  'METER_GR_003': { name: 'Epirus Hydro Station',   source: 'Hydro',  region: 'GR-EP', peakKwh: 1800, noiseStd: 100, degradationRate: 0.0005 },
  'METER_GR_004': { name: 'Crete Solar Array',      source: 'Solar',  region: 'GR-CR', peakKwh: 2200, noiseStd: 180, degradationRate: 0.0060 }, // degrading faster
  'METER_GR_005': { name: 'Aegean Wind Cluster',    source: 'Wind',   region: 'GR-AG', peakKwh: 4000, noiseStd: 500, degradationRate: 0.0015 },
};

// ── Simulation core ───────────────────────────────────────────────────────────

function seededRnd(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function productionCurve(source, hourUTC) {
  if (source === 'Solar') {
    if (hourUTC < 5 || hourUTC > 21) return 0;
    const h = (hourUTC - 13) / 5;
    return Math.exp(-0.5 * h * h);
  }
  // Wind + Hydro: fairly flat with slight variance
  return 0.7 + 0.3 * Math.sin(hourUTC / 3);
}

function simulateDay(meter, daySeed, dayOffset = 0) {
  const hourUTC = new Date().getUTCHours();
  const curve   = productionCurve(meter.source, hourUTC);
  const base    = meter.peakKwh * curve * (1 - meter.degradationRate * dayOffset);
  const noise   = (seededRnd(daySeed) - 0.5) * 2 * meter.noiseStd;
  return Math.max(0, base + noise);
}

function generateHistory(meter, todayIndex) {
  return Array.from({ length: 30 }, (_, i) => {
    const day     = todayIndex - (29 - i);
    const reading = simulateDay(meter, day * 7 + meter.name.charCodeAt(0), 29 - i);
    return reading;
  });
}

// ── Statistical helpers ───────────────────────────────────────────────────────

function stats(arr) {
  const n      = arr.length;
  const mean   = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std    = Math.sqrt(variance);
  const cv     = std / (mean || 1); // coefficient of variation
  return { mean, std, cv, n };
}

function zScore(value, mean, std) {
  return std > 0 ? (value - mean) / std : 0;
}

// P(X ≤ x) from standard normal (approximation)
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf  = 1 - 0.3989422803 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

// Probability of reading this extreme or more extreme (two-tailed)
function extremeProbability(z) {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

// Simple linear regression — returns slope (per day)
function linearSlope(arr) {
  const n    = arr.length;
  const sumX = n * (n - 1) / 2;
  const sumY = arr.reduce((a, b) => a + b, 0);
  const sumXY = arr.reduce((s, y, i) => s + i * y, 0);
  const sumX2 = arr.reduce((s, _, i) => s + i * i, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

// ── Possible causes ───────────────────────────────────────────────────────────

function possibleCauses(source, deviationPct) {
  const d = deviationPct;
  if (source === 'Solar') {
    if (d < -50) return [
      { cause: 'Inverter failure or critical degradation', probability: 50 },
      { cause: 'Physical damage to panel array',           probability: 30 },
      { cause: 'Meter malfunction',                        probability: 20 },
    ];
    if (d < -25) return [
      { cause: 'Inverter degradation',    probability: 40 },
      { cause: 'Heavy cloud cover',       probability: 35 },
      { cause: 'Panel soiling / shading', probability: 25 },
    ];
    if (d < -10) return [
      { cause: 'Cloud cover anomaly',     probability: 55 },
      { cause: 'Atmospheric haze',        probability: 30 },
      { cause: 'Panel soiling',           probability: 15 },
    ];
    if (d > 30) return [
      { cause: 'Meter calibration drift',  probability: 45 },
      { cause: 'Unusually clear skies',    probability: 40 },
      { cause: 'Reporting period overlap', probability: 15 },
    ];
  }
  if (source === 'Wind') {
    if (d < -35) return [
      { cause: 'Low wind speed conditions',       probability: 50 },
      { cause: 'Turbine mechanical issue',         probability: 30 },
      { cause: 'Curtailment (grid constraints)',   probability: 20 },
    ];
    if (d > 35) return [
      { cause: 'Higher than average wind speeds',  probability: 60 },
      { cause: 'Anemometer miscalibration',        probability: 25 },
      { cause: 'Reporting period overlap',         probability: 15 },
    ];
  }
  if (source === 'Hydro') {
    if (d < -20) return [
      { cause: 'Reduced water flow (drought)',     probability: 55 },
      { cause: 'Turbine maintenance scheduled',    probability: 30 },
      { cause: 'Penstock valve issue',             probability: 15 },
    ];
  }
  return [
    { cause: 'Normal operational variance',  probability: 75 },
    { cause: 'Measurement uncertainty (±5%)', probability: 25 },
  ];
}

// ── Maintenance analysis ──────────────────────────────────────────────────────

function maintenanceAnalysis(meter, history) {
  const slope       = linearSlope(history);
  const avgOutput   = history.reduce((a, b) => a + b, 0) / history.length;
  // Daily degradation as % of average output
  const observedPct = Math.abs(slope / (avgOutput || 1)) * 100;
  // Expected normal degradation per day (meter-specific)
  const expectedPct = meter.degradationRate * 100;

  const ratio = observedPct / (expectedPct || 0.001);

  let status, recommendation, daysUntil, component;

  // Component naming by source
  if (meter.source === 'Solar')      component = 'Panel Array / Inverter';
  else if (meter.source === 'Wind')  component = 'Rotor Blades / Gearbox';
  else                               component = 'Turbine / Penstock';

  if (ratio > 8) {
    status = 'urgent';
    recommendation = 'Immediate inspection required — critical degradation rate';
    daysUntil = 0;
  } else if (ratio > 4) {
    status = 'inspect';
    recommendation = 'Schedule inspection within 14 days';
    daysUntil = 14;
  } else if (ratio > 2) {
    status = 'monitor';
    recommendation = 'Monitor closely — degradation above expected';
    daysUntil = 30;
  } else {
    status = 'ok';
    recommendation = 'No action required';
    daysUntil = null;
  }

  return {
    component,
    expectedDegradationPct: parseFloat(expectedPct.toFixed(4)),
    observedDegradationPct: parseFloat(observedPct.toFixed(4)),
    ratio:                  parseFloat(ratio.toFixed(1)),
    status,
    recommendation,
    daysUntil,
  };
}

// ── Overall health score ──────────────────────────────────────────────────────

function healthScore(opStatus, fraudStatus, maintStatus) {
  let score = 100;
  if (opStatus === 'warning')  score -= 20;
  if (opStatus === 'critical') score -= 40;
  if (fraudStatus === 'suspicious') score -= 20;
  if (fraudStatus === 'flagged')    score -= 45;
  if (maintStatus === 'monitor')    score -= 10;
  if (maintStatus === 'inspect')    score -= 20;
  if (maintStatus === 'urgent')     score -= 35;
  return Math.max(0, score);
}

// ── Main audit function ───────────────────────────────────────────────────────

function auditMeter(meterId) {
  const meter = METERS[meterId];
  if (!meter) return null;

  const todayIndex = Math.floor(Date.now() / 86400000);
  const history    = generateHistory(meter, todayIndex);
  const { mean, std, cv } = stats(history);

  // Current reading
  const anomalyChance  = seededRnd(todayIndex * 100 + meterId.charCodeAt(8)) < 0.12;
  const currentRaw     = simulateDay(meter, todayIndex, 0);
  const current        = anomalyChance ? currentRaw * (3 + seededRnd(todayIndex) * 5) : currentRaw;

  const z              = zScore(current, mean, std);
  const exceedProb     = extremeProbability(z) * 100;

  // ── Operational ───────────────────────────────────────────────────────
  const expected       = mean;
  const deviationPct   = expected > 0 ? ((current - expected) / expected) * 100 : 0;
  const causes         = possibleCauses(meter.source, deviationPct);

  // Confidence based on data consistency
  const confidence     = cv < 0.2 ? 90 : cv < 0.4 ? 78 : cv < 0.6 ? 62 : 48;

  let opStatus = 'ok';
  if (Math.abs(deviationPct) > 40) opStatus = 'critical';
  else if (Math.abs(deviationPct) > 15) opStatus = 'warning';

  const operational = {
    expected:      Math.round(expected),
    actual:        Math.round(current),
    deviationPct:  parseFloat(deviationPct.toFixed(1)),
    status:        opStatus,
    possibleCauses: causes,
    confidence,
  };

  // ── Fraud detection ───────────────────────────────────────────────────
  let fraudStatus = 'normal';
  if (Math.abs(z) > 4)      fraudStatus = 'flagged';
  else if (Math.abs(z) > 2.5) fraudStatus = 'suspicious';

  const spikePct = current > mean * 2 ? parseFloat(((current / mean - 1) * 100).toFixed(0)) : null;

  const fraud = {
    zScore:                parseFloat(z.toFixed(2)),
    historicalProbability: parseFloat(exceedProb.toFixed(4)),
    status:                fraudStatus,
    spikePct,
    message: fraudStatus === 'flagged'
      ? `Reading ${spikePct ? `+${spikePct}%` : `${z.toFixed(1)}σ`} — highly anomalous (p < 0.01%)`
      : fraudStatus === 'suspicious'
        ? `Reading ${z.toFixed(1)}σ from historical mean — investigation recommended`
        : 'Reading within normal statistical range',
  };

  // ── Predictive maintenance ────────────────────────────────────────────
  const maintenance = maintenanceAnalysis(meter, history);

  // ── Overall ───────────────────────────────────────────────────────────
  const score = healthScore(opStatus, fraudStatus, maintenance.status);

  return {
    meterId,
    siteName:  meter.name,
    source:    meter.source,
    region:    meter.region,
    timestamp: Math.floor(Date.now() / 1000),
    healthScore: score,
    operational,
    fraud,
    maintenance,
  };
}

function auditAllMeters() {
  return Object.keys(METERS).map(id => auditMeter(id)).filter(Boolean);
}

module.exports = { auditMeter, auditAllMeters, METERS };
