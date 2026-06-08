import { useState, useEffect, useCallback } from 'react';
import { SOURCE_ICONS } from '../lib/config';
import { fetchAuditSummary, fetchAuditDetail } from '../lib/api';

// ── Sub-components ────────────────────────────────────────────────────────

function HealthGauge({ score }) {
  const color = score >= 80 ? 'var(--green-500)' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Warning' : 'Critical';
  const r = 28, cx = 36, cy = 36;
  const circ = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  return (
    <div className="gauge-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--gray-100)" strokeWidth="7" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{score}</text>
      </svg>
      <span className="gauge-label" style={{ color }}>{label}</span>
    </div>
  );
}

function StatusChip({ status }) {
  const cfg = {
    ok:          { bg: 'var(--green-100)',  color: 'var(--green-700)', label: 'Normal'      },
    warning:     { bg: '#fef3c7',           color: '#92400e',          label: 'Warning'     },
    critical:    { bg: '#fee2e2',           color: '#991b1b',          label: 'Critical'    },
    normal:      { bg: 'var(--green-100)',  color: 'var(--green-700)', label: 'Normal'      },
    suspicious:  { bg: '#fef3c7',           color: '#92400e',          label: 'Suspicious'  },
    flagged:     { bg: '#fee2e2',           color: '#991b1b',          label: 'Flagged'     },
    monitor:     { bg: '#eff6ff',           color: '#1d4ed8',          label: 'Monitor'     },
    inspect:     { bg: '#fef3c7',           color: '#92400e',          label: 'Inspect'     },
    urgent:      { bg: '#fee2e2',           color: '#991b1b',          label: 'Urgent'      },
  };
  const c = cfg[status] || cfg.ok;
  return <span className="status-chip-ai" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
}

function DeviationBar({ pct }) {
  const abs   = Math.min(Math.abs(pct || 0), 100);
  const color = abs > 40 ? '#ef4444' : abs > 15 ? '#f59e0b' : 'var(--green-500)';
  const isNeg = pct < 0;
  return (
    <div className="dev-bar-wrap">
      <div className="dev-bar-track">
        <div className="dev-bar-center" />
        <div className={`dev-bar-fill ${isNeg ? 'dev-left' : 'dev-right'}`}
          style={{ width: `${abs / 2}%`, background: color }} />
      </div>
      <span className="dev-bar-label" style={{ color }}>{pct > 0 ? '+' : ''}{(pct||0).toFixed(1)}%</span>
    </div>
  );
}

function ConfidenceMeter({ value }) {
  const color = value >= 80 ? 'var(--green-500)' : value >= 65 ? '#f59e0b' : '#9ca3af';
  return (
    <div className="conf-meter">
      <div className="conf-track">
        <div className="conf-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="conf-label" style={{ color }}>{value}% confidence</span>
    </div>
  );
}

// ── Fleet risk score ──────────────────────────────────────────────────────
function RiskScore({ reports }) {
  const avg = reports.length
    ? Math.round(reports.reduce((s, r) => s + r.healthScore, 0) / reports.length)
    : 0;
  const flags = reports.filter(r =>
    r.opStatus === 'critical' || r.fraudStatus === 'flagged' || r.maintStatus === 'urgent'
  ).length;
  const warnings = reports.filter(r =>
    r.opStatus === 'warning' || r.fraudStatus === 'suspicious' || r.maintStatus === 'inspect'
  ).length;

  let risk, riskColor, riskBg;
  if (flags > 0)        { risk = 'High';   riskColor = '#991b1b'; riskBg = '#fee2e2'; }
  else if (warnings > 1){ risk = 'Medium'; riskColor = '#92400e'; riskBg = '#fef3c7'; }
  else                  { risk = 'Low';    riskColor = '#166534'; riskBg = '#dcfce7'; }

  return (
    <div className="risk-banner">
      <div className="risk-left">
        <div className="risk-label">Overall Risk Score</div>
        <div className="risk-score" style={{ color: riskColor, background: riskBg }}>
          {risk} Risk
        </div>
      </div>
      <div className="risk-stats">
        <div className="risk-stat"><span className="risk-stat-val risk-ok">{reports.length - flags - warnings}</span><span className="risk-stat-lbl">Healthy</span></div>
        <div className="risk-stat"><span className="risk-stat-val risk-warn">{warnings}</span><span className="risk-stat-lbl">Warnings</span></div>
        <div className="risk-stat"><span className="risk-stat-val risk-crit">{flags}</span><span className="risk-stat-lbl">Critical</span></div>
        <div className="risk-stat"><span className="risk-stat-val">{avg}</span><span className="risk-stat-lbl">Fleet Score</span></div>
      </div>
    </div>
  );
}

