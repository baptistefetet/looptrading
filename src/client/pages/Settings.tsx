export function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
      <p className="mt-2 text-gray-400">
        Configure your trading preferences and alerts
      </p>

      <div className="mt-8 space-y-6">
        {/* Alert Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100">
            Alert Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure how you receive trading alerts
          </p>
          <div className="mt-4 text-gray-500">
            Settings coming soon...
          </div>
        </div>

        {/* Scoring Configuration */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100">
            Scoring Configuration
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Adjust weights for technical indicators
          </p>
          <div className="mt-4 text-gray-500">
            Configuration coming soon...
          </div>
        </div>

        {/* Data Management */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100">
            Data Management
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your local data and cache
          </p>
          <div className="mt-4 text-gray-500">
            Data management coming soon...
          </div>
        </div>
      </div>
    </div>
  );
}
