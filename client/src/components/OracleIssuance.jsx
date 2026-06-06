import { useState, useEffect } from 'react';
import { ethers }              from 'ethers';
import { useWeb3 }             from '../context/Web3Context';
import { ENERGY_SOURCES, SOURCE_ICONS } from '../lib/config';

function MeterCard({ meter, onRequest, loading }) {
  const [producer, setProducer] = useState('');

  return (
    <div className="card meter-card">
      <div className="meter-header">
        <span className="source-badge">
          {SOURCE_ICONS[meter.source] || '⚡'} {meter.source}
        </span>
        <span className="meter-id-badge">{meter.id}</span>
      </div>

      <div className="listing-stats">
        <div className="stat">
          <span className="stat-label">Region</span>
          <span className="stat-value">{meter.region}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Peak Output</span>
          <span className="stat-value">{meter.peakKwh.toLocaleString()} kWh/day</span>
        </div>
      </div>

      <div className="meter-action">
        <input
          type="text"
          className="input"
          placeholder="Producer address (0x…)"
          value={producer}
          onChange={e => setProducer(e.target.value)}
        />
        <button
          className="btn btn-primary btn-full"
          disabled={loading || !producer}
          onClick={() => onRequest(meter, producer)}
        >
          {loading ? 'Sending oracle request…' : 'Request Auto-Issuance'}
        </button>
      </div>
    </div>
  );
}

function LiveReadingPanel({ reading, onClose }) {
  if (!reading) return null;
  const isAnomaly = reading.anomalyInjected;

  return (
    <div className={`reading-panel ${isAnomaly ? 'anomaly' : 'valid'}`}>
      <div className="reading-panel-header">
        <span>{isAnomaly ? '⚠️ Anomaly Detected' : '✅ Reading Verified'}</span>
        <button className="alert-close" onClick={onClose}>✕</button>
      </div>

      <div className="reading-grid">
        <div className="reading-stat">
          <span className="stat-label">Current Reading</span>
          <span className="stat-value">{reading.kwhProduced.toLocaleString()} kWh</span>
        </div>
        <div className="reading-stat">
          <span className="stat-label">Historical Avg</span>
          <span className="stat-value">{reading.historicalAvg.toLocaleString()} kWh</span>
        </div>
        <div className="reading-stat">
          <span className="stat-label">Std Deviation (σ)</span>
          <span className="stat-value">± {reading.stdDev.toLocaleString()} kWh</span>
        </div>
        <div className="reading-stat">
          <span className="stat-label">Z-Score</span>
          <span className={`stat-value ${reading.zScore > 3 ? 'anomaly-value' : 'ok-value'}`}>
            {reading.zScore} {reading.zScore > 3 ? '(> 3σ)' : '(normal)'}
          </span>
        </div>
      </div>

      {isAnomaly && (
        <div className="anomaly-reason">
          <strong>Rejected:</strong> {reading.reason}
        </div>
      )}
    </div>
  );
}

