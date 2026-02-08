import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { PortfolioPosition, PortfolioSummary } from '../hooks/usePortfolioSummary';

interface PortfolioSummaryResponse {
  data: PortfolioSummary;
}

interface UniverseStock {
  symbol: string;
  name: string;
}

interface UniverseResponse {
  data: UniverseStock[];
}

type SortableColumn =
  | 'symbol'
  | 'quantity'
  | 'avgCost'
  | 'currentPrice'
  | 'marketValue'
  | 'unrealizedPnL'
  | 'unrealizedPnLPercent';

interface PositionFormState {
  id?: string;
  symbol: string;
  quantity: string;
  avgCost: string;
  dateAcquired: string;
  notes: string;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatPercentAbsolute(value: number): string {
  return `${Math.abs(value).toFixed(2)}%`;
}

function pnlClass(value: number): string {
  if (value > 0) return 'text-neon-green';
  if (value < 0) return 'text-red-400';
  return 'text-gray-300';
}

function parseCsvRows(content: string): Array<Record<string, string>> {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rows.length < 2) return [];

  const headers = rows[0].split(',').map((header) => header.trim().toLowerCase());
  const dataRows = rows.slice(1);

  return dataRows.map((line) => {
    const values = line.split(',').map((value) => value.trim());
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
}

function toPositionPayload(record: Record<string, string>) {
  const symbol = (record.symbol ?? '').trim().toUpperCase();
  const quantity = Number(record.quantity ?? record.qty ?? '');
  const avgCost = Number(record.avgcost ?? record['avg cost'] ?? record.avg_price ?? '');
  const dateAcquiredRaw = (record.dateacquired ?? record.date ?? '').trim();
  const notesRaw = (record.notes ?? '').trim();

  if (!symbol || Number.isNaN(quantity) || Number.isNaN(avgCost)) {
    return null;
  }

  const maybeDate = dateAcquiredRaw.length > 0 ? new Date(dateAcquiredRaw) : null;
  const hasValidDate = maybeDate != null && !Number.isNaN(maybeDate.getTime());

  return {
    symbol,
    quantity,
    avgCost,
    ...(hasValidDate ? { dateAcquired: maybeDate.toISOString() } : {}),
    ...(notesRaw.length > 0 ? { notes: notesRaw } : {}),
  };
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180.0);
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

const EMPTY_FORM: PositionFormState = {
  symbol: '',
  quantity: '',
  avgCost: '',
  dateAcquired: '',
  notes: '',
};

export function Portfolio() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sortBy, setSortBy] = useState<SortableColumn>('marketValue');
  const [sortDesc, setSortDesc] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<PositionFormState>(EMPTY_FORM);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PortfolioPosition | null>(null);

  const portfolioQuery = useQuery({
    queryKey: ['portfolio', 'summary', 'page'],
    queryFn: () => api.get<PortfolioSummaryResponse>('/portfolio/positions'),
    refetchInterval: 30_000,
  });

  const symbolsQuery = useQuery({
    queryKey: ['stocks', 'search', 'portfolio', symbolSearch],
    queryFn: () =>
      api.get<UniverseResponse>(
        `/stocks?active=true&limit=8&search=${encodeURIComponent(symbolSearch.trim())}`,
      ),
    enabled: isFormOpen && symbolSearch.trim().length > 0,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      symbol: string;
      quantity: number;
      avgCost: number;
      dateAcquired?: string;
      notes?: string;
    }) => {
      if (payload.id) {
        const { id, ...body } = payload;
        return api.put(`/portfolio/positions/${id}`, body);
      }
      return api.post('/portfolio/positions', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
      setIsFormOpen(false);
      setForm(EMPTY_FORM);
      setSymbolSearch('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/portfolio/positions/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
      setDeleteTarget(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (payloads: Array<{
      symbol: string;
      quantity: number;
      avgCost: number;
      dateAcquired?: string;
      notes?: string;
    }>) => {
      await Promise.all(
        payloads.map((payload) => api.post('/portfolio/positions', payload)),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
    },
  });

  const positions = portfolioQuery.data?.data.positions ?? [];

  const sortedPositions = useMemo(() => {
    const next = [...positions];
    const direction = sortDesc ? -1 : 1;
    next.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];

      if (typeof left === 'string' && typeof right === 'string') {
        return left.localeCompare(right) * direction;
      }
      return ((left as number) - (right as number)) * direction;
    });
    return next;
  }, [positions, sortBy, sortDesc]);

