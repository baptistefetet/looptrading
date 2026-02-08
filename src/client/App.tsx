import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Screener } from './pages/Screener';
import { Watchlist } from './pages/Watchlist';
import { Portfolio } from './pages/Portfolio';
import { Settings } from './pages/Settings';
import { StockDetail } from './pages/StockDetail';
import { AlertNotifications } from './components/AlertNotifications';

function App() {
  return (
    <Layout>
      <AlertNotifications />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/screener" element={<Screener />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/alerts" element={<Settings />} />
        <Route path="/stocks/:symbol" element={<StockDetail />} />
      </Routes>
    </Layout>
  );
}

export default App;
