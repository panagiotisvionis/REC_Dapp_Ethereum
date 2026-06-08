import { useState, useEffect, useRef } from 'react';
import { ENERGY_SOURCES, SOURCE_ICONS, CO2_PER_MWH, DEMO_MODE } from '../lib/config';
import { fetchRec } from '../lib/api';

const KM_PER_TCO2    = 4000;
const TREES_PER_TCO2 = 48;

const DEMO_TOKEN_IDS = ['1', '2', '4', '5', '7', '8', '11', '13'];

// ── QR Code canvas renderer ────────────────────────────────────────────────
function QRCanvas({ url }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !url) return;
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(ref.current, url, {
        width: 140, margin: 1,
        color: { dark: '#111827', light: '#ffffff' },
      });
    }).catch(() => {});
  }, [url]);
  return <canvas ref={ref} className="passport-qr-canvas" />;
}

// ── Certificate Token Selector ─────────────────────────────────────────────
function TokenSelector({ tokens, selected, onSelect }) {
  return (
    <div className="passport-sidebar">
      <div className="sidebar-label">Certificates</div>
      {tokens.map(t => (
        <button
          key={t.tokenId}
          className={`token-btn ${selected === t.tokenId ? 'token-btn-active' : ''}`}
          onClick={() => onSelect(t.tokenId)}
        >
          <span className="token-btn-icon">
            {SOURCE_ICONS[ENERGY_SOURCES[t.metadata?.source] || 'Other'] || '⚡'}
          </span>
          <div className="token-btn-info">
            <span className="token-btn-id">Certificate #{t.tokenId}</span>
            <span className="token-btn-loc">{t.metadata?.location || '—'}</span>
          </div>
          <span className={`token-btn-badge ${t.valid !== false ? 'valid' : 'expired'}`}>
            {t.valid !== false ? '✓' : '✗'}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Main Certificate View ──────────────────────────────────────────────────
function CertificateView({ data, tokenId }) {
  const { valid, remaining, metadata } = data;
  const kwh    = Number(metadata.kwh);
  const mwh    = kwh / 1000;
  const source = ENERGY_SOURCES[metadata.source] || 'Other';
  const co2    = (mwh * CO2_PER_MWH).toFixed(2);
  const km     = Math.round(mwh * CO2_PER_MWH * KM_PER_TCO2).toLocaleString();
  const trees  = Math.round(mwh * CO2_PER_MWH * TREES_PER_TCO2);
  const isOracle = (metadata.dataHash || '').startsWith('oracle://');
  const verifyUrl = `${window.location.origin}/verify/${tokenId}`;

  const issuedAt  = new Date(Number(metadata.issuedAt)  * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const expiresAt = new Date(Number(metadata.expiresAt) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const shortAddr = addr => addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : '—';

  return (
    <div className="passport-main">

      {/* ── Certificate card ──────────────────────────────────────────── */}
      <div className={`passport-card ${valid ? 'passport-card-valid' : 'passport-card-expired'}`}>

        {/* Header */}
        <div className="pc-header">
          <div className="pc-header-left">
            <div className="pc-status-dot" style={{ background: valid ? '#22c55e' : '#ef4444' }} />
            <div>
              <div className="pc-title">Renewable Energy Certificate</div>
              <div className="pc-sub">Issued by RecChain · On-Chain Verified</div>
            </div>
          </div>
          <div className="pc-header-right">
            <span className="pc-token-id">#{tokenId}</span>
            <span className={`pc-status-badge ${valid ? 'valid' : 'expired'}`}>
              {valid ? 'Valid' : metadata.fullyRetired ? 'Retired' : 'Expired'}
            </span>
          </div>
        </div>

        {/* Body — certificate detail + QR */}
        <div className="pc-body">
          <div className="pc-body-left">

            {/* Source hero */}
            <div className="pc-source-hero">
              <span className="pc-source-icon">{SOURCE_ICONS[source] || '⚡'}</span>
              <div>
                <div className="pc-source-name">{source} Energy</div>
                <div className="pc-location">📍 {metadata.location}</div>
              </div>
            </div>

            {/* Main number */}
            <div className="pc-kwh-display">
              <span className="pc-kwh-value">{kwh.toLocaleString()}</span>
              <span className="pc-kwh-unit">kWh</span>
            </div>
            <div className="pc-mwh">{mwh.toFixed(1)} MWh produced &amp; verified</div>

            {/* Metadata rows */}
            <div className="pc-meta-grid">
              <div className="pc-meta-row"><span>Issued</span><strong>{issuedAt}</strong></div>
              <div className="pc-meta-row"><span>Valid Until</span><strong>{expiresAt}</strong></div>
              <div className="pc-meta-row">
                <span>Verification</span>
                <strong className={isOracle ? 'oracle-text' : ''}>
                  {isOracle ? '🔗 Chainlink Oracle' : '✓ Manual Issuance'}
                </strong>
              </div>
              <div className="pc-meta-row"><span>Remaining</span><strong>{Number(remaining).toLocaleString()} kWh</strong></div>
            </div>
          </div>

          {/* QR Code */}
          <div className="pc-qr-block">
            <div className="pc-qr-label">Verify on-chain</div>
            <QRCanvas url={verifyUrl} />
            <div className="pc-qr-url">{verifyUrl.replace('http://', '')}</div>
          </div>
        </div>

        {/* Impact section */}
        <div className="pc-impact-section">
          <div className="pc-impact-title">Environmental Impact</div>
          <div className="pc-impact-grid">
            <div className="pc-impact-card pc-impact-green">
              <div className="pc-impact-val">~{co2}</div>
              <div className="pc-impact-lbl">tCO₂ Avoided</div>
            </div>
            <div className="pc-impact-card">
              <div className="pc-impact-val">~{km}</div>
              <div className="pc-impact-lbl">km by car avoided</div>
            </div>
            <div className="pc-impact-card">
              <div className="pc-impact-val">~{trees}</div>
              <div className="pc-impact-lbl">Trees equivalent (1 yr)</div>
            </div>
          </div>
        </div>

        {/* Blockchain proof */}
        <div className="pc-proof">
          <div className="pc-proof-title">🔗 Blockchain Proof</div>
          <div className="pc-proof-grid">
            <div className="pc-proof-row"><span>Producer</span><code>{shortAddr(metadata.producer)}</code></div>
            <div className="pc-proof-row"><span>Issuer</span><code>{isOracle ? 'RecChain Oracle' : shortAddr(metadata.issuer)}</code></div>
            <div className="pc-proof-row"><span>Token Standard</span><code>ERC-1155</code></div>
            <div className="pc-proof-row"><span>Data Hash</span><code className="hash-truncate">{metadata.dataHash || '—'}</code></div>
          </div>
        </div>

        {/* Footer */}
        <div className="pc-footer">
          <span className="pc-footer-brand">RecChain</span>
          <span className="pc-footer-dot">·</span>
          <span>Energy ESG Intelligence Platform</span>
          <span className="pc-footer-dot">·</span>
          <span>Powered by Ethereum &amp; Chainlink</span>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="passport-actions">
        {DEMO_MODE ? (
          <span className="btn btn-primary" style={{ opacity: 0.45, cursor: 'default' }} title="PDF export available in full version">
            ↓ Download PDF Passport
          </span>
        ) : (
          <a href={`/api/recs/${tokenId}/passport?download=1`} className="btn btn-primary">
            ↓ Download PDF Passport
          </a>
        )}
        {!DEMO_MODE && (
          <a href={`/api/recs/${tokenId}/passport`} target="_blank" rel="noreferrer" className="btn btn-secondary">
            View PDF
          </a>
        )}
        <a href={`/verify/${tokenId}`} className="btn btn-outline" target="_blank" rel="noreferrer">
          Public Verify Page
        </a>
      </div>

      {/* ── Embed ─────────────────────────────────────────────────────── */}
      <div className="passport-embed-section">
        <div className="embed-title">Embed on your website</div>
        <p className="embed-desc">Show verified renewable energy usage on corporate websites and ESG reports.</p>
        <iframe
          src={`/embed/${tokenId}`}
          width="380" height="200" frameBorder="0"
          style={{ borderRadius: 10, border: '1px solid var(--gray-200)' }}
          title="REC Badge"
        />
      </div>

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function PassportPage() {
  const [tokenList, setTokenList] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [certData,  setCertData]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  // Load token list
  useEffect(() => {
    Promise.all(
      DEMO_TOKEN_IDS.map(id =>
        fetchRec(id)
          .then(d => ({ tokenId: id, ...d }))
          .catch(() => null)
      )
    ).then(results => {
      const valid = results.filter(Boolean);
      setTokenList(valid);
      if (valid.length > 0) setSelected(valid[0].tokenId);
    });
  }, []);

  // Load selected cert
  useEffect(() => {
    if (!selected) return;
    const cached = tokenList.find(t => t.tokenId === selected);
    if (cached) { setCertData(cached); return; }
    setLoading(true);
    setError(null);
    fetchRec(selected)
      .then(d => setCertData({ tokenId: selected, ...d }))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected, tokenList]);

  return (
    <div className="page passport-page">
      <div className="page-header">
        <h1>Carbon Passport</h1>
        <p className="page-subtitle">
          Verifiable renewable energy certificates with blockchain proof and downloadable ESG documentation.
        </p>
      </div>

      <div className="passport-layout">
        <TokenSelector
          tokens={tokenList}
          selected={selected}
          onSelect={setSelected}
        />

        <div className="passport-content">
          {loading && (
            <div className="passport-skeleton">
              <div className="skeleton skeleton-header" />
              <div className="skeleton skeleton-body" />
              <div className="skeleton skeleton-body short" />
            </div>
          )}
          {error && <div className="passport-error">⚠ {error}</div>}
          {!loading && !error && certData && (
            <CertificateView data={certData} tokenId={selected} />
          )}
          {!loading && !error && !certData && tokenList.length === 0 && (
            <div className="empty-state">No certificates found. Seed demo data first.</div>
          )}
        </div>
      </div>
    </div>
  );
}
