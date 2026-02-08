import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AlertNotifications } from './components/AlertNotifications';

const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
);
const Screener = lazy(() =>
  import('./pages/Screener').then((module) => ({ default: module.Screener })),
);
const Universe = lazy(() =>
  import('./pages/Universe').then((module) => ({ default: module.Universe })),
);
const Watchlist = lazy(() =>
  import('./pages/Watchlist').then((module) => ({ default: module.Watchlist })),
);
const Portfolio = lazy(() =>
  import('./pages/Portfolio').then((module) => ({ default: module.Portfolio })),
);
const Settings = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings })),
);
const StockDetail = lazy(() =>
  import('./pages/StockDetail').then((module) => ({ default: module.StockDetail })),
);

function RouteLoader() {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">Loading page...</p>
    </div>
  );
}

function App() {
  return (
    <Layout>
      <AlertNotifications />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/universe" element={<Universe />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/alerts" element={<Settings />} />
          <Route path="/stocks/:symbol" element={<StockDetail />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;
