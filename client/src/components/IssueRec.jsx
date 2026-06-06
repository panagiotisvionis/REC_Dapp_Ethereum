import { useState }    from 'react';
import { useWeb3 }      from '../context/Web3Context';
import { ENERGY_SOURCES, SOURCE_ICONS } from '../lib/config';
import OracleIssuance   from './OracleIssuance';

const INITIAL = {
  producer:  '',
  source:    '0',
  kwh:       '',
  location:  '',
  dataHash:  '',
};

export default function IssueRec() {
  const { account, isIssuer } = useWeb3();
  const [tab,      setTab]    = useState('manual');
  const [form,     setForm]   = useState(INITIAL);
  const [status,   setStatus] = useState(null);
  const [loading,  setLoading] = useState(false);

  if (!account) {
    return (
      <div className="page">
        <div className="empty-state">Connect your wallet to access the issuer panel.</div>
      </div>
    );
  }

  if (!isIssuer) {
    return (
      <div className="page">
        <div className="empty-state">
          Your account does not have the ISSUER_ROLE. Contact the platform administrator.
        </div>
      </div>
    );
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (Number(form.kwh) < 1000) {
      setStatus({ type: 'error', msg: 'Minimum issuance is 1 MWh (1 000 kWh).' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/recs/issue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          producer: form.producer,
          source:   Number(form.source),
          kwh:      Number(form.kwh),
          location: form.location,
          dataHash: form.dataHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus({ type: 'success', msg: `REC issued! Token ID: ${data.tokenId} | Tx: ${data.txHash}` });
      setForm(INITIAL);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Issue REC</h1>
        <p className="page-subtitle">Issue a new Renewable Energy Certificate batch to a producer.</p>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>
          Manual Issuance
        </button>
        <button className={`tab-btn ${tab === 'oracle' ? 'active' : ''}`} onClick={() => setTab('oracle')}>
          🔗 Oracle / Automated
        </button>
      </div>

      {tab === 'oracle' && <OracleIssuance />}

      {tab === 'manual' && status && (
        <div className={`alert alert-${status.type}`}>
          {status.msg}
          <button className="alert-close" onClick={() => setStatus(null)}>✕</button>
        </div>
      )}

      {tab === 'manual' && <div className="card form-card">
        <form onSubmit={handleSubmit} className="issue-form">
          <div className="form-group">
            <label>Producer Address</label>
            <input
              name="producer" type="text" className="input" required
              placeholder="0x…"
              value={form.producer} onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Energy Source</label>
              <select name="source" className="input" value={form.source} onChange={handleChange}>
                {ENERGY_SOURCES.map((s, i) => (
                  <option key={i} value={i}>{SOURCE_ICONS[s]} {s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Production (kWh)</label>
              <input
                name="kwh" type="number" className="input" required
                placeholder="Min 1 000"
                min="1000" step="100"
                value={form.kwh} onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location (ISO 3166-2)</label>
            <input
              name="location" type="text" className="input" required
              placeholder="e.g. GR-AT"
              value={form.location} onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Production Report (IPFS CID)</label>
            <input
              name="dataHash" type="text" className="input" required
              placeholder="ipfs://Qm…"
              value={form.dataHash} onChange={handleChange}
            />
            <span className="field-hint">Upload the smart meter report to IPFS and paste the CID here.</span>
          </div>

          {form.kwh >= 1000 && (
            <div className="issue-preview">
              <strong>{(Number(form.kwh) / 1000).toFixed(1)} MWh</strong> →{' '}
              {Number(form.kwh).toLocaleString()} token units to{' '}
              <code>{form.producer || '…'}</code>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Issuing on-chain…' : 'Issue Certificate'}
          </button>
        </form>
      </div>}
    </div>
  );
}
