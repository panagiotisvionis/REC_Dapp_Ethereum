// ─────────────────────────────────────────────────────────────────────────────
// Demo data — all data needed for DEMO_MODE (no backend, no blockchain)
// Mirrors the seed script output: 14 RECs, 5 Greek sites
// ─────────────────────────────────────────────────────────────────────────────

// Shared producer address for demo display
const DEMO_ADDR  = '0xF1B171D93978db10d562b470169663c2B0881c2e';
const DEMO_SHORT = '0xF1B1…81c2';

// ── REC metadata by tokenId ───────────────────────────────────────────────
export const DEMO_RECS = {
  '1':  { valid: true, remaining: '5000',  metadata: { source: 0, kwh: '15000', location: 'GR-AT', issuedAt: '1735689600', expiresAt: '1830384000', fullyRetired: false, dataHash: 'ipfs://QmKalamata1Jan2025SolarProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '2':  { valid: true, remaining: '6000',  metadata: { source: 0, kwh: '18000', location: 'GR-AT', issuedAt: '1738368000', expiresAt: '1833062400', fullyRetired: false, dataHash: 'oracle://METER_GR_001', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '3':  { valid: true, remaining: '9000',  metadata: { source: 0, kwh: '9000',  location: 'GR-AT', issuedAt: '1741046400', expiresAt: '1835740800', fullyRetired: false, dataHash: 'ipfs://QmKalamata3Mar2025SolarProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '4':  { valid: true, remaining: '14000', metadata: { source: 2, kwh: '22000', location: 'GR-EP', issuedAt: '1735689600', expiresAt: '1830384000', fullyRetired: false, dataHash: 'ipfs://QmEpirus1Jan2025HydroProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '5':  { valid: true, remaining: '4000',  metadata: { source: 2, kwh: '20000', location: 'GR-EP', issuedAt: '1738368000', expiresAt: '1833062400', fullyRetired: false, dataHash: 'oracle://METER_GR_003', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '6':  { valid: true, remaining: '28000', metadata: { source: 2, kwh: '28000', location: 'GR-EP', issuedAt: '1741046400', expiresAt: '1835740800', fullyRetired: false, dataHash: 'ipfs://QmEpirus3Apr2025HydroProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '7':  { valid: true, remaining: '20000', metadata: { source: 1, kwh: '35000', location: 'GR-MA', issuedAt: '1735689600', expiresAt: '1830384000', fullyRetired: false, dataHash: 'ipfs://QmMakedonia1Jan2025WindProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '8':  { valid: true, remaining: '5000',  metadata: { source: 1, kwh: '30000', location: 'GR-MA', issuedAt: '1738368000', expiresAt: '1833062400', fullyRetired: false, dataHash: 'oracle://METER_GR_002', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '9':  { valid: true, remaining: '20000', metadata: { source: 1, kwh: '40000', location: 'GR-MA', issuedAt: '1741046400', expiresAt: '1835740800', fullyRetired: false, dataHash: 'ipfs://QmMakedonia3Mar2025WindProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '10': { valid: true, remaining: '25000', metadata: { source: 1, kwh: '25000', location: 'GR-MA', issuedAt: '1743724800', expiresAt: '1838419200', fullyRetired: false, dataHash: 'oracle://METER_GR_002', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '11': { valid: true, remaining: '12000', metadata: { source: 0, kwh: '20000', location: 'GR-CR', issuedAt: '1738368000', expiresAt: '1833062400', fullyRetired: false, dataHash: 'oracle://METER_GR_004', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '12': { valid: true, remaining: '4000',  metadata: { source: 0, kwh: '14000', location: 'GR-CR', issuedAt: '1741046400', expiresAt: '1835740800', fullyRetired: false, dataHash: 'ipfs://QmCrete2Feb2025SolarProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '13': { valid: true, remaining: '24000', metadata: { source: 1, kwh: '42000', location: 'GR-AG', issuedAt: '1741046400', expiresAt: '1835740800', fullyRetired: false, dataHash: 'oracle://METER_GR_005', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
  '14': { valid: true, remaining: '12000', metadata: { source: 4, kwh: '12000', location: 'GR-AG', issuedAt: '1743724800', expiresAt: '1838419200', fullyRetired: false, dataHash: 'ipfs://QmAegean2Feb2025GeothermalProductionReport', issuer: DEMO_ADDR, producer: DEMO_ADDR } },
};

// ── Holdings (portfolio view) ─────────────────────────────────────────────
export const DEMO_HOLDINGS = Object.entries(DEMO_RECS).map(([tokenId, rec]) => {
  const retired  = tokenId === '1' ? '10000' : tokenId === '5' ? '16000' : tokenId === '8' ? '25000' : tokenId === '12' ? '10000' : '0';
  const balance  = String(Number(rec.metadata.kwh) - Number(retired) - (Number(rec.remaining) < Number(rec.metadata.kwh) - Number(retired) ? 0 : 0));
  return { tokenId, balance: rec.remaining, retired, valid: rec.valid, metadata: rec.metadata };
});

// ── Marketplace listings ──────────────────────────────────────────────────
// Matches the 6 listings created by the seed script
export const DEMO_LISTINGS = [
  { id: '0', tokenId: '2',  amount: '12000', pricePerKwh: '100000000000000',  active: true, seller: DEMO_SHORT, valid: true, metadata: DEMO_RECS['2'].metadata },
  { id: '1', tokenId: '4',  amount: '8000',  pricePerKwh: '120000000000000',  active: true, seller: DEMO_SHORT, valid: true, metadata: DEMO_RECS['4'].metadata },
  { id: '2', tokenId: '7',  amount: '15000', pricePerKwh: '80000000000000',   active: true, seller: DEMO_SHORT, valid: true, metadata: DEMO_RECS['7'].metadata },
  { id: '3', tokenId: '9',  amount: '20000', pricePerKwh: '70000000000000',   active: true, seller: DEMO_SHORT, valid: true, metadata: DEMO_RECS['9'].metadata },
  { id: '4', tokenId: '11', amount: '8000',  pricePerKwh: '110000000000000',  active: true, seller: DEMO_SHORT, valid: true, metadata: DEMO_RECS['11'].metadata },
  { id: '5', tokenId: '13', amount: '18000', pricePerKwh: '90000000000000',   active: true, seller: DEMO_SHORT, valid: true, metadata: DEMO_RECS['13'].metadata },
];

// ── Audit summary (5 meters) ──────────────────────────────────────────────
export const DEMO_AUDIT_SUMMARY = [
  { meterId: 'METER_GR_001', siteName: 'Kalamata Solar Farm',  source: 'Solar', region: 'GR-AT', healthScore: 80, opStatus: 'ok',      fraudStatus: 'suspicious', maintStatus: 'ok',      alerts: ['Fraud: suspicious'] },
  { meterId: 'METER_GR_002', siteName: 'Makedonia Wind Park',  source: 'Wind',  region: 'GR-MA', healthScore: 72, opStatus: 'warning',  fraudStatus: 'normal',     maintStatus: 'ok',      alerts: ['Operational: warning'] },
  { meterId: 'METER_GR_003', siteName: 'Epirus Hydro Station', source: 'Hydro', region: 'GR-EP', healthScore: 78, opStatus: 'ok',       fraudStatus: 'normal',     maintStatus: 'inspect', alerts: ['Maintenance: inspect'] },
  { meterId: 'METER_GR_004', siteName: 'Crete Solar Array',    source: 'Solar', region: 'GR-CR', healthScore: 85, opStatus: 'warning',  fraudStatus: 'normal',     maintStatus: 'ok',      alerts: ['Operational: warning'] },
  { meterId: 'METER_GR_005', siteName: 'Aegean Wind Cluster',  source: 'Wind',  region: 'GR-AG', healthScore: 91, opStatus: 'ok',       fraudStatus: 'normal',     maintStatus: 'ok',      alerts: [] },
];

// ── Audit detail per meter ────────────────────────────────────────────────
export const DEMO_AUDIT_DETAIL = {
  METER_GR_001: {
    meterId: 'METER_GR_001', siteName: 'Kalamata Solar Farm', source: 'Solar', region: 'GR-AT', healthScore: 80,
    operational: { status: 'ok', expected: 1840, actual: 1820, deviationPct: -1.1, possibleCauses: [], confidence: 94 },
    fraud: {
      status: 'suspicious', zScore: 2.8, historicalProbability: 0.51, spikePct: null,
      message: 'Reading z-score 2.8σ above historical average. Recommend manual verification before next issuance.',
    },
    maintenance: { status: 'ok', component: 'Solar inverter', expectedDegradationPct: 0.0027, observedDegradationPct: 0.0031, ratio: 1.1, recommendation: 'Performance nominal. Schedule annual inspection.', daysUntil: null },
  },
  METER_GR_002: {
    meterId: 'METER_GR_002', siteName: 'Makedonia Wind Park', source: 'Wind', region: 'GR-MA', healthScore: 72,
    operational: { status: 'warning', expected: 3200, actual: 2624, deviationPct: -18.0, possibleCauses: [
      { cause: 'Below-forecast wind speed', probability: 62 },
      { cause: 'Partial turbine downtime', probability: 28 },
      { cause: 'Sensor calibration drift',  probability: 10 },
    ], confidence: 77 },
    fraud: { status: 'normal', zScore: -1.4, historicalProbability: 16.0, message: 'Production within acceptable statistical range for current wind conditions.', spikePct: null },
    maintenance: { status: 'ok', component: 'Wind turbine gearbox', expectedDegradationPct: 0.0041, observedDegradationPct: 0.0048, ratio: 1.2, recommendation: 'Degradation within normal bounds. Continue monitoring.', daysUntil: null },
  },
  METER_GR_003: {
    meterId: 'METER_GR_003', siteName: 'Epirus Hydro Station', source: 'Hydro', region: 'GR-EP', healthScore: 78,
    operational: { status: 'ok', expected: 1650, actual: 1698, deviationPct: 2.9, possibleCauses: [], confidence: 96 },
    fraud: { status: 'normal', zScore: 0.3, historicalProbability: 76.2, message: 'All readings within expected range.', spikePct: null },
    maintenance: {
      status: 'inspect', component: 'Hydro turbine runner',
      expectedDegradationPct: 0.0018, observedDegradationPct: 0.0043, ratio: 2.4,
      recommendation: 'Degradation rate 2.4× normal. Inspect turbine runner and seals within 14 days.',
      daysUntil: 14,
    },
  },
  METER_GR_004: {
    meterId: 'METER_GR_004', siteName: 'Crete Solar Array', source: 'Solar', region: 'GR-CR', healthScore: 85,
    operational: { status: 'warning', expected: 1920, actual: 1574, deviationPct: -18.0, possibleCauses: [
      { cause: 'Panel soiling / dust accumulation', probability: 55 },
      { cause: 'Partial shading event',             probability: 30 },
      { cause: 'Inverter efficiency loss',           probability: 15 },
    ], confidence: 82 },
    fraud: { status: 'normal', zScore: -1.2, historicalProbability: 23.0, message: 'Production consistent with seasonal irradiance data.', spikePct: null },
    maintenance: { status: 'ok', component: 'Solar panel array', expectedDegradationPct: 0.0025, observedDegradationPct: 0.0028, ratio: 1.1, recommendation: 'Performance nominal. Consider panel cleaning.', daysUntil: null },
  },
  METER_GR_005: {
    meterId: 'METER_GR_005', siteName: 'Aegean Wind Cluster', source: 'Wind', region: 'GR-AG', healthScore: 91,
    operational: { status: 'ok', expected: 3400, actual: 3468, deviationPct: 2.0, possibleCauses: [], confidence: 97 },
    fraud: { status: 'normal', zScore: 0.2, historicalProbability: 84.2, message: 'All readings nominal.', spikePct: null },
    maintenance: { status: 'ok', component: 'Wind turbine gearbox', expectedDegradationPct: 0.0041, observedDegradationPct: 0.0039, ratio: 0.95, recommendation: 'Excellent performance. No action required.', daysUntil: null },
  },
};

// ── Portfolio charts ──────────────────────────────────────────────────────
export const DEMO_MONTHLY = [
  { month: 'Jan', production: 37000, retired: 10000, co2: 3.5  },
  { month: 'Feb', production: 52000, retired: 16000, co2: 5.6  },
  { month: 'Mar', production: 65000, retired: 25000, co2: 8.75 },
  { month: 'Apr', production: 71000, retired: 20000, co2: 7.0  },
  { month: 'May', production: 84000, retired: 30000, co2: 10.5 },
  { month: 'Jun', production: 94000, retired: 35000, co2: 12.3 },
];
