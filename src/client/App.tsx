import { Routes, Route } from 'react-router-dom';

function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900">LoopTrading</h1>
      <p className="mt-4 text-gray-600">Swing Trading Dashboard</p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Portfolio</h2>
          <p className="text-gray-500">Coming soon...</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <p className="text-gray-500">Coming soon...</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Alerts</h2>
          <p className="text-gray-500">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </div>
  );
}

export default App;