// ── AI Recommendations ────────────────────────────────────────────────────
function buildRecommendations(reports) {
  const recs = [];
  for (const r of reports) {
    if (r.fraudStatus === 'flagged')     recs.push({ level: 'critical', icon: '🚨', text: `Investigate ${r.siteName} — reading flagged as anomalous.` });
    if (r.fraudStatus === 'suspicious')  recs.push({ level: 'warning',  icon: '⚠️',  text: `Review data for ${r.siteName} — z-score above normal threshold.` });
    if (r.maintStatus === 'urgent')      recs.push({ level: 'critical', icon: '🔧', text: `Urgent maintenance required at ${r.siteName}.` });
    if (r.maintStatus === 'inspect')     recs.push({ level: 'warning',  icon: '🔧', text: `Inspect equipment at ${r.siteName} within 14 days.` });
    if (r.opStatus    === 'critical')    recs.push({ level: 'critical', icon: '📉', text: `${r.siteName}: production critically below forecast.` });
    if (r.opStatus    === 'warning')     recs.push({ level: 'warning',  icon: '📉', text: `${r.siteName}: production 18% below expected for current conditions.` });
  }
  if (recs.length === 0) recs.push({ level: 'ok', icon: '✅', text: 'All sites performing within normal parameters. No action required.' });
  return recs;
}

