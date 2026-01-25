export function Portfolio() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100">Portfolio</h1>
      <p className="mt-2 text-gray-400">
        Manage your positions and track performance
      </p>

      <div className="card mt-8">
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <p className="text-lg">No positions yet</p>
            <p className="mt-2 text-sm">
              Add positions manually or import from CSV
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