  const totals = useMemo(() => {
    return sortedPositions.reduce(
      (acc, position) => {
        acc.quantity += position.quantity;
        acc.marketValue += position.marketValue;
        acc.unrealizedPnL += position.unrealizedPnL;
        return acc;
      },
      { quantity: 0, marketValue: 0, unrealizedPnL: 0 },
    );
  }, [sortedPositions]);

  const allocation = useMemo(() => {
    const totalValue = sortedPositions.reduce(
      (sum, position) => sum + position.marketValue,
      0,
    );
    const colors = [
      '#00d4ff',
      '#00ff41',
      '#ff00ff',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#22d3ee',
    ];

    let angle = 0;
    return sortedPositions.map((position, index) => {
      const ratio = totalValue > 0 ? position.marketValue / totalValue : 0;
      const sweep = ratio * 360;
      const slice = {
        symbol: position.symbol,
        value: position.marketValue,
        ratio,
        color: colors[index % colors.length],
        startAngle: angle,
        endAngle: angle + sweep,
      };
      angle += sweep;
      return slice;
    });
  }, [sortedPositions]);

  const setSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortDesc((previous) => !previous);
      return;
    }
    setSortBy(column);
    setSortDesc(column !== 'symbol');
  };

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setSymbolSearch('');
    setIsFormOpen(true);
  };

  const openEditModal = (position: PortfolioPosition) => {
    const maybeDate =
      position.dateAcquired != null ? new Date(position.dateAcquired) : null;
    const parsedDate =
      maybeDate != null && !Number.isNaN(maybeDate.getTime())
        ? maybeDate.toISOString().slice(0, 10)
        : '';

    setForm({
      id: position.id,
      symbol: position.symbol,
      quantity: String(position.quantity),
      avgCost: String(position.avgCost),
      dateAcquired: parsedDate,
      notes: position.notes ?? '',
    });
    setSymbolSearch(position.symbol);
    setIsFormOpen(true);
  };

  const formErrors = useMemo(() => {
    const quantity = Number(form.quantity);
    const avgCost = Number(form.avgCost);
    return {
      symbol: form.symbol.trim().length === 0 ? 'Symbol required' : '',
      quantity:
        form.quantity.trim().length === 0 || Number.isNaN(quantity) || quantity <= 0
          ? 'Quantity must be > 0'
          : '',
      avgCost:
        form.avgCost.trim().length === 0 || Number.isNaN(avgCost) || avgCost <= 0
          ? 'Avg cost must be > 0'
          : '',
    };
  }, [form.avgCost, form.quantity, form.symbol]);

  const isFormValid =
    formErrors.symbol.length === 0 &&
    formErrors.quantity.length === 0 &&
    formErrors.avgCost.length === 0;

  const submitForm = () => {
    if (!isFormValid) return;

    upsertMutation.mutate({
      id: form.id,
      symbol: form.symbol.trim().toUpperCase(),
      quantity: Number(form.quantity),
      avgCost: Number(form.avgCost),
      ...(form.dateAcquired.trim().length > 0
        ? { dateAcquired: new Date(form.dateAcquired).toISOString() }
        : {}),
      ...(form.notes.trim().length > 0 ? { notes: form.notes.trim() } : {}),
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleCsvSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const records = parseCsvRows(content);
    const payloads = records
      .map(toPositionPayload)
      .filter(
        (payload): payload is NonNullable<ReturnType<typeof toPositionPayload>> =>
          payload !== null,
      );

    if (payloads.length > 0) {
      importMutation.mutate(payloads);
    }

    event.target.value = '';
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Portfolio</h1>
          <p className="mt-2 text-sm text-gray-400">
            Track open positions with live P&amp;L and manage entries manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded border border-neon-green/60 px-3 py-2 text-sm font-medium text-neon-green transition hover:bg-neon-green/10"
          >
            + Add Position
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded border border-neon-cyan/60 px-3 py-2 text-sm font-medium text-neon-cyan transition hover:bg-neon-cyan/10"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvSelect}
            className="hidden"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neon-green/40 bg-dark-800 p-4 shadow-[0_0_18px_rgba(0,255,65,0.12)]">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Total Value</p>
          <p className="mt-2 text-2xl font-bold text-neon-green">
            {formatMoney(portfolioQuery.data?.data.totalValue ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-neon-cyan/40 bg-dark-800 p-4 shadow-[0_0_18px_rgba(0,212,255,0.12)]">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Total P&amp;L</p>
          <p className={`mt-2 text-2xl font-bold ${pnlClass(portfolioQuery.data?.data.totalPnL ?? 0)}`}>
            {formatMoney(portfolioQuery.data?.data.totalPnL ?? 0)}
          </p>
          <p className={`mt-1 text-sm ${pnlClass(portfolioQuery.data?.data.totalPnL ?? 0)}`}>
            {formatPercent(portfolioQuery.data?.data.totalPnLPercent ?? 0)}
          </p>
        </div>
      </div>

      {allocation.length > 0 && (
        <div className="mt-6 rounded-lg border border-dark-600 bg-dark-800/90 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Allocation by Position
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <svg viewBox="0 0 120 120" className="h-36 w-36">
              <circle cx="60" cy="60" r="36" stroke="#1f2937" strokeWidth="14" fill="none" />
              {allocation.map((slice) => (
                <path
                  key={slice.symbol}
                  d={describeArc(60, 60, 36, slice.startAngle, slice.endAngle)}
                  stroke={slice.color}
                  strokeWidth="14"
                  fill="none"
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <div className="space-y-1 text-xs">
              {allocation.map((slice) => (
                <div key={slice.symbol} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-gray-200">{slice.symbol}</span>
                  <span className="text-gray-500">
                    {formatPercentAbsolute(slice.ratio * 100)} · {formatMoney(slice.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-dark-600 bg-dark-800/90">
        <table className="min-w-full divide-y divide-dark-600 text-sm">
          <thead className="bg-dark-900/70 text-xs uppercase tracking-[0.08em] text-gray-400">
            <tr>
              {[
                ['symbol', 'Symbol'],
                ['quantity', 'Qty'],
                ['avgCost', 'Avg Cost'],
                ['currentPrice', 'Current Price'],
                ['marketValue', 'Market Value'],
                ['unrealizedPnL', 'P&L'],
                ['unrealizedPnLPercent', 'P&L %'],
              ].map(([column, label]) => {
                const typedColumn = column as SortableColumn;
                return (
                  <th key={column} className="px-3 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => setSort(typedColumn)}
                      className="inline-flex items-center gap-1 hover:text-neon-cyan"
                    >
                      {label}
                      <span className="text-[10px]">
                        {sortBy === typedColumn ? (sortDesc ? '▼' : '▲') : '↕'}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {portfolioQuery.isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  Loading positions...
                </td>
              </tr>
            )}
            {portfolioQuery.error && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-red-400">
                  Failed to load positions: {portfolioQuery.error.message}
                </td>
              </tr>
            )}
            {!portfolioQuery.isLoading && !portfolioQuery.error && sortedPositions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  No positions yet.
                </td>
              </tr>
            )}

            {!portfolioQuery.isLoading &&
              !portfolioQuery.error &&
              sortedPositions.map((position) => (
                <tr key={position.id} className="text-gray-200">
                  <td className="px-3 py-2 font-semibold text-neon-cyan">{position.symbol}</td>
                  <td className="px-3 py-2">{position.quantity.toFixed(2)}</td>
                  <td className="px-3 py-2">{formatMoney(position.avgCost)}</td>
                  <td className="px-3 py-2">{formatMoney(position.currentPrice)}</td>
                  <td className="px-3 py-2">{formatMoney(position.marketValue)}</td>
                  <td className={`px-3 py-2 font-medium ${pnlClass(position.unrealizedPnL)}`}>
                    {formatMoney(position.unrealizedPnL)}
                  </td>
                  <td className={`px-3 py-2 font-medium ${pnlClass(position.unrealizedPnLPercent)}`}>
                    {formatPercent(position.unrealizedPnLPercent)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(position)}
                        className="rounded border border-neon-cyan/50 px-2 py-1 text-xs text-neon-cyan hover:bg-neon-cyan/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(position)}
                        className="rounded border border-red-400/60 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
          {!portfolioQuery.isLoading && !portfolioQuery.error && sortedPositions.length > 0 && (
            <tfoot className="border-t border-dark-600 bg-dark-900/50 text-sm text-gray-300">
              <tr>
                <td className="px-3 py-3 font-semibold">Total</td>
                <td className="px-3 py-3">{totals.quantity.toFixed(2)}</td>
                <td className="px-3 py-3">-</td>
                <td className="px-3 py-3">-</td>
                <td className="px-3 py-3 font-semibold">{formatMoney(totals.marketValue)}</td>
                <td className={`px-3 py-3 font-semibold ${pnlClass(totals.unrealizedPnL)}`}>
                  {formatMoney(totals.unrealizedPnL)}
                </td>
                <td className="px-3 py-3">-</td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {(upsertMutation.error || importMutation.error) && (
        <p className="mt-3 text-sm text-red-400">
          {(upsertMutation.error ?? importMutation.error)?.message}
        </p>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-dark-600 bg-dark-800 p-5">
            <h2 className="text-lg font-semibold text-gray-100">
              {form.id ? 'Edit Position' : 'Add Position'}
            </h2>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500">Symbol</span>
                <input
                  value={form.symbol}
                  onChange={(event) => {
                    const value = event.target.value.toUpperCase();
                    setForm((previous) => ({ ...previous, symbol: value }));
                    setSymbolSearch(value);
                  }}
                  placeholder="AAPL"
                  className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                />
                {formErrors.symbol && (
                  <p className="mt-1 text-xs text-red-400">{formErrors.symbol}</p>
                )}
              </label>

              {symbolsQuery.data?.data && symbolsQuery.data.data.length > 0 && (
                <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-dark-600 bg-dark-900 p-2">
                  {symbolsQuery.data.data.map((stock) => (
                    <button
                      key={stock.symbol}
                      type="button"
                      onClick={() => setForm((previous) => ({ ...previous, symbol: stock.symbol }))}
                      className="block w-full rounded px-2 py-1 text-left text-xs text-gray-300 hover:bg-dark-700"
                    >
                      <span className="font-semibold text-gray-100">{stock.symbol}</span>
                      <span className="ml-2 text-gray-500">{stock.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-gray-500">Quantity</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, quantity: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                  />
                  {formErrors.quantity && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.quantity}</p>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Avg Cost</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.avgCost}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, avgCost: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                  />
                  {formErrors.avgCost && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.avgCost}</p>
                  )}
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-gray-500">Date Acquired (optional)</span>
                <input
                  type="date"
                  value={form.dateAcquired}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, dateAcquired: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">Notes (optional)</span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, notes: event.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full resize-none rounded border border-dark-600 bg-dark-900 px-3 py-2 text-sm text-gray-100 focus:border-neon-green focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setForm(EMPTY_FORM);
                }}
                className="rounded border border-dark-600 px-3 py-2 text-sm text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitForm}
                disabled={!isFormValid || upsertMutation.isPending}
                className="rounded border border-neon-green/60 px-3 py-2 text-sm text-neon-green hover:bg-neon-green/10 disabled:opacity-50"
              >
                {upsertMutation.isPending
                  ? form.id
                    ? 'Saving...'
                    : 'Adding...'
                  : form.id
                    ? 'Save Changes'
                    : 'Add Position'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-dark-600 bg-dark-800 p-5">
            <h2 className="text-lg font-semibold text-gray-100">Delete Position</h2>
            <p className="mt-2 text-sm text-gray-400">
              Confirm deletion for <span className="font-semibold text-gray-100">{deleteTarget.symbol}</span>.
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
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
