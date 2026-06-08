import { useState, useEffect, useCallback, useRef } from 'react';
import { Link }                             from 'react-router-dom';
import { ethers }                           from 'ethers';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useWeb3 }                          from '../context/Web3Context';
import { ENERGY_SOURCES, SOURCE_ICONS, CO2_PER_MWH, DEMO_MODE } from '../lib/config';
import { DEMO_HOLDINGS, DEMO_MONTHLY }      from '../lib/demo';
import { fetchPortfolio }                   from '../lib/api';

// ── Animated counter ──────────────────────────────────────────────────────
function useCounter(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(e * target));
      if (p >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ── ESG Summary with animated counters + trends ───────────────────────────
function ESGSummary({ holdings }) {
  const totalHeld    = holdings.reduce((s, h) => s + Number(h.balance), 0);
  const totalRetired = holdings.reduce((s, h) => s + Number(h.retired), 0);
  const totalCO2     = totalRetired / 1000 * CO2_PER_MWH;
  const batches      = holdings.length;

  const cHeld    = useCounter(totalHeld);
  const cRetired = useCounter(totalRetired);
  const cCO2     = useCounter(Math.round(totalCO2 * 100));
  const cBatches = useCounter(batches);

  const stats = [
    { icon: '⚡', value: cHeld.toLocaleString(),            unit: 'kWh',  label: 'Total Held',          trend: '+12%', up: true  },
    { icon: '✅', value: cRetired.toLocaleString(),          unit: 'kWh',  label: 'Retired (ESG Claims)', trend: '+8%',  up: true  },
    { icon: '🌱', value: (cCO2 / 100).toFixed(2),           unit: 'tCO₂', label: 'CO₂ Avoided',         trend: '+8%',  up: true  },
    { icon: '📜', value: cBatches,                           unit: '',     label: 'Certificate Batches',  trend: '+2',   up: true  },
  ];

  return (
    <div className="esg-summary-pro">
      <div className="esg-grid-pro">
        {stats.map(s => (
          <div key={s.label} className="esg-card-pro">
            <div className="esg-card-top">
              <span className="esg-icon-pro">{s.icon}</span>
              <span className={`esg-trend ${s.up ? 'trend-up' : 'trend-down'}`}>
                {s.up ? '↑' : '↓'} {s.trend}
              </span>
            </div>
            <div className="esg-val-row">
              <span className="esg-value-pro">{s.value}</span>
              {s.unit && <span className="esg-unit">{s.unit}</span>}
            </div>
            <div className="esg-label-pro">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────
const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: '0 4px 6px rgba(0,0,0,.07)',
  },
  cursor: { fill: 'rgba(34,197,94,.06)' },
};

function PortfolioCharts({ holdings }) {
  const data = DEMO_MONTHLY;

  return (
    <div className="portfolio-charts">
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Monthly Production</span>
          <span className="chart-badge chart-badge-green">kWh</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={v => [`${(v/1000).toFixed(0)} MWh`, 'Production']} />
            <Bar dataKey="production" fill="#22c55e" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Monthly Retirement</span>
          <span className="chart-badge chart-badge-blue">kWh</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={v => [`${(v/1000).toFixed(0)} MWh`, 'Retired']} />
            <Bar dataKey="retired" fill="#3b82f6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card chart-card-full">
        <div className="chart-card-header">
          <span className="chart-title">CO₂ Avoided Trend</span>
          <span className="chart-badge chart-badge-green">tCO₂</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={v => [`${v} tCO₂`, 'CO₂ Avoided']} />
            <Area type="monotone" dataKey="co2" stroke="#22c55e" strokeWidth={2} fill="url(#co2Grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Holding card ──────────────────────────────────────────────────────────
function HoldingCard({ holding, onRetire, onList }) {
  const [retireAmt, setRetireAmt] = useState('');
  const [listAmt,   setListAmt]   = useState('');
  const [listPrice, setListPrice] = useState('');
  const [loading,   setLoading]   = useState(null);
  const source   = ENERGY_SOURCES[holding.metadata.source] || 'Other';
  const isOracle = (holding.metadata.dataHash || '').startsWith('oracle://');
  const co2      = (Number(holding.retired) / 1000 * CO2_PER_MWH).toFixed(3);

  async function handleRetire() {
    const n = Number(retireAmt);
    if (!n || n <= 0) return;
    setLoading('retire');
    try { await onRetire(holding.tokenId, n); setRetireAmt(''); }
    finally { setLoading(null); }
  }
  async function handleList() {
    const n = Number(listAmt), p = listPrice;
    if (!n || !p) return;
    setLoading('list');
    try { await onList(holding.tokenId, n, p); setListAmt(''); setListPrice(''); }
    finally { setLoading(null); }
  }

  return (
    <div className="card holding-card">
      <div className="holding-card-header">
        <div className="holding-badges">
          <span className="source-badge">{SOURCE_ICONS[source]} {source}</span>
          {isOracle && <span className="oracle-badge-small">🔗 Oracle</span>}
        </div>
        <span className={`validity-badge ${holding.valid ? 'valid' : 'expired'}`}>
          {holding.valid ? '✓ Valid' : '✗ Expired'}
        </span>
      </div>

      <div className="listing-stats">
        <div className="stat"><span className="stat-label">Token ID</span><span className="stat-value">#{holding.tokenId}</span></div>
        <div className="stat"><span className="stat-label">Balance</span><span className="stat-value">{Number(holding.balance).toLocaleString()} kWh</span></div>
        <div className="stat"><span className="stat-label">Retired</span><span className="stat-value">{Number(holding.retired).toLocaleString()} kWh</span></div>
        <div className="stat co2-stat"><span className="stat-label">CO₂ Avoided</span><span className="stat-value co2-value">~{co2} tCO₂</span></div>
      </div>

      <div className="passport-links">
        <Link to={`/passport`} className="btn btn-outline btn-sm">📄 Passport</Link>
        <Link to={`/verify/${holding.tokenId}`} className="btn btn-outline btn-sm">🔍 Verify</Link>
        {!DEMO_MODE && (
          <a href={`/api/recs/${holding.tokenId}/passport?download=1`} className="btn btn-outline btn-sm">↓ PDF</a>
        )}
      </div>

      {Number(holding.balance) > 0 && holding.valid && onRetire && (
        <div className="action-rows">
          <div className="action-row">
            <input type="number" className="input-sm" placeholder="kWh to retire"
              value={retireAmt} onChange={e => setRetireAmt(e.target.value)} />
            <button className="btn btn-success btn-sm" onClick={handleRetire}
              disabled={loading === 'retire' || !retireAmt}>
              {loading === 'retire' ? '…' : 'Retire'}
            </button>
          </div>
          <div className="action-row">
            <input type="number" className="input-sm" placeholder="kWh to sell"  value={listAmt}   onChange={e => setListAmt(e.target.value)} />
            <input type="text"   className="input-sm" placeholder="ETH/kWh"      value={listPrice} onChange={e => setListPrice(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={handleList}
              disabled={loading === 'list' || !listAmt || !listPrice}>
              {loading === 'list' ? '…' : 'List'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────
function HoldingSkeleton() {
  return (
    <div className="card holding-card skeleton-card">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 16, marginBottom: 8, width: `${70 + i * 10}%` }} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function Portfolio() {
  const { contract, account } = useWeb3();
  const [holdings, setHoldings] = useState(DEMO_MODE ? DEMO_HOLDINGS : []);
  const [loading,  setLoading]  = useState(false);
  const [txStatus, setTxStatus] = useState(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const data = await fetchPortfolio(account);
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

  const showDemoNotice = DEMO_MODE && !account;

  return (
    <div className="page">
      <div className="page-header">
        <h1>ESG Portfolio</h1>
        <p className="page-subtitle">Track certificates, environmental impact, and production trends.</p>
      </div>

      {showDemoNotice && (
        <div className="demo-notice">
          <span>📊 Demo Mode — showing sample data. Connect wallet to view live portfolio.</span>
        </div>
      )}

      {txStatus && (
        <div className={`alert alert-${txStatus.type}`}>
          {txStatus.msg}
          <button className="alert-close" onClick={() => setTxStatus(null)}>✕</button>
        </div>
      )}

      {!account && !DEMO_MODE && (
        <div className="empty-state">Connect your wallet to view your portfolio.</div>
      )}

      {holdings.length > 0 && (
        <>
          <ESGSummary holdings={holdings} />
          <PortfolioCharts holdings={holdings} />
        </>
      )}

      {loading ? (
        <div className="grid">
          {[...Array(4)].map((_, i) => <HoldingSkeleton key={i} />)}
        </div>
      ) : holdings.length === 0 && account ? (
        <div className="empty-state">No RECs found for this address. Buy from the Marketplace!</div>
      ) : (
        <div className="grid">
          {holdings.map(h => (
            <HoldingCard
              key={h.tokenId}
              holding={h}
              onRetire={account ? handleRetire : null}
              onList={account ? handleList : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
