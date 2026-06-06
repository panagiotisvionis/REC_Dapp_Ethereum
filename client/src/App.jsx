import { Routes, Route } from 'react-router-dom';
import { Web3Provider }  from './context/Web3Context';
import Navbar            from './components/Navbar';
import LandingPage       from './components/LandingPage';
import Marketplace       from './components/Marketplace';
import Portfolio         from './components/Portfolio';
import IssueRec          from './components/IssueRec';
import VerifyPage        from './components/VerifyPage';
import EmbedBadge        from './components/EmbedBadge';
import AIAuditor         from './components/AIAuditor';
import './styles/global.css';

// Embed route renders without navbar (inside an <iframe> on external sites)
function EmbedRoute() {
  return (
    <Web3Provider>
      <EmbedBadge />
    </Web3Provider>
  );
}

function MainLayout() {
  return (
    <Web3Provider>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/"                    element={<LandingPage />} />
          <Route path="/marketplace"         element={<Marketplace />} />
          <Route path="/portfolio"           element={<Portfolio   />} />
          <Route path="/issue"               element={<IssueRec    />} />
          <Route path="/verify/:tokenId"     element={<VerifyPage  />} />
          <Route path="/auditor"             element={<AIAuditor   />} />
        </Routes>
      </main>
    </Web3Provider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/embed/:tokenId" element={<EmbedRoute />} />
      <Route path="/*"              element={<MainLayout />} />
    </Routes>
  );
}
