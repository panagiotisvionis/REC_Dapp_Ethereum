import { Link } from 'react-router-dom';

// ── Enterprise trust banner ────────────────────────────────────────────────
const TRUST_CHIPS = ['ERC-1155', 'Chainlink Verified', 'IPFS Storage', 'ESG Reporting', 'Full Audit Trail'];

function EnterpriseBanner() {
  return (
    <div className="enterprise-banner">
      <span className="enterprise-label">Enterprise Ready</span>
      <div className="enterprise-chips">
        {TRUST_CHIPS.map(t => (
          <span key={t} className="enterprise-chip">✓ {t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Audience cards ────────────────────────────────────────────────────────
const AUDIENCES = [
  { icon: '🏭', title: 'Renewable Energy Producers', desc: 'Automate certificate issuance from your IoT meters. No manual reporting.' },
  { icon: '🤝', title: 'Energy Communities', desc: 'Track and share collective renewable production across member sites.' },
  { icon: '📊', title: 'ESG Consultants', desc: 'Deliver audit-ready carbon reports and blockchain proof to your clients.' },
  { icon: '🌍', title: 'Sustainability Teams', desc: 'Monitor fleet performance and generate verified net-zero evidence.' },
];

// ── Why RecChain ──────────────────────────────────────────────────────────
const BENEFITS = [
  { icon: '⚡', title: 'Automated Certificate Issuance', desc: 'IoT smart meters push data via Chainlink oracle. Certificates mint on-chain in under 15 seconds — no manual paperwork.' },
  { icon: '🔍', title: 'AI Fraud Detection', desc: 'Statistical z-score analysis screens every meter reading. Anomalies are flagged before certificates are issued.' },
  { icon: '📄', title: 'Carbon Passport Reporting', desc: 'Every certificate generates a verifiable PDF with QR code, embeddable badge, and a public blockchain verification page.' },
  { icon: '🔒', title: 'Blockchain Verification', desc: 'Immutable on-chain record. Anyone can verify any certificate in real time — no intermediaries, no disputes.' },
];

// ── How it works ──────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Connect Smart Meters',   desc: 'Register IoT devices. Our Chainlink oracle reads production hourly.' },
  { n: '02', title: 'Generate Certificates',  desc: 'Validated kWh is tokenised as ERC-1155 on Ethereum — 1 token = 1 kWh.' },
  { n: '03', title: 'Monitor with AI',        desc: 'Fleet-wide fraud detection, anomaly alerts, and predictive maintenance.' },
  { n: '04', title: 'Produce ESG Reports',    desc: 'Export Carbon Passports. Retire certificates to prove net-zero claims.' },
];

// ── App mockup screenshots ────────────────────────────────────────────────
function MockBrowser({ label, children }) {
  return (
    <div className="mock-browser">
      <div className="mock-titlebar">
        <span className="mock-dot red" />
        <span className="mock-dot amber" />
        <span className="mock-dot green" />
        <span className="mock-url">recchain.io/{label}</span>
      </div>
      <div className="mock-body">{children}</div>
    </div>
  );
}

function MockPortfolio() {
  return (
    <MockBrowser label="portfolio">
      <div className="mock-esg-grid">
        {[['188,000', 'kWh Produced'], ['61,000', 'kWh Retired'], ['21.4', 'tCO₂ Avoided'], ['14', 'Certificates']].map(([v, l]) => (
          <div key={l} className="mock-esg-card">
            <div className="mock-esg-val">{v}</div>
            <div className="mock-esg-lbl">{l}</div>
          </div>
        ))}
      </div>
      <div className="mock-chart-row">
        {[45, 62, 71, 84, 94, 88, 75].map((h, i) => (
          <div key={i} className="mock-bar-wrap">
            <div className="mock-bar" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
      <div className="mock-label-row">
        {['Jan','Feb','Mar','Apr','May','Jun','Jul'].map(m => (
          <span key={m} className="mock-month">{m}</span>
        ))}
      </div>
    </MockBrowser>
  );
}

function MockAuditor() {
  const meters = [
    { name: 'Kalamata Solar', score: 80, chip: 'suspicious', chipColor: '#92400e', chipBg: '#fef3c7' },
    { name: 'Makedonia Wind', score: 72, chip: 'warning',    chipColor: '#92400e', chipBg: '#fef3c7' },
    { name: 'Epirus Hydro',   score: 85, chip: 'normal',     chipColor: '#166534', chipBg: '#dcfce7' },
  ];
  return (
    <MockBrowser label="auditor">
      <div className="mock-fleet">
        <div className="mock-fleet-stat"><span className="mock-fleet-val">79</span><span className="mock-fleet-lbl">Fleet Score</span></div>
        <div className="mock-fleet-stat mock-warn"><span className="mock-fleet-val">2</span><span className="mock-fleet-lbl">Warnings</span></div>
        <div className="mock-fleet-stat"><span className="mock-fleet-val">5</span><span className="mock-fleet-lbl">Sites</span></div>
      </div>
      <div className="mock-site-list">
        {meters.map(m => (
          <div key={m.name} className="mock-site-row">
            <div className="mock-site-gauge" style={{ '--s': m.score / 100 }}>
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle cx="16" cy="16" r="12" fill="none" stroke="#22c55e" strokeWidth="4"
                  strokeDasharray={`${m.score * 0.754} 75.4`}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)" />
                <text x="16" y="20" textAnchor="middle" fontSize="8" fontWeight="700" fill="#22c55e">{m.score}</text>
              </svg>
            </div>
            <span className="mock-site-name">{m.name}</span>
            <span className="mock-chip" style={{ color: m.chipColor, background: m.chipBg }}>{m.chip}</span>
          </div>
        ))}
      </div>
    </MockBrowser>
  );
}

function MockPassport() {
  return (
    <MockBrowser label="passport/1">
      <div className="mock-passport-card">
        <div className="mock-passport-header">
          <span className="mock-passport-icon">☀️</span>
          <div>
            <div className="mock-passport-title">Solar · GR-AT</div>
            <div className="mock-passport-sub">Certificate #1 · Valid</div>
          </div>
          <div className="mock-qr">
            <div className="mock-qr-inner">
              {[...Array(4)].map((_,r) => (
                <div key={r} className="mock-qr-row">
                  {[...Array(4)].map((_,c) => (
                    <div key={c} className="mock-qr-cell" style={{ background: (r+c)%3===0 ? '#111' : '#fff' }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mock-passport-kwh">15,000 <span>kWh</span></div>
        <div className="mock-impact-row">
          <div className="mock-impact"><div className="mock-impact-v">5.25</div><div className="mock-impact-l">tCO₂</div></div>
          <div className="mock-impact"><div className="mock-impact-v">252</div><div className="mock-impact-l">Trees</div></div>
          <div className="mock-impact"><div className="mock-impact-v">21k</div><div className="mock-impact-l">km saved</div></div>
        </div>
        <div className="mock-blockchain-row">
          <span className="mock-chain-badge">🔗 On-chain verified</span>
          <span className="mock-chain-badge">📄 PDF ready</span>
        </div>
      </div>
    </MockBrowser>
  );
}

// ── Architecture diagram ──────────────────────────────────────────────────
function ArchDiagram() {
  const nodes = [
    { icon: '📡', label: 'IoT Meters' },
    { icon: '🔗', label: 'Chainlink Oracle' },
    { icon: '⛓', label: 'Smart Contract' },
    { icon: '📜', label: 'REC Token' },
    { icon: '📊', label: 'ESG Report' },
  ];
  return (
    <div className="arch-diagram">
      {nodes.map((n, i) => (
        <div key={n.label} className="arch-row">
          <div className="arch-node">
            <span className="arch-icon">{n.icon}</span>
            <span className="arch-label">{n.label}</span>
          </div>
          {i < nodes.length - 1 && <div className="arch-arrow">→</div>}
        </div>
      ))}
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="landing">
      <EnterpriseBanner />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-content">
          <h1 className="hero-headline">
            Audit-Ready<br />
            <span className="hero-accent">Renewable Energy Intelligence</span>
          </h1>
          <p className="hero-sub">
            Automated certificate issuance from IoT meters, AI-powered fraud
            detection, and blockchain-verified ESG reports — all in one platform.
          </p>
          <div className="hero-actions">
            <Link to="/marketplace" className="btn btn-primary btn-lg">Explore Live Demo</Link>
            <a
              href="mailto:panagiotisvionis@gmail.com?subject=RecChain%20Demo%20Request"
              className="btn btn-ghost btn-lg"
            >
              Request Demo →
            </a>
          </div>
          <p className="hero-footnote">No sign-up · Connect MetaMask · Local blockchain</p>
        </div>

        <div className="hero-stats">
          {[['< 15s', 'issuance time'], ['1 kWh', 'token granularity'], ['100%', 'on-chain verifiable'], ['0', 'intermediaries']].map(([v, l]) => (
            <div key={l} className="hero-stat">
              <span className="stat-value">{v}</span>
              <span className="stat-label">{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who it's for ──────────────────────────────────────────────── */}
      <section className="landing-section">
        <div className="section-eyebrow">Built for energy &amp; ESG teams</div>
        <h2 className="section-title">Who it's for</h2>
        <div className="audience-grid">
          {AUDIENCES.map(a => (
            <div key={a.title} className="audience-card">
              <span className="audience-icon">{a.icon}</span>
              <h3 className="audience-title">{a.title}</h3>
              <p className="audience-desc">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why RecChain ──────────────────────────────────────────────── */}
      <section className="landing-section landing-section--alt">
        <div className="section-eyebrow">Platform capabilities</div>
        <h2 className="section-title">Why RecChain</h2>
        <div className="benefits-grid">
          {BENEFITS.map(b => (
            <div key={b.title} className="benefit-card">
              <span className="benefit-check">✓</span>
              <div>
                <h3 className="benefit-title">{b.title}</h3>
                <p className="benefit-desc">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="landing-section">
        <div className="section-eyebrow">The workflow</div>
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

      {/* ── Screenshots ───────────────────────────────────────────────── */}
      <section className="landing-section landing-section--alt">
        <div className="section-eyebrow">Platform preview</div>
        <h2 className="section-title">Every screen tells a story</h2>
        <p className="section-sub">Real data. Real blockchain. Real ESG evidence.</p>
        <div className="screenshots-grid">
          <div className="screenshot-item">
            <MockPortfolio />
            <p className="screenshot-caption">Portfolio &amp; ESG Dashboard</p>
          </div>
          <div className="screenshot-item">
            <MockAuditor />
            <p className="screenshot-caption">AI Energy Auditor</p>
          </div>
          <div className="screenshot-item">
            <MockPassport />
            <p className="screenshot-caption">Carbon Passport</p>
          </div>
        </div>
      </section>

      {/* ── Architecture ──────────────────────────────────────────────── */}
      <section className="landing-section">
        <div className="section-eyebrow">Technical foundation</div>
        <h2 className="section-title">Built on proven infrastructure</h2>
        <ArchDiagram />
        <div className="tech-strip">
          {['Ethereum', 'Chainlink', 'OpenZeppelin ERC-1155', 'IPFS', 'MetaMask'].map(t => (
            <span key={t} className="tech-chip">{t}</span>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="landing-cta">
        <h2 className="cta-headline">Ready to automate your REC management?</h2>
        <p className="cta-sub">
          We are onboarding early partners. If you manage renewable energy production
          and need automated certification and ESG reporting, let's talk.
        </p>
        <a
          href="mailto:panagiotisvionis@gmail.com?subject=RecChain%20Demo%20Request&body=Hi%2C%20I%27d%20like%20to%20learn%20more%20about%20RecChain."
          className="btn btn-primary btn-lg"
        >
          Request a Demo →
        </a>
        <p className="cta-footnote">
          Or explore the live platform: {' '}
          <Link to="/marketplace">Marketplace</Link> ·{' '}
          <Link to="/auditor">AI Auditor</Link> ·{' '}
          <Link to="/passport">Carbon Passport</Link>
        </p>
      </section>

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
