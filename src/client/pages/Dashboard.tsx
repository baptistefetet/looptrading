export function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
      <p className="mt-2 text-gray-400">
        Overview of your trading activity and alerts
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Portfolio Summary */}
        <div className="card">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
            Portfolio Value
          </h2>
          <p className="mt-2 text-3xl font-bold text-neon-green">$0.00</p>
          <p className="mt-1 text-sm text-gray-500">0 positions</p>
        </div>

        {/* Active Alerts */}
        <div className="card">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
            Active Alerts
          </h2>
          <p className="mt-2 text-3xl font-bold text-neon-cyan">0</p>
          <p className="mt-1 text-sm text-gray-500">No pending alerts</p>
        </div>

        {/* Watchlist */}
        <div className="card">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
            Watchlist
          </h2>
          <p className="mt-2 text-3xl font-bold text-neon-magenta">0</p>
          <p className="mt-1 text-sm text-gray-500">symbols tracked</p>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card mt-8">
        <h2 className="text-lg font-semibold text-gray-100">Recent Alerts</h2>
        <div className="mt-4 flex items-center justify-center py-8 text-gray-500">
          No alerts yet. Configure your screener to start receiving signals.
        </div>
      </div>
    </div>
  );
}
