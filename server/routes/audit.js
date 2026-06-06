const { Router }               = require('express');
const { auditMeter, auditAllMeters, METERS } = require('../lib/auditor');

const router = Router();

// GET /api/audit/meters — list auditable meters
router.get('/meters', (_req, res) => {
  res.json(Object.entries(METERS).map(([id, m]) => ({ id, name: m.name, source: m.source, region: m.region })));
});

// GET /api/audit/summary — all meters, lightweight overview
router.get('/summary', (_req, res) => {
  const reports = auditAllMeters();
  const summary = reports.map(r => ({
    meterId:     r.meterId,
    siteName:    r.siteName,
    source:      r.source,
    region:      r.region,
    healthScore: r.healthScore,
    opStatus:    r.operational.status,
    fraudStatus: r.fraud.status,
    maintStatus: r.maintenance.status,
    alerts:      [
      r.operational.status !== 'ok'  && `Operational: ${r.operational.status}`,
      r.fraud.status !== 'normal'    && `Fraud: ${r.fraud.status}`,
      r.maintenance.status !== 'ok'  && `Maintenance: ${r.maintenance.status}`,
    ].filter(Boolean),
  }));
  res.json(summary);
});

// GET /api/audit/meter/:meterId — full audit report
router.get('/meter/:meterId', (req, res) => {
  const report = auditMeter(req.params.meterId);
  if (!report) return res.status(404).json({ error: 'Unknown meter' });
  res.json(report);
});

module.exports = router;
