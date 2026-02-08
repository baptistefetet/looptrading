import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WatchlistRow } from '../hooks/useWatchlist';

interface UniverseStock {
  symbol: string;
  name: string;
  market: 'US' | 'EU';
  sector: string | null;
  active: boolean;
}

interface UniverseResponse {
  data: UniverseStock[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface YahooSearchItem {
  symbol: string;
  name: string;
  market: 'US' | 'EU';
  exchange: string | null;
  type: string | null;
  inUniverse: boolean;
  active: boolean | null;
}

interface YahooSearchResponse {
  data: YahooSearchItem[];
}

interface WatchlistResponse {
  data: WatchlistRow[];
}

interface PortfolioPosition {
  id: string;
  symbol: string;
}

interface PortfolioSummaryResponse {
  data: {
    positions: PortfolioPosition[];
  };
}

type ActiveFilter = 'true' | 'false' | 'all';
type MarketFilter = 'ALL' | 'US' | 'EU';
type AddMarket = 'AUTO' | 'US' | 'EU';

function formatMarket(market: 'US' | 'EU'): string {
  return market === 'US' ? 'US' : 'EU';
}

export function Universe() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [yahooSearch, setYahooSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('true');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const [addSymbol, setAddSymbol] = useState('');
  const [addMarket, setAddMarket] = useState<AddMarket>('AUTO');
  const [addSector, setAddSector] = useState('');

  const [positionTargetSymbol, setPositionTargetSymbol] = useState<string | null>(null);
  const [positionQty, setPositionQty] = useState('');
  const [positionAvgCost, setPositionAvgCost] = useState('');
  const [positionDate, setPositionDate] = useState('');
  const [positionNotes, setPositionNotes] = useState('');

  const params = useMemo(() => {
    const query = new URLSearchParams();
    query.set('limit', String(pageSize));
    query.set('offset', String(pageIndex * pageSize));
    query.set('active', activeFilter);
    query.set('market', marketFilter);
    query.set('sortBy', 'symbol');
    query.set('sortOrder', 'asc');
    if (search.trim().length > 0) {
      query.set('search', search.trim());
    }
    return query.toString();
  }, [activeFilter, marketFilter, pageIndex, pageSize, search]);

  const universeQuery = useQuery({
    queryKey: ['universe', params],
    queryFn: () => api.get<UniverseResponse>(`/stocks?${params}`),
    placeholderData: (previous) => previous,
  });

  const yahooSearchQuery = useQuery({
    queryKey: ['universe', 'yahoo-search', yahooSearch],
    queryFn: () =>
      api.get<YahooSearchResponse>(
        `/stocks/yahoo-search?q=${encodeURIComponent(yahooSearch.trim())}&limit=10`,
      ),
    enabled: yahooSearch.trim().length > 0,
  });

  const watchlistQuery = useQuery({
    queryKey: ['watchlist', 'universe'],
    queryFn: () => api.get<WatchlistResponse>('/watchlist?limit=100'),
  });

  const portfolioQuery = useQuery({
    queryKey: ['portfolio', 'summary', 'universe'],
    queryFn: () => api.get<PortfolioSummaryResponse>('/portfolio/positions'),
  });

  const watchlistSymbols = useMemo(
    () => new Set((watchlistQuery.data?.data ?? []).map((row) => row.symbol)),
    [watchlistQuery.data?.data],
  );
  const portfolioSymbols = useMemo(
    () =>
      new Set(
        (portfolioQuery.data?.data.positions ?? []).map((position) => position.symbol),
      ),
    [portfolioQuery.data?.data.positions],
  );

  const addStockMutation = useMutation({
    mutationFn: (payload: { symbol: string; market?: 'US' | 'EU'; sector?: string }) =>
      api.post('/stocks', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['universe'] });
      setAddSymbol('');
      setAddSector('');
      setAddMarket('AUTO');
    },
  });