export default function OracleIssuance() {
  const { contract, isIssuer, account } = useWeb3();
  const [meters,   setMeters]   = useState([]);
  const [loading,  setLoading]  = useState({});
  const [reading,  setReading]  = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetch('/api/iot/meters').then(r => r.json()).then(setMeters).catch(() => {});
  }, []);

  // Listen for OracleRequestFulfilled / OracleFulfillmentError events
  useEffect(() => {
    if (!contract) return;

    const onFulfilled = (requestId, tokenId, kwh) => {
      setRequests(prev => prev.map(r =>
        r.requestId === requestId
          ? { ...r, status: 'fulfilled', tokenId: tokenId.toString(), kwh: kwh.toString() }
          : r
      ));
    };

    const onError = (requestId, err) => {
      setRequests(prev => prev.map(r =>
        r.requestId === requestId
          ? { ...r, status: 'error', error: ethers.toUtf8String(err) }
          : r
      ));
    };

    contract.on('OracleRequestFulfilled', onFulfilled);
    contract.on('OracleFulfillmentError', onError);
    return () => {
      contract.off('OracleRequestFulfilled', onFulfilled);
      contract.off('OracleFulfillmentError', onError);
    };
  }, [contract]);

  async function previewReading(meterId) {
    try {
      const res  = await fetch(`/api/iot/meter/${meterId}`);
      const data = await res.json();
      setReading(data);
    } catch {
      setReading(null);
    }
  }

  async function handleRequest(meter, producer) {
    if (!contract) {
      setTxStatus({ type: 'error', msg: 'Connect wallet first.' });
      return;
    }

    setLoading(prev => ({ ...prev, [meter.id]: true }));
    setTxStatus(null);

    // Preview the live reading first
    await previewReading(meter.id);

    try {
      const sourceIdx = ENERGY_SOURCES.indexOf(meter.source);
      const tx = await contract.requestAutoIssuance(
        producer,
        sourceIdx >= 0 ? sourceIdx : 5,
        meter.region,
        meter.id
      );
      setTxStatus({ type: 'pending', msg: 'Oracle request submitted. Waiting for Chainlink DON response…' });
      const receipt = await tx.wait();

      const event = receipt.logs
        .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
        .find(e => e && e.name === 'OracleRequestSent');

      const requestId = event?.args?.requestId;
      if (requestId) {
        setRequests(prev => [{
          requestId,
          meterId:   meter.id,
          producer,
          status:    'pending',
          timestamp: Date.now(),
        }, ...prev]);
      }
    } catch (err) {
      setTxStatus({ type: 'error', msg: err.reason || err.message });
    } finally {
      setLoading(prev => ({ ...prev, [meter.id]: false }));
    }
  }

  if (!account) {
    return (
      <div className="oracle-section">
        <div className="empty-state">Connect your wallet to use oracle-based issuance.</div>
      </div>
    );
  }

  if (!isIssuer) {
    return (
      <div className="oracle-section">
        <div className="empty-state">Your account does not have ISSUER_ROLE.</div>
      </div>
    );
  }

  return (
    <div className="oracle-section">
      <div className="oracle-explainer">
        <div className="explainer-icon">🔗</div>
        <div>
          <strong>How it works:</strong> Chainlink Functions fetches live IoT meter data off-chain,
          runs a 3-sigma anomaly detection algorithm, and — if the reading is valid — the smart
          contract automatically issues the REC. No manual verification required.
        </div>
      </div>

      {txStatus && (
        <div className={`alert alert-${txStatus.type}`}>
          {txStatus.msg}
          <button className="alert-close" onClick={() => setTxStatus(null)}>✕</button>
        </div>
      )}

      <LiveReadingPanel reading={reading} onClose={() => setReading(null)} />

      <h3 className="section-subtitle">Available IoT Meters</h3>
      <div className="grid">
        {meters.map(m => (
          <MeterCard
            key={m.id}
            meter={m}
            loading={!!loading[m.id]}
            onRequest={handleRequest}
          />
        ))}
      </div>

      {requests.length > 0 && (
        <div className="requests-log">
          <h3 className="section-subtitle">Oracle Request Log</h3>
          <table className="requests-table">
            <thead>
              <tr>
                <th>Meter</th>
                <th>Request ID</th>
                <th>Status</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.requestId}>
                  <td>{r.meterId}</td>
                  <td className="mono">{r.requestId.slice(0, 10)}…</td>
                  <td>
                    <span className={`status-pill status-${r.status}`}>
                      {r.status === 'pending'    && '⏳ Pending'}
                      {r.status === 'fulfilled'  && '✅ Fulfilled'}
                      {r.status === 'error'      && '❌ Error'}
                    </span>
                  </td>
                  <td className="mono">
                    {r.status === 'fulfilled' && `Token #${r.tokenId} · ${Number(r.kwh).toLocaleString()} kWh`}
                    {r.status === 'error'     && r.error}
                    {r.status === 'pending'   && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
