export function Watchlist() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100">Watchlist</h1>
      <p className="mt-2 text-gray-400">
        Track stocks you're interested in
      </p>

      <div className="card mt-8">
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <p className="text-lg">Your watchlist is empty</p>
            <p className="mt-2 text-sm">
              Add symbols to track their price and technical indicators
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