function AIRecommendations({ reports }) {
  const recs = buildRecommendations(reports);
  const colors = {
    critical: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
    warning:  { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
    ok:       { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
  };
  return (
    <div className="ai-recs">
      <div className="ai-recs-title">🤖 AI Recommendations</div>
      <div className="ai-recs-list">
        {recs.map((r, i) => {
          const c = colors[r.level];
          return (
            <div key={i} className="ai-rec-item"
              style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }}>
              <span className="ai-rec-icon">{r.icon}</span>
              <span className="ai-rec-text" style={{ color: c.text }}>{r.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Site ranking ──────────────────────────────────────────────────────────
function SiteRanking({ reports }) {
  const sorted = [...reports].sort((a, b) => b.healthScore - a.healthScore);
  const best  = sorted.slice(0, 2);
  const worst = sorted.slice(-2).reverse();
  return (
    <div className="site-ranking">
      <div className="ranking-col">
        <div className="ranking-title ranking-best">🏆 Best Performing</div>
        {best.map((r, i) => (
          <div key={r.meterId} className="ranking-row">
            <span className="ranking-pos">#{i + 1}</span>
            <span className="ranking-name">{r.siteName}</span>
            <span className="ranking-score" style={{ color: 'var(--green-600)' }}>{r.healthScore}</span>
          </div>
        ))}
      </div>
      <div className="ranking-col">
        <div className="ranking-title ranking-worst">⚠ Needs Attention</div>
        {worst.map((r, i) => (
          <div key={r.meterId} className="ranking-row">
            <span className="ranking-pos">#{reports.length - i}</span>
            <span className="ranking-name">{r.siteName}</span>
            <span className="ranking-score" style={{ color: r.healthScore < 70 ? '#ef4444' : '#f59e0b' }}>{r.healthScore}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Audit panels ──────────────────────────────────────────────────────────
function OperationalPanel({ data }) {
  return (
    <div className="audit-panel">
      <div className="audit-panel-header">
        <span className="panel-icon">📊</span>
        <span className="panel-title">Operational Insights</span>
        <StatusChip status={data.status} />
      </div>
      <div className="op-grid">
        <div className="op-stat"><span className="op-stat-label">Expected</span><span className="op-stat-value">{data.expected.toLocaleString()} kWh</span></div>
        <div className="op-stat"><span className="op-stat-label">Actual</span>
          <span className="op-stat-value" style={{ color: data.status !== 'ok' ? '#ef4444' : 'inherit' }}>
            {data.actual.toLocaleString()} kWh
          </span>
        </div>
        <div className="op-stat op-deviation"><span className="op-stat-label">Deviation</span><DeviationBar pct={data.deviationPct} /></div>
      </div>
      {data.possibleCauses?.length > 0 && data.status !== 'ok' && (
        <div className="causes-section">
          <span className="causes-title">Possible Causes</span>
          {data.possibleCauses.map((c, i) => (
            <div key={i} className="cause-row">
              <span className="cause-name">• {c.cause}</span>
              <div className="cause-bar-wrap">
                <div className="cause-bar" style={{ width: `${c.probability}%` }} />
                <span className="cause-pct">{c.probability}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfidenceMeter value={data.confidence} />
    </div>
  );
}

function FraudPanel({ data }) {
  return (
    <div className="audit-panel">
      <div className="audit-panel-header">
        <span className="panel-icon">🔍</span>
        <span className="panel-title">Fraud Detection</span>
        <StatusChip status={data.status} />
      </div>
      <div className="op-grid">
        <div className="op-stat"><span className="op-stat-label">Z-Score</span>
          <span className="op-stat-value" style={{ color: Math.abs(data.zScore) > 2.5 ? '#ef4444' : 'inherit' }}>
            {data.zScore > 0 ? '+' : ''}{data.zScore}σ
          </span>
        </div>
        <div className="op-stat"><span className="op-stat-label">Historical Probability</span>
          <span className="op-stat-value" style={{ color: data.historicalProbability < 1 ? '#ef4444' : 'inherit' }}>
            {data.historicalProbability.toFixed(4)}%
          </span>
        </div>
        {data.spikePct && (
          <div className="op-stat"><span className="op-stat-label">Reading Spike</span>
            <span className="op-stat-value fraud-spike">+{data.spikePct}%</span>
          </div>
        )}
      </div>
      <div className={`fraud-message fraud-${data.status}`}>
        {data.status === 'flagged' && '⚠️ '}
        {data.status === 'suspicious' && '⚠ '}
        {data.status === 'normal' && '✓ '}
        {data.message}
      </div>
    </div>
  );
}

function MaintenancePanel({ data }) {
  return (
    <div className="audit-panel">
      <div className="audit-panel-header">
        <span className="panel-icon">🔧</span>
        <span className="panel-title">Predictive Maintenance</span>
        <StatusChip status={data.status} />
      </div>
      <div className="op-grid">
        <div className="op-stat"><span className="op-stat-label">Component</span><span className="op-stat-value" style={{ fontSize: '.85rem' }}>{data.component}</span></div>
        <div className="op-stat"><span className="op-stat-label">Expected Degradation</span><span className="op-stat-value">{data.expectedDegradationPct.toFixed(4)}% / day</span></div>
        <div className="op-stat"><span className="op-stat-label">Observed Degradation</span>
          <span className="op-stat-value" style={{ color: data.ratio > 2 ? '#f59e0b' : 'inherit' }}>
            {data.observedDegradationPct.toFixed(4)}% / day
          </span>
        </div>
        <div className="op-stat"><span className="op-stat-label">vs Expected</span>
          <span className="op-stat-value" style={{ color: data.ratio > 2 ? '#ef4444' : 'var(--green-600)' }}>
            {data.ratio}× normal
          </span>
        </div>
      </div>
      <div className={`maint-recommendation maint-${data.status}`}>
        {data.status === 'urgent'  && '🚨 '}
        {data.status === 'inspect' && '⚠️ '}
        {data.status === 'monitor' && '👁 '}
        {data.status === 'ok'      && '✓ '}
        {data.recommendation}
        {data.daysUntil !== null && ` (within ${data.daysUntil} days)`}
      </div>
    </div>
  );
}

// ── Site card ─────────────────────────────────────────────────────────────
function SiteCard({ report, onSelect, active }) {
  const opStatus    = report.opStatus    ?? report.operational?.status    ?? 'ok';
  const fraudStatus = report.fraudStatus ?? report.fraud?.status          ?? 'normal';
  const maintStatus = report.maintStatus ?? report.maintenance?.status    ?? 'ok';
  const deviationPct = report.operational?.deviationPct ?? null;

  return (
    <div className={`site-card ${active ? 'site-card-active' : ''}`}
      onClick={() => onSelect(report.meterId)}>
      <div className="site-card-top">
        <div className="site-card-info">
          <span className="site-icon">{SOURCE_ICONS[report.source] || '⚡'}</span>
          <div>
            <div className="site-name">{report.siteName}</div>
            <div className="site-region">{report.region}</div>
          </div>
        </div>
        <HealthGauge score={report.healthScore} />
      </div>
      <div className="site-chips">
        <StatusChip status={opStatus} />
        <StatusChip status={fraudStatus} />
        <StatusChip status={maintStatus} />
      </div>
      {opStatus !== 'ok' && deviationPct !== null && (
        <div className="site-alert">{deviationPct > 0 ? '+' : ''}{deviationPct.toFixed(1)}% vs expected</div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function AIAuditor() {
  const [reports,    setReports]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [detailLoad, setDetailLoad] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditSummary();
      setReports(data);
      if (data.length > 0 && !selected) setSelected(data[0].meterId);
    } finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (meterId) => {
    setDetailLoad(true);
    try {
      const data = await fetchAuditDetail(meterId);
      setDetail(data);
    } finally { setDetailLoad(false); }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>AI Energy Auditor</h1>
          <p className="page-subtitle">Real-time operational intelligence for your renewable energy assets.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleExportPDF}>
          ↓ Export PDF
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Loading audit data…</div>
      ) : (
        <>
          {/* Risk + Recommendations */}
          <RiskScore reports={reports} />
          <AIRecommendations reports={reports} />
          <SiteRanking reports={reports} />

          <div className="auditor-layout">
            {/* Site list */}
            <div className="site-list">
              {reports.map(r => (
                <SiteCard key={r.meterId} report={r}
                  active={selected === r.meterId}
                  onSelect={setSelected} />
              ))}
            </div>

            {/* Detail panel */}
            <div className="detail-panel">
              {detailLoad && <div className="empty-state">Analysing…</div>}
              {!detailLoad && detail && (
                <>
                  <div className="detail-header">
                    <div>
                      <h2 className="detail-title">
                        {SOURCE_ICONS[detail.source] || '⚡'} {detail.siteName}
                      </h2>
                      <span className="detail-region">{detail.region} · {detail.source}</span>
                    </div>
                    <div className="detail-header-actions">
                      <HealthGauge score={detail.healthScore} />
                      <button className="btn btn-outline btn-sm" onClick={() => loadDetail(selected)}>
                        ↻ Refresh
                      </button>
                    </div>
                  </div>
                  <OperationalPanel  data={detail.operational}  />
                  <FraudPanel        data={detail.fraud}        />
                  <MaintenancePanel  data={detail.maintenance}  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
