import { useState, useEffect } from 'react';
import { useParams }           from 'react-router-dom';
import { ENERGY_SOURCES, SOURCE_ICONS, CO2_PER_MWH } from '../lib/config';

/**
 * Compact embeddable badge — rendered in an <iframe> on external sites.
 * No navbar, no external navigation. Self-contained.
 */
export default function EmbedBadge() {
  const { tokenId }           = useParams();
  const [data,   setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch(`/api/recs/${tokenId}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tokenId]);

  if (loading) return <div className="embed-wrapper"><div className="embed-loading">…</div></div>;
  if (error)   return <div className="embed-wrapper embed-error">⚠ Invalid certificate</div>;

  const { valid, metadata } = data;
  const source  = ENERGY_SOURCES[metadata.source] || 'Other';
  const kwh     = Number(metadata.kwh);
  const co2     = (kwh / 1000 * CO2_PER_MWH).toFixed(3);
  const isOracle = (metadata.dataHash || '').startsWith('oracle://');

  return (
    <div className="embed-wrapper">
      <div className={`embed-badge ${valid ? 'embed-valid' : 'embed-invalid'}`}>

        <div className="embed-header">
          <span className="embed-logo">⚡ RecChain</span>
          <span className={`embed-status ${valid ? '' : 'invalid'}`}>
            {valid ? '✓ Verified' : '✗ Expired'}
          </span>
        </div>

        <div className="embed-content">
          <div className="embed-source-row">
            <span className="embed-source-icon">{SOURCE_ICONS[source] || '⚡'}</span>
            <div>
              <div className="embed-source-name">{source} Energy</div>
              <div className="embed-location">{metadata.location}</div>
            </div>
          </div>

          <div className="embed-stats">
            <div className="embed-stat">
              <span className="embed-stat-val">{kwh.toLocaleString()}</span>
              <span className="embed-stat-lbl">kWh</span>
            </div>
            <div className="embed-stat-sep" />
            <div className="embed-stat">
              <span className="embed-stat-val">~{co2}</span>
              <span className="embed-stat-lbl">tCO₂ offset</span>
            </div>
            <div className="embed-stat-sep" />
            <div className="embed-stat">
              <span className="embed-stat-val">#{tokenId}</span>
              <span className="embed-stat-lbl">Token ID</span>
            </div>
          </div>
        </div>

        <div className="embed-footer">
          {isOracle && <span className="embed-oracle">🔗 Chainlink Verified</span>}
          <a
            href={`${window.location.origin}/verify/${tokenId}`}
            target="_blank"
            rel="noreferrer"
            className="embed-verify-link"
          >
            Verify on blockchain →
          </a>
        </div>

      </div>
    </div>
  );
}
