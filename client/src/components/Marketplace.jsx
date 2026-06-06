import { useState, useEffect, useCallback } from 'react';
import { ethers }                           from 'ethers';
import { useWeb3 }                          from '../context/Web3Context';
import { ENERGY_SOURCES, SOURCE_ICONS }     from '../lib/config';

function ListingCard({ listing, onBuy }) {
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const source = ENERGY_SOURCES[listing.metadata.source] || 'Other';
  const priceEth = ethers.formatEther(listing.pricePerKwh);
  const expiresDate = new Date(Number(listing.metadata.expiresAt) * 1000).toLocaleDateString();

  async function handleBuy() {
    const n = Number(amount);
    if (!n || n <= 0) return;
    setLoading(true);
    try {
      await onBuy(listing.id, n, listing.pricePerKwh);
      setAmount('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card listing-card">
      <div className="listing-header">
        <span className="source-badge">
          {SOURCE_ICONS[source]} {source}
        </span>
        <span className={`validity-badge ${listing.valid ? 'valid' : 'expired'}`}>
          {listing.valid ? 'Valid' : 'Expired'}
        </span>
      </div>

      <div className="listing-stats">
        <div className="stat">
          <span className="stat-label">Available</span>
          <span className="stat-value">{Number(listing.amount).toLocaleString()} kWh</span>
        </div>
        <div className="stat">
          <span className="stat-label">Price / kWh</span>
          <span className="stat-value">{parseFloat(priceEth).toFixed(6)} ETH</span>
        </div>
        <div className="stat">
          <span className="stat-label">Location</span>
          <span className="stat-value">{listing.metadata.location}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Expires</span>
          <span className="stat-value">{expiresDate}</span>
        </div>
      </div>

      <div className="listing-footer">
        <span className="token-id">Token #{listing.tokenId}</span>
        <div className="buy-row">
          <input
            type="number"
            className="input-sm"
            placeholder="kWh"
            min="1"
            max={listing.amount}
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBuy}
            disabled={loading || !amount}
          >
            {loading ? '…' : 'Buy'}
          </button>
        </div>
        {amount && (
          <span className="price-preview">
            Total: {parseFloat(ethers.formatEther(BigInt(listing.pricePerKwh) * BigInt(Math.floor(Number(amount) || 0))).toFixed(6))} ETH
          </span>
        )}
      </div>
    </div>
  );
}

export default function Marketplace() {
  const { contract, account }           = useWeb3();
  const [listings,  setListings]        = useState([]);
  const [loading,   setLoading]         = useState(true);
  const [txStatus,  setTxStatus]        = useState(null);
  const [filter,    setFilter]          = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/listings');
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleBuy(listingId, amount, pricePerKwh) {
    if (!contract) { setTxStatus({ type: 'error', msg: 'Connect wallet first.' }); return; }
    setTxStatus({ type: 'pending', msg: 'Confirm in MetaMask…' });
    try {
      const totalCost = BigInt(pricePerKwh) * BigInt(amount);
      const tx      = await contract.buyRec(listingId, amount, { value: totalCost });
      setTxStatus({ type: 'pending', msg: 'Transaction submitted. Waiting for confirmation…' });
      await tx.wait();
      setTxStatus({ type: 'success', msg: `Purchased ${amount} kWh successfully!` });
      load();
    } catch (err) {
      setTxStatus({ type: 'error', msg: err.reason || err.message });
    }
  }

  const filtered = filter === 'all'
    ? listings
    : listings.filter(l => ENERGY_SOURCES[l.metadata.source] === filter);

  return (
    <div className="page">
      <div className="page-header">
        <h1>REC Marketplace</h1>
        <p className="page-subtitle">Buy verified Renewable Energy Certificates directly on-chain.</p>
      </div>

      {txStatus && (
        <div className={`alert alert-${txStatus.type}`}>
          {txStatus.msg}
          <button className="alert-close" onClick={() => setTxStatus(null)}>✕</button>
        </div>
      )}

      {!account && (
        <div className="alert alert-info">Connect your wallet to purchase RECs.</div>
      )}

      <div className="filter-bar">
        {['all', ...ENERGY_SOURCES].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All Sources' : `${SOURCE_ICONS[f] || ''} ${f}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state">Loading listings…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No active listings found.</div>
      ) : (
        <div className="grid">
          {filtered.map(l => (
            <ListingCard key={l.id} listing={l} onBuy={handleBuy} />
          ))}
        </div>
      )}
    </div>
  );
}
