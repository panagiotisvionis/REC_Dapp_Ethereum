import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🏭',
    title: 'Automated REC Issuance',
    desc: 'IoT smart meters push real-time production data via Chainlink oracle. Certificates are minted on-chain instantly — no manual paperwork, no delays.',
    tag: 'Chainlink Oracle',
  },
  {
    icon: '🤖',
    title: 'AI Energy Auditor',
    desc: 'Statistical anomaly detection (z-score fraud screening), predictive maintenance alerts, and health scores for every site in your fleet. Spot problems before auditors do.',
    tag: 'ML Fraud Detection',
  },
  {
    icon: '📄',
    title: 'Carbon Passport',
    desc: 'Every certificate generates a verified PDF with QR code, embeddable badge for your website, and a public blockchain verification page — ready for ESG reports.',
    tag: 'ESG Reporting',
  },
  {
    icon: '🔁',
    title: 'On-Chain Marketplace',
    desc: 'Buy, sell, and retire RECs peer-to-peer without intermediaries. Smart-contract escrow ensures atomic settlement. Full audit trail on Ethereum.',
    tag: 'DeFi Settlement',
  },
];

const STATS = [
  { value: '1 kWh', label: 'token granularity' },
  { value: '< 15s', label: 'issuance time' },
  { value: '100%', label: 'on-chain verifiable' },
  { value: '0', label: 'intermediaries' },
];

const STEPS = [
  { n: '01', title: 'Connect your meters', desc: 'Register IoT smart meters. Our Chainlink oracle reads production data hourly.' },
  { n: '02', title: 'Certificates auto-mint', desc: 'Validated kWh production is turned into ERC-1155 tokens on Ethereum — immutable and auditable.' },
  { n: '03', title: 'Monitor & audit', desc: 'AI Auditor screens every meter for anomalies, degradation trends, and potential fraud in real time.' },
  { n: '04', title: 'Report & retire', desc: 'Export Carbon Passports for ESG filings. Retire certificates on-chain to prove net-zero claims.' },
];

export default function LandingPage() {
  return (
    <div className="landing">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-content">
          <span className="hero-badge">Now on Ethereum Sepolia Testnet</span>
          <h1 className="hero-headline">
            Renewable Energy Certificates,<br />
            <span className="hero-accent">Automated &amp; Verifiable</span>
          </h1>
          <p className="hero-sub">
            RecChain connects IoT smart meters to blockchain-issued certificates,
            adds AI-powered fraud detection, and generates audit-ready ESG reports —
            all in one platform.
          </p>
          <div className="hero-actions">
            <Link to="/marketplace" className="btn btn-primary btn-lg">
              Explore Live Demo
            </Link>
            <a
              href="mailto:panagiotisvionis@gmail.com?subject=RecChain%20Demo%20Request"
              className="btn btn-outline btn-lg"
            >
              Request Demo
            </a>
          </div>
          <p className="hero-footnote">
            No sign-up required · Connect MetaMask to interact · Sepolia testnet
          </p>
        </div>

        <div className="hero-stats">
          {STATS.map(s => (
            <div key={s.label} className="hero-stat">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="landing-section">
        <h2 className="section-title">Everything a green energy platform needs</h2>
        <p className="section-sub">
          Built for energy communities, solar farms, and ESG compliance teams.
        </p>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <span className="feature-tag">{f.tag}</span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="landing-section landing-section--alt">
        <h2 className="section-title">How it works</h2>
        <div className="steps-grid">
          {STEPS.map(s => (
            <div key={s.n} className="step-card">
              <span className="step-number">{s.n}</span>
              <h4 className="step-title">{s.title}</h4>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Built on ──────────────────────────────────────────────────────── */}
      <section className="landing-section">
        <h2 className="section-title">Built on proven infrastructure</h2>
        <div className="tech-strip">
          {['Ethereum', 'Chainlink', 'OpenZeppelin', 'ERC-1155', 'IPFS', 'MetaMask'].map(t => (
            <span key={t} className="tech-chip">{t}</span>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="landing-cta">
        <h2 className="cta-headline">Ready to automate your REC management?</h2>
        <p className="cta-sub">
          We're onboarding early partners. If you manage renewable energy production
          and need automated certification &amp; ESG reporting, let's talk.
        </p>
        <a
          href="mailto:panagiotisvionis@gmail.com?subject=RecChain%20Demo%20Request&body=Hi%2C%20I%27d%20like%20to%20learn%20more%20about%20RecChain."
          className="btn btn-primary btn-lg"
        >
          Request a Demo →
        </a>
        <p className="cta-footnote">
          Or explore the live platform yourself:{' '}
          <Link to="/marketplace">Marketplace</Link> ·{' '}
          <Link to="/auditor">AI Auditor</Link> ·{' '}
          <Link to="/portfolio">Portfolio</Link>
        </p>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <span>RecChain — Energy ESG Intelligence Platform</span>
        <span className="footer-dot">·</span>
        <span>Built on Ethereum</span>
        <span className="footer-dot">·</span>
        <a href="mailto:panagiotisvionis@gmail.com">Contact</a>
      </footer>
    </div>
  );
}
