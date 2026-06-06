import { useState, useEffect } from 'react';
import { useParams, Link }     from 'react-router-dom';
import { ENERGY_SOURCES, SOURCE_ICONS, CO2_PER_MWH } from '../lib/config';

const KM_PER_TCO2    = 4000;
const TREES_PER_TCO2 = 48;

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button className="copy-btn" onClick={copy}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export default function VerifyPage() {
  const { tokenId }            = useParams();
  const [data,    setData]     = useState(null);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState(null);

  useEffect(() => {
    fetch(`/api/recs/${tokenId}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tokenId]);

  if (loading) return <div className="verify-page"><div className="verify-loading">Loading certificate…</div></div>;
  if (error)   return <div className="verify-page"><div className="verify-error">⚠ {error}</div></div>;

  const { valid, remaining, metadata } = data;
  const kwh    = Number(metadata.kwh);
  const mwh    = kwh / 1000;
  const source = ENERGY_SOURCES[metadata.source] || 'Other';
  const co2    = (mwh * CO2_PER_MWH).toFixed(3);
  const km     = Math.round(mwh * CO2_PER_MWH * KM_PER_TCO2);
  const trees  = Math.round(mwh * CO2_PER_MWH * TREES_PER_TCO2);

  const isOracle  = (metadata.dataHash || '').startsWith('oracle://');
  const expiresAt = new Date(Number(metadata.expiresAt) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const issuedAt  = new Date(Number(metadata.issuedAt)  * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const pageUrl  = window.location.href;
  const embedCode = `<iframe src="${window.location.origin}/embed/${tokenId}" width="380" height="200" frameborder="0" style="border-radius:10px;border:1px solid #e5e7eb"></iframe>`;

  const statusLabel = valid
    ? '✓ Valid Certificate'
    : metadata.fullyRetired
      ? '✗ Retired'
      : '✗ Expired';

  return (
    <div className="verify-page">

      {/* ── Status banner ──────────────────────────────────────────── */}
      <div className={`verify-banner ${valid ? 'banner-valid' : 'banner-invalid'}`}>
        <div className="banner-status">{statusLabel}</div>
        <div className="banner-id">Certificate #{tokenId}</div>
        {isOracle && (
          <div className="oracle-chip">🔗 Oracle Verified · Chainlink</div>
        )}
      </div>

      <div className="verify-body">

        {/* ── Source + impact hero ───────────────────────────────────── */}
        <div className="verify-hero">
          <div className="hero-source">
            <span className="hero-icon">{SOURCE_ICONS[source] || '⚡'}</span>
            <div>
              <div className="hero-source-name">{source}</div>
              <div className="hero-location">{metadata.location}</div>
            </div>
          </div>
          <div className="hero-kwh">
            <span className="hero-kwh-value">{kwh.toLocaleString()}</span>
            <span className="hero-kwh-unit">kWh produced</span>
          </div>
        </div>

        {/* ── Impact cards ──────────────────────────────────────────── */}
        <div className="impact-cards">
          <div className="impact-card impact-green">
            <div className="impact-value">~{co2}</div>
            <div className="impact-label">tCO₂ Avoided</div>
          </div>
          <div className="impact-card">
            <div className="impact-value">~{km.toLocaleString()}</div>
            <div className="impact-label">km by car avoided</div>
          </div>
          <div className="impact-card">
            <div className="impact-value">~{trees}</div>
            <div className="impact-label">Trees equivalent (1 yr)</div>
          </div>
          <div className="impact-card">
            <div className="impact-value">{Number(remaining).toLocaleString()}</div>
            <div className="impact-label">kWh remaining</div>
          </div>
        </div>

        {/* ── Details grid ──────────────────────────────────────────── */}
        <div className="verify-details">
          <h2 className="details-title">Certificate Details</h2>
          <div className="details-grid">
            <div className="detail-row"><span>Token ID</span><strong>#{tokenId}</strong></div>
            <div className="detail-row"><span>Producer</span><strong className="mono">{metadata.producer}</strong></div>
            <div className="detail-row"><span>Issuer</span><strong className="mono">{isOracle ? 'RecChain Oracle (Chainlink)' : metadata.issuer}</strong></div>
            <div className="detail-row"><span>Issued</span><strong>{issuedAt}</strong></div>
            <div className="detail-row"><span>Valid Until</span><strong>{expiresAt}</strong></div>
            <div className="detail-row"><span>Verification</span>
              <strong className={isOracle ? 'oracle-text' : ''}>{isOracle ? '🔗 Chainlink Functions' : '✓ Manual'}</strong>
            </div>
            <div className="detail-row"><span>Data Reference</span><strong className="mono wrap">{metadata.dataHash}</strong></div>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="verify-actions">
          <a
            href={`/api/recs/${tokenId}/passport`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            View PDF Passport
          </a>
          <a
            href={`/api/recs/${tokenId}/passport?download=1`}
            className="btn btn-secondary"
          >
            Download PDF
          </a>
          <Link to="/" className="btn btn-outline">
            ← Marketplace
          </Link>
        </div>

        {/* ── Embed ─────────────────────────────────────────────────── */}
        <div className="embed-section">
          <h2 className="details-title">Embed on your website</h2>
          <p className="embed-desc">
            Place this badge on your corporate website or ESG report to show verified renewable energy usage.
          </p>
          <div className="embed-preview">
            <iframe
              src={`/embed/${tokenId}`}
              width="380"
              height="200"
              frameBorder="0"
              style={{ borderRadius: 10, border: '1px solid #e5e7eb' }}
              title="REC Verification Badge"
            />
          </div>
          <div className="embed-code-wrap">
            <code className="embed-code">{embedCode}</code>
            <CopyButton text={embedCode} />
          </div>
        </div>

      </div>
    </div>
  );
}
