import { useState, useEffect, useCallback } from 'react';
import { Link }                             from 'react-router-dom';
import { ethers }                           from 'ethers';
import { useWeb3 }                          from '../context/Web3Context';
import { ENERGY_SOURCES, SOURCE_ICONS, CO2_PER_MWH } from '../lib/config';

function HoldingCard({ holding, onRetire, onList }) {
  const [retireAmt, setRetireAmt] = useState('');
  const [listAmt,   setListAmt]   = useState('');
  const [listPrice, setListPrice] = useState('');
  const [loading,   setLoading]   = useState(null);
  const source = ENERGY_SOURCES[holding.metadata.source] || 'Other';

  async function handleRetire() {
    const n = Number(retireAmt);
    if (!n || n <= 0) return;
    setLoading('retire');
    try { await onRetire(holding.tokenId, n); setRetireAmt(''); }
    finally { setLoading(null); }
  }

  async function handleList() {
    const n = Number(listAmt);
    const p = listPrice;
    if (!n || !p) return;
    setLoading('list');
    try { await onList(holding.tokenId, n, p); setListAmt(''); setListPrice(''); }
    finally { setLoading(null); }
  }

  const co2Tonnes = (Number(holding.retired) / 1000 * CO2_PER_MWH).toFixed(3);

  return (
    <div className="card holding-card">
      <div className="listing-header">
        <span className="source-badge">{SOURCE_ICONS[source]} {source}</span>
        <span className={`validity-badge ${holding.valid ? 'valid' : 'expired'}`}>
          {holding.valid ? 'Valid' : 'Expired'}
        </span>
      </div>

      <div className="listing-stats">
        <div className="stat">
          <span className="stat-label">Token ID</span>
          <span className="stat-value">#{holding.tokenId}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Balance</span>
          <span className="stat-value">{Number(holding.balance).toLocaleString()} kWh</span>
        </div>
        <div className="stat">
          <span className="stat-label">Retired</span>
          <span className="stat-value">{Number(holding.retired).toLocaleString()} kWh</span>
        </div>
        <div className="stat co2-stat">
          <span className="stat-label">CO₂ Avoided</span>
          <span className="stat-value co2-value">~{co2Tonnes} tCO₂</span>
        </div>
      </div>

      <div className="passport-links">
        <Link to={`/verify/${holding.tokenId}`} className="btn btn-outline btn-sm">
          View Certificate
        </Link>
        <a href={`/api/recs/${holding.tokenId}/passport?download=1`} className="btn btn-outline btn-sm">
          ↓ PDF Passport
        </a>
      </div>

      {Number(holding.balance) > 0 && holding.valid && (
        <div className="action-rows">
          <div className="action-row">
            <input
              type="number" className="input-sm" placeholder="kWh to retire"
              value={retireAmt} onChange={e => setRetireAmt(e.target.value)}
            />
            <button className="btn btn-success btn-sm" onClick={handleRetire} disabled={loading === 'retire' || !retireAmt}>
              {loading === 'retire' ? '…' : 'Retire'}
            </button>
          </div>
          <div className="action-row">
            <input type="number" className="input-sm" placeholder="kWh to sell" value={listAmt}   onChange={e => setListAmt(e.target.value)} />
            <input type="text"   className="input-sm" placeholder="ETH/kWh"     value={listPrice} onChange={e => setListPrice(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={handleList} disabled={loading === 'list' || !listAmt || !listPrice}>
              {loading === 'list' ? '…' : 'List'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ESGSummary({ holdings }) {
  const totalRetiredKwh  = holdings.reduce((s, h) => s + Number(h.retired), 0);
  const totalHeldKwh     = holdings.reduce((s, h) => s + Number(h.balance), 0);
  const totalCO2         = (totalRetiredKwh / 1000 * CO2_PER_MWH).toFixed(2);

  return (
    <div className="esg-summary">
      <h2>ESG Dashboard</h2>
      <div className="esg-grid">
        <div className="esg-card">
          <span className="esg-icon">⚡</span>
          <span className="esg-value">{totalHeldKwh.toLocaleString()}</span>
          <span className="esg-label">kWh Held</span>
        </div>
        <div className="esg-card esg-highlight">
          <span className="esg-icon">✅</span>
          <span className="esg-value">{totalRetiredKwh.toLocaleString()}</span>
          <span className="esg-label">kWh Retired</span>
        </div>
        <div className="esg-card esg-green">
          <span className="esg-icon">🌱</span>
          <span className="esg-value">~{totalCO2}</span>
          <span className="esg-label">tCO₂ Avoided</span>
        </div>
        <div className="esg-card">
          <span className="esg-icon">📜</span>
          <span className="esg-value">{holdings.length}</span>
          <span className="esg-label">Certificate Batches</span>
        </div>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const { contract, account }     = useWeb3();
  const [holdings, setHoldings]   = useState([]);
  const [loading,  setLoading]    = useState(false);
  const [txStatus, setTxStatus]   = useState(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/listings/portfolio/${account}`);
      const data = await res.json();
      setHoldings(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  async function handleRetire(tokenId, amount) {
    setTxStatus({ type: 'pending', msg: 'Confirm retirement in MetaMask…' });
    try {
      const tx = await contract.retireRec(BigInt(tokenId), BigInt(amount));
      setTxStatus({ type: 'pending', msg: 'Waiting for confirmation…' });
      await tx.wait();
      setTxStatus({ type: 'success', msg: `${amount} kWh retired successfully.` });
      load();
    } catch (err) {
      setTxStatus({ type: 'error', msg: err.reason || err.message });
    }
  }

  async function handleList(tokenId, amount, priceEth) {
    setTxStatus({ type: 'pending', msg: 'Approving contract…' });
    try {
      const approveTx = await contract.setApprovalForAll(await contract.getAddress(), true);
      await approveTx.wait();
      const priceWei = ethers.parseEther(priceEth);
      setTxStatus({ type: 'pending', msg: 'Creating listing…' });
      const tx = await contract.listRec(BigInt(tokenId), BigInt(amount), priceWei);
      await tx.wait();
      setTxStatus({ type: 'success', msg: `Listed ${amount} kWh for sale.` });
      load();
    } catch (err) {
      setTxStatus({ type: 'error', msg: err.reason || err.message });
    }
  }

  if (!account) {
    return (
      <div className="page">
        <div className="empty-state">Connect your wallet to view your portfolio.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Portfolio</h1>
        <p className="page-subtitle">Manage your RECs, retire certificates, and track your environmental impact.</p>
      </div>

      {txStatus && (
        <div className={`alert alert-${txStatus.type}`}>
          {txStatus.msg}
          <button className="alert-close" onClick={() => setTxStatus(null)}>✕</button>
        </div>
      )}

      {holdings.length > 0 && <ESGSummary holdings={holdings} />}

      {loading ? (
        <div className="empty-state">Loading portfolio…</div>
      ) : holdings.length === 0 ? (
        <div className="empty-state">No RECs found for this address. Buy some from the Marketplace!</div>
      ) : (
        <div className="grid">
          {holdings.map(h => (
            <HoldingCard key={h.tokenId} holding={h} onRetire={handleRetire} onList={handleList} />
          ))}
        </div>
      )}
    </div>
  );
}
