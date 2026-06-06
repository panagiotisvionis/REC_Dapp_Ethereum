import { Link, useLocation } from 'react-router-dom';
import { useWeb3 }           from '../context/Web3Context';

export default function Navbar() {
  const { account, isIssuer, connecting, error, connect } = useWeb3();
  const { pathname } = useLocation();

  const short = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">⚡</span>
        <span className="brand-name">RecChain</span>
      </div>

      <div className="navbar-links">
        <Link className={pathname === '/marketplace' ? 'nav-link active' : 'nav-link'} to="/marketplace">Marketplace</Link>
        <Link className={pathname === '/portfolio'   ? 'nav-link active' : 'nav-link'} to="/portfolio">Portfolio</Link>
        <Link className={pathname === '/auditor'     ? 'nav-link active' : 'nav-link'} to="/auditor">AI Auditor</Link>
        {isIssuer && (
          <Link className={pathname === '/issue' ? 'nav-link active' : 'nav-link'} to="/issue">Issue REC</Link>
        )}
      </div>

      <div className="navbar-wallet">
        {error && <span className="wallet-error" title={error}>⚠ Error</span>}
        {account ? (
          <div className="wallet-connected">
            <span className="wallet-dot" />
            <span className="wallet-address">{short}</span>
            {isIssuer && <span className="issuer-badge">Issuer</span>}
          </div>
        ) : (
          <button className="btn btn-primary" onClick={connect} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </nav>
  );
}
