import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OHLCVBar, StockHistory } from '@shared/types';
import { api } from '../lib/api';
import type { WatchlistRow } from '../hooks/useWatchlist';

interface WatchlistResponse {
  data: WatchlistRow[];
}

interface UniverseStock {
  symbol: string;
  name: string;
}

interface UniverseResponse {
  data: UniverseStock[];
}

interface HistoryResponse {
  data: StockHistory;
}

function formatMoney(value: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function pnlClass(value: number | null): string {
  if (value == null) return 'text-gray-400';
  if (value > 0) return 'text-neon-green';
  if (value < 0) return 'text-red-400';
  return 'text-gray-300';
}

function moveInArray<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const normalized = (value - min) / range;
      const y = height - normalized * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function Sparkline({
  bars,
  trendUp,
}: {
  bars: OHLCVBar[] | undefined;
  trendUp: boolean;
}) {
  if (!bars || bars.length === 0) {
    return <span className="text-xs text-gray-500">No 7D data</span>;
  }

  const closes = bars.map((bar) => bar.close);
  const path = buildSparklinePath(closes, 112, 28);
  const color = trendUp ? '#00ff41' : '#ff4d4f';

  return (
    <svg width="112" height="28" viewBox="0 0 112 28" className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function Watchlist() {
  const queryClient = useQueryClient();
  const [orderedItems, setOrderedItems] = useState<WatchlistRow[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<WatchlistRow | null>(null);
  const [alertTarget, setAlertTarget] = useState<WatchlistRow | null>(null);
  const [alertHighInput, setAlertHighInput] = useState('');
  const [alertLowInput, setAlertLowInput] = useState('');
  const [alertNotesInput, setAlertNotesInput] = useState('');

  const watchlistQuery = useQuery({
    queryKey: ['watchlist', 'page'],
    queryFn: () => api.get<WatchlistResponse>('/watchlist?limit=100'),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const items = watchlistQuery.data?.data ?? [];
    setOrderedItems(items);
  }, [watchlistQuery.data]);

  const symbolSearch = useQuery({
    queryKey: ['stocks', 'search', searchTerm],
    queryFn: () =>
      api.get<UniverseResponse>(
        `/stocks?active=true&limit=8&search=${encodeURIComponent(searchTerm.trim())}`,
      ),
    enabled: isAddModalOpen && searchTerm.trim().length > 0,
  });

  const watchlistSymbols = useMemo(
    () => new Set(orderedItems.map((item) => item.symbol)),
    [orderedItems],
  );

  const searchResults = useMemo(
    () =>
      (symbolSearch.data?.data ?? []).filter(
        (item) => !watchlistSymbols.has(item.symbol),
      ),
    [symbolSearch.data?.data, watchlistSymbols],
  );

  const sparklineQueries = useQueries({
    queries: orderedItems.map((item) => ({
      queryKey: ['stocks', 'history', item.symbol, '1w'],
      queryFn: () =>
        api.get<HistoryResponse>(
          `/stocks/${encodeURIComponent(item.symbol)}/history?period=1w`,
        ),
      staleTime: 60_000,
    })),
  });

  const sparklinesBySymbol = useMemo(() => {
    const map = new Map<string, OHLCVBar[]>();
    orderedItems.forEach((item, index) => {
      map.set(item.symbol, sparklineQueries[index]?.data?.data.bars ?? []);
    });
    return map;
  }, [orderedItems, sparklineQueries]);

  const addMutation = useMutation({
    mutationFn: (symbol: string) =>
      api.post<{ data: WatchlistRow }>('/watchlist', { symbol }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setIsAddModalOpen(false);
      setSearchTerm('');
      setSelectedSymbol('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/watchlist/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setDeleteTarget(null);
    },
  });

  const alertMutation = useMutation({
    mutationFn: ({
      id,
      targetPriceHigh,
      targetPriceLow,
      notes,
    }: {
      id: string;
      targetPriceHigh: number | null;
      targetPriceLow: number | null;
      notes: string | null;
    }) =>
      api.put<{ data: WatchlistRow }>(`/watchlist/${id}/alert`, {
        targetPriceHigh,
        targetPriceLow,
        notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setAlertTarget(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => api.put('/watchlist/reorder', { ids }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const handleAdd = () => {
    const normalized =
      selectedSymbol.trim().toUpperCase() || searchTerm.trim().toUpperCase();
    if (!normalized) return;
    addMutation.mutate(normalized);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || reorderMutation.isPending) return;

    const fromIndex = orderedItems.findIndex((item) => item.id === draggedId);
    const toIndex = orderedItems.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const previous = orderedItems;
    const next = moveInArray(orderedItems, fromIndex, toIndex);
    setOrderedItems(next);
    setDraggedId(null);

    reorderMutation.mutate(next.map((item) => item.id), {
      onError: () => {
        setOrderedItems(previous);
      },
    });
  };

  const openAlertModal = (item: WatchlistRow) => {
    setAlertTarget(item);
    setAlertHighInput(
      item.targetPriceHigh != null ? String(item.targetPriceHigh) : '',
    );
    setAlertLowInput(
      item.targetPriceLow != null ? String(item.targetPriceLow) : '',
    );
    setAlertNotesInput(item.notes ?? '');
  };

  const saveAlertTargets = () => {
    if (!alertTarget) return;
    const highValue = alertHighInput.trim() === '' ? null : Number(alertHighInput);
    const lowValue = alertLowInput.trim() === '' ? null : Number(alertLowInput);
    const notesValue = alertNotesInput.trim() === '' ? null : alertNotesInput.trim();

    if ((highValue != null && Number.isNaN(highValue)) || (lowValue != null && Number.isNaN(lowValue))) {
      return;
    }

    alertMutation.mutate({
      id: alertTarget.id,
      targetPriceHigh: highValue,
      targetPriceLow: lowValue,
      notes: notesValue,
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Watchlist</h1>
          <p className="mt-2 text-sm text-gray-400">
            Drag to reorder, track score and set per-symbol target alerts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="rounded border border-neon-magenta/60 px-3 py-2 text-sm font-medium text-neon-magenta transition hover:bg-neon-magenta/10"
        >
          + Add Symbol
        </button>
      </div>

      {watchlistQuery.isLoading && (
        <div className="card mt-8">
          <p className="text-sm text-gray-500">Loading watchlist...</p>
        </div>
      )}

      {watchlistQuery.error && (
        <div className="card mt-8">
          <p className="text-sm text-red-400">
            Failed to load watchlist: {watchlistQuery.error.message}
          </p>
        </div>
      )}

      {!watchlistQuery.isLoading && !watchlistQuery.error && (
        <div className="mt-8 space-y-3">
          {orderedItems.length === 0 && (
            <div className="card text-center text-gray-500">
              <p className="text-lg">Your watchlist is empty</p>
              <p className="mt-2 text-sm">Add symbols to start tracking setups.</p>
            </div>
          )}

          {orderedItems.map((item) => {
            const bars = sparklinesBySymbol.get(item.symbol);
            const firstClose = bars?.[0]?.close;
            const lastClose = bars?.[bars.length - 1]?.close;
            const trendUp =
              firstClose != null && lastClose != null ? lastClose >= firstClose : true;
            const hasAlert =
              item.targetPriceHigh != null || item.targetPriceLow != null;

            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDraggedId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(item.id)}
                className="rounded-lg border border-dark-600 bg-dark-800/90 p-4 transition hover:border-neon-magenta/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      className="cursor-grab rounded border border-dark-600 px-2 py-1 text-xs text-gray-500"
                      title="Drag to reorder"
                    >
                      ⋮⋮
                    </button>
                    <div className="min-w-0">
                      <Link
                        to={`/stocks/${encodeURIComponent(item.symbol)}`}
                        className="text-lg font-semibold text-neon-magenta hover:underline"
                      >
                        {item.symbol}
                      </Link>
                      <p className="truncate text-xs text-gray-500">{item.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Sparkline bars={bars} trendUp={trendUp} />
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-100">
                        {formatMoney(item.price)}
                      </p>
                      <p className={`text-xs ${pnlClass(item.change)}`}>
                        {formatPercent(item.change)}
                      </p>
                      <p className="text-xs text-gray-500">score {item.score ?? '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {hasAlert
                      ? `Alert: high ${formatMoney(item.targetPriceHigh)} / low ${formatMoney(item.targetPriceLow)}`
                      : 'No target alert configured'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAlertModal(item)}
                      className={`rounded border px-2 py-1 text-xs transition ${
                        hasAlert
                          ? 'border-neon-green/60 text-neon-green hover:bg-neon-green/10'
                          : 'border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10'
                      }`}
                    >
                      {hasAlert ? 'Edit Alert' : 'Set Alert'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="rounded border border-red-400/60 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-dark-600 bg-dark-800 p-5">
            <h2 className="text-lg font-semibold text-gray-100">Add to Watchlist</h2>
            <p className="mt-1 text-xs text-gray-500">
              Search by symbol or name, then add.
            </p>

            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setSelectedSymbol('');
              }}
              placeholder="AAPL, NVDA, Microsoft..."
              className="mt-4 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-magenta focus:outline-none"
            />

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {symbolSearch.isFetching && (
                <p className="text-xs text-gray-500">Searching symbols...</p>
              )}
              {!symbolSearch.isFetching &&
                searchTerm.trim().length > 0 &&
                searchResults.length === 0 && (
                  <p className="text-xs text-gray-500">No matching symbols.</p>
                )}
              {searchResults.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    setSearchTerm(item.symbol);
                  }}
                  className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                    selectedSymbol === item.symbol
                      ? 'border-neon-magenta/70 bg-neon-magenta/10 text-neon-magenta'
                      : 'border-dark-600 bg-dark-900 text-gray-200 hover:border-neon-magenta/40'
                  }`}
                >
                  <span className="font-semibold">{item.symbol}</span>
                  <span className="ml-2 text-xs text-gray-500">{item.name}</span>
                </button>
              ))}
            </div>

            {addMutation.error && (
              <p className="mt-3 text-sm text-red-400">{addMutation.error.message}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSearchTerm('');
                  setSelectedSymbol('');
                }}
                className="rounded border border-dark-600 px-3 py-2 text-sm text-gray-300 hover:border-neon-magenta/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={addMutation.isPending}
                className="rounded border border-neon-magenta/60 px-3 py-2 text-sm text-neon-magenta hover:bg-neon-magenta/10 disabled:opacity-50"
              >
                {addMutation.isPending ? 'Adding...' : 'Add Symbol'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-dark-600 bg-dark-800 p-5">
            <h2 className="text-lg font-semibold text-gray-100">Remove Symbol</h2>
            <p className="mt-2 text-sm text-gray-400">
              Remove <span className="font-semibold text-gray-100">{deleteTarget.symbol}</span> from your watchlist?
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded border border-dark-600 px-3 py-2 text-sm text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="rounded border border-red-400/60 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-dark-600 bg-dark-800 p-5">
            <h2 className="text-lg font-semibold text-gray-100">
              Target Alert · {alertTarget.symbol}
            </h2>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500">Target price high</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={alertHighInput}
                  onChange={(event) => setAlertHighInput(event.target.value)}
                  className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Target price low</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={alertLowInput}
                  onChange={(event) => setAlertLowInput(event.target.value)}
                  className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Notes (optional)</span>
                <textarea
                  value={alertNotesInput}
                  onChange={(event) => setAlertNotesInput(event.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
                />
              </label>
            </div>

            {alertMutation.error && (
              <p className="mt-3 text-sm text-red-400">{alertMutation.error.message}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAlertTarget(null)}
                className="rounded border border-dark-600 px-3 py-2 text-sm text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAlertTargets}
                disabled={alertMutation.isPending}
                className="rounded border border-neon-cyan/60 px-3 py-2 text-sm text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
              >
                {alertMutation.isPending ? 'Saving...' : 'Save Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