  const removeStockMutation = useMutation({
    mutationFn: (symbol: string) => api.delete(`/stocks/${encodeURIComponent(symbol)}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['universe'] });
    },
  });

  const addWatchlistMutation = useMutation({
    mutationFn: (symbol: string) => api.post('/watchlist', { symbol }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const addPositionMutation = useMutation({
    mutationFn: (payload: {
      symbol: string;
      quantity: number;
      avgCost: number;
      dateAcquired?: string;
      notes?: string;
    }) => api.post('/portfolio/positions', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
      setPositionTargetSymbol(null);
      setPositionQty('');
      setPositionAvgCost('');
      setPositionDate('');
      setPositionNotes('');
    },
  });

  const total = universeQuery.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(pageIndex + 1, totalPages);

  const submitAddStock = () => {
    const symbol = addSymbol.trim().toUpperCase();
    if (!symbol) return;

    addStockMutation.mutate({
      symbol,
      ...(addMarket !== 'AUTO' ? { market: addMarket } : {}),
      ...(addSector.trim().length > 0 ? { sector: addSector.trim() } : {}),
    });
  };

  const submitAddPosition = () => {
    if (!positionTargetSymbol) return;
    const quantity = Number(positionQty);
    const avgCost = Number(positionAvgCost);
    if (Number.isNaN(quantity) || quantity <= 0 || Number.isNaN(avgCost) || avgCost <= 0) {
      return;
    }

    const payload: {
      symbol: string;
      quantity: number;
      avgCost: number;
      dateAcquired?: string;
      notes?: string;
    } = {
      symbol: positionTargetSymbol,
      quantity,
      avgCost,
    };

    if (positionDate.trim().length > 0) {
      const parsed = new Date(positionDate);
      if (!Number.isNaN(parsed.getTime())) {
        payload.dateAcquired = parsed.toISOString();
      }
    }

    if (positionNotes.trim().length > 0) {
      payload.notes = positionNotes.trim();
    }

    addPositionMutation.mutate(payload);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Universe</h1>
          <p className="mt-2 text-sm text-gray-400">
            Browse symbols, activate/deactivate stocks, then add to watchlist or portfolio.
          </p>
        </div>

        <div className="rounded-lg border border-dark-600 bg-dark-800/90 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Add Symbol</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={addSymbol}
              onChange={(event) => setAddSymbol(event.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-28 rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
            />
            <select
              value={addMarket}
              onChange={(event) => setAddMarket(event.target.value as AddMarket)}
              className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
            >
              <option value="AUTO">Auto market</option>
              <option value="US">US</option>
              <option value="EU">EU</option>
            </select>
            <input
              value={addSector}
              onChange={(event) => setAddSector(event.target.value)}
              placeholder="Sector (optional)"
              className="w-40 rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
            />
            <button
              type="button"
              onClick={submitAddStock}
              disabled={addStockMutation.isPending}
              className="rounded border border-neon-cyan/60 px-3 py-1.5 text-sm text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
            >
              {addStockMutation.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
          {addStockMutation.error && (
            <p className="mt-2 text-xs text-red-400">{addStockMutation.error.message}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPageIndex(0);
          }}
          placeholder="Search symbol or name..."
          className="w-72 rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        />
        <select
          value={marketFilter}
          onChange={(event) => {
            setMarketFilter(event.target.value as MarketFilter);
            setPageIndex(0);
          }}
          className="rounded border border-dark-600 bg-dark-900 px-2 py-2 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        >
          <option value="ALL">Market: all</option>
          <option value="US">Market: US</option>
          <option value="EU">Market: EU</option>
        </select>
        <select
          value={activeFilter}
          onChange={(event) => {
            setActiveFilter(event.target.value as ActiveFilter);
            setPageIndex(0);
          }}
          className="rounded border border-dark-600 bg-dark-900 px-2 py-2 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        >
          <option value="true">Active only</option>
          <option value="all">Active + inactive</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      <div className="mt-4 rounded-lg border border-dark-600 bg-dark-800/90 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Yahoo Finance Search</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={yahooSearch}
            onChange={(event) => setYahooSearch(event.target.value)}
            placeholder="Search on Yahoo (ex: Palantir, PLTR, ASML...)"
            className="w-80 rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
          />
        </div>

        {yahooSearchQuery.isLoading && (
          <p className="mt-3 text-sm text-gray-500">Searching Yahoo...</p>
        )}
        {yahooSearchQuery.error && (
          <p className="mt-3 text-sm text-red-400">
            Yahoo search failed: {yahooSearchQuery.error.message}
          </p>
        )}
        {!yahooSearchQuery.isLoading &&
          !yahooSearchQuery.error &&
          yahooSearch.trim().length > 0 && (
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {(yahooSearchQuery.data?.data ?? []).length === 0 && (
                <p className="text-sm text-gray-500">No Yahoo symbol match.</p>
              )}
              {(yahooSearchQuery.data?.data ?? []).map((item) => (
                <div
                  key={`${item.symbol}-${item.exchange ?? 'na'}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-dark-600 bg-dark-900/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-neon-green">{item.symbol}</p>
                    <p className="truncate text-xs text-gray-500">
                      {item.name} · {item.exchange ?? '-'} · {item.type ?? '-'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-neon-cyan/60 px-2 py-1 text-xs text-neon-cyan hover:bg-neon-cyan/10"
                    >
                      Yahoo
                    </a>
                    <button
                      type="button"
                      onClick={() => addStockMutation.mutate({ symbol: item.symbol })}
                      disabled={addStockMutation.isPending || (item.inUniverse && item.active)}
                      className="rounded border border-neon-green/60 px-2 py-1 text-xs text-neon-green hover:bg-neon-green/10 disabled:opacity-50"
                    >
                      {item.inUniverse ? (item.active ? 'In universe' : 'Reactivate') : 'Add universe'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-dark-600 bg-dark-800/90">
        <table className="min-w-full divide-y divide-dark-600 text-sm">
          <thead className="bg-dark-900/70 text-xs uppercase tracking-[0.08em] text-gray-400">
            <tr>
              <th className="px-3 py-3 text-left">Symbol</th>
              <th className="px-3 py-3 text-left">Name</th>
              <th className="px-3 py-3 text-left">Market</th>
              <th className="px-3 py-3 text-left">Sector</th>
              <th className="px-3 py-3 text-left">State</th>
              <th className="px-3 py-3 text-left">Links</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {universeQuery.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  Loading universe...
                </td>
              </tr>
            )}
            {universeQuery.error && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-red-400">
                  Failed to load universe: {universeQuery.error.message}
                </td>
              </tr>
            )}
            {!universeQuery.isLoading &&
              !universeQuery.error &&
              (universeQuery.data?.data.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No symbols match current filters.
                  </td>
                </tr>
              )}
            {!universeQuery.isLoading &&
              !universeQuery.error &&
              (universeQuery.data?.data ?? []).map((stock) => {
                const inWatchlist = watchlistSymbols.has(stock.symbol);
                const inPortfolio = portfolioSymbols.has(stock.symbol);

                return (
                  <tr key={stock.symbol} className="text-gray-200">
                    <td className="px-3 py-2 font-semibold text-neon-cyan">{stock.symbol}</td>
                    <td className="px-3 py-2">{stock.name}</td>
                    <td className="px-3 py-2">{formatMarket(stock.market)}</td>
                    <td className="px-3 py-2">{stock.sector ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          stock.active
                            ? 'bg-neon-green/15 text-neon-green'
                            : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {stock.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/stocks/${encodeURIComponent(stock.symbol)}`}
                        className="text-xs text-neon-cyan hover:underline"
                      >
                        Open detail
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => addWatchlistMutation.mutate(stock.symbol)}
                          disabled={inWatchlist || addWatchlistMutation.isPending}
                          className="rounded border border-neon-magenta/60 px-2 py-1 text-xs text-neon-magenta hover:bg-neon-magenta/10 disabled:opacity-50"
                        >
                          {inWatchlist ? 'In watchlist' : 'Add watchlist'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPositionTargetSymbol(stock.symbol)}
                          disabled={addPositionMutation.isPending}
                          className="rounded border border-neon-green/60 px-2 py-1 text-xs text-neon-green hover:bg-neon-green/10 disabled:opacity-50"
                        >
                          {inPortfolio ? 'Add more position' : 'Add position'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStockMutation.mutate(stock.symbol)}
                          disabled={!stock.active || removeStockMutation.isPending}
                          className="rounded border border-red-400/60 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {(removeStockMutation.error || addWatchlistMutation.error || addPositionMutation.error) && (
        <p className="mt-3 text-sm text-red-400">
          {(removeStockMutation.error ?? addWatchlistMutation.error ?? addPositionMutation.error)?.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
        <div>
          {total} symbols · page {currentPage} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPageIndex(0);
            }}
            className="rounded border border-dark-600 bg-dark-900 px-2 py-1 text-gray-100 focus:border-neon-cyan focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button
            type="button"
            onClick={() => setPageIndex((previous) => Math.max(0, previous - 1))}
            disabled={pageIndex === 0}
            className="rounded border border-dark-600 px-2 py-1 text-gray-300 hover:border-neon-cyan disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() =>
              setPageIndex((previous) => Math.min(totalPages - 1, previous + 1))
            }
            disabled={pageIndex >= totalPages - 1}
            className="rounded border border-dark-600 px-2 py-1 text-gray-300 hover:border-neon-cyan disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {positionTargetSymbol && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-dark-600 bg-dark-800 p-5">
            <h2 className="text-lg font-semibold text-gray-100">
              Add Position · {positionTargetSymbol}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500">Quantity</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={positionQty}
                  onChange={(event) => setPositionQty(event.target.value)}
                  className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Average cost</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={positionAvgCost}
                  onChange={(event) => setPositionAvgCost(event.target.value)}
                  className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Date acquired (optional)</span>
                <input
                  type="date"
                  value={positionDate}
                  onChange={(event) => setPositionDate(event.target.value)}
                  className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Notes (optional)</span>
                <textarea
                  rows={3}
                  value={positionNotes}
                  onChange={(event) => setPositionNotes(event.target.value)}
                  className="mt-1 w-full resize-none rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPositionTargetSymbol(null);
                  setPositionQty('');
                  setPositionAvgCost('');
                  setPositionDate('');
                  setPositionNotes('');
                }}
                className="rounded border border-dark-600 px-3 py-2 text-sm text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddPosition}
                disabled={addPositionMutation.isPending}
                className="rounded border border-neon-green/60 px-3 py-2 text-sm text-neon-green hover:bg-neon-green/10 disabled:opacity-50"
              >
                {addPositionMutation.isPending ? 'Adding...' : 'Add Position'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
