import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAlerts } from '../hooks/useAlerts';
import { usePortfolioSummary } from '../hooks/usePortfolioSummary';
import { useTopOpportunities } from '../hooks/useTopOpportunities';
import { useWatchlist } from '../hooks/useWatchlist';

interface StockQuoteResponse {
  data: {
    symbol: string;
    price: number;
    previousClose: number;
  };
}

function strategyLabel(strategy: string): string {
  if (strategy === 'PULLBACK') return 'Pullback';
  if (strategy === 'BREAKOUT') return 'Breakout';
  if (strategy === 'MACD_CROSS') return 'MACD';
  if (strategy === 'SCORE_THRESHOLD') return 'Score';
  return strategy;
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

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function lastUpdatedLabel(timestamp: number): string {
  if (!timestamp) return 'updating...';
  const elapsedMs = Date.now() - timestamp;
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));

  if (elapsedSec < 60) return `updated ${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  return `updated ${elapsedMin}m ago`;
}

function pnlClass(value: number): string {
  if (value > 0) return 'text-neon-green';
  if (value < 0) return 'text-red-400';
  return 'text-gray-300';
}

function scoreFillClass(score: number | null): string {
  if (score == null) return 'bg-dark-600';
  if (score >= 80) return 'bg-neon-green';
  if (score >= 60) return 'bg-neon-cyan';
  return 'bg-neon-magenta';
}

function WidgetHeader({
  title,
  updatedAt,
  action,
}: {
  title: string;
  updatedAt: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {title}
        </h2>
        <p className="mt-1 text-xs text-gray-500">{lastUpdatedLabel(updatedAt)}</p>
      </div>
      {action}
    </div>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const alertsQuery = useAlerts(10);
  const opportunitiesQuery = useTopOpportunities(5);
  const portfolioQuery = usePortfolioSummary();
  const watchlistQuery = useWatchlist(8);
  const positions = portfolioQuery.data?.data.positions ?? [];

  const quoteQueries = useQueries({
    queries: positions.map((position) => ({
      queryKey: ['stocks', 'quote', position.symbol],
      queryFn: () =>
        api.get<StockQuoteResponse>(
          `/stocks/${encodeURIComponent(position.symbol)}/quote`,
        ),
      refetchInterval: 30_000,
    })),
  });

  const dailyStats = useMemo(() => {
    let dailyPnL = 0;
    let previousCloseValue = 0;

    for (let i = 0; i < positions.length; i += 1) {
      const quote = quoteQueries[i]?.data?.data;
      if (!quote || quote.previousClose <= 0) continue;
      const quantity = positions[i].quantity;
      dailyPnL += (quote.price - quote.previousClose) * quantity;
      previousCloseValue += quote.previousClose * quantity;
    }

    const dailyPnLPercent =
      previousCloseValue > 0 ? (dailyPnL / previousCloseValue) * 100 : 0;

    return {
      dailyPnL: Math.round(dailyPnL * 100) / 100,
      dailyPnLPercent: Math.round(dailyPnLPercent * 100) / 100,
      hasData: previousCloseValue > 0,
    };
  }, [positions, quoteQueries]);

  const seenAlertsRef = useRef(new Set<string>());
  const alertsInitializedRef = useRef(false);
  const [highlightedAlertIds, setHighlightedAlertIds] = useState<string[]>([]);

  useEffect(() => {
    const alerts = alertsQuery.data?.data ?? [];

    if (!alertsInitializedRef.current) {
      alerts.forEach((alert) => seenAlertsRef.current.add(alert.id));
      alertsInitializedRef.current = true;
      return;
    }

    const newIds = alerts
      .filter((alert) => !seenAlertsRef.current.has(alert.id))
      .map((alert) => alert.id);

    if (newIds.length === 0) return;

    newIds.forEach((id) => seenAlertsRef.current.add(id));
    setHighlightedAlertIds((previous) =>
      Array.from(new Set([...previous, ...newIds])),
    );

    const timeoutId = window.setTimeout(() => {
      setHighlightedAlertIds((previous) =>
        previous.filter((id) => !newIds.includes(id)),
      );
    }, 10_000);

    return () => window.clearTimeout(timeoutId);
  }, [alertsQuery.data]);

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.put<{ data: { id: string } }>(`/alerts/${alertId}/acknowledge`, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['alerts', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts', 'notifications'] }),
      ]);
    },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-100">Dashboard</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-400">
        Active alerts, top opportunities, portfolio snapshot and watchlist in one terminal view.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-neon-cyan/40 bg-dark-800/90 p-5 shadow-[0_0_22px_rgba(0,212,255,0.1)]">
          <WidgetHeader
            title="Active Alerts"
            updatedAt={alertsQuery.dataUpdatedAt}
          />

          {alertsQuery.isLoading && (
            <p className="mt-5 text-sm text-gray-500">Loading alerts...</p>
          )}
          {alertsQuery.error && (
            <p className="mt-5 text-sm text-red-400">
              Failed to load alerts: {alertsQuery.error.message}
            </p>
          )}
          {!alertsQuery.isLoading && !alertsQuery.error && (
            <div className="mt-4 space-y-2">
              {alertsQuery.data?.data.length ? (
                alertsQuery.data.data.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-md border px-3 py-2 transition ${
                      highlightedAlertIds.includes(alert.id)
                        ? 'border-neon-cyan/80 bg-dark-700 shadow-[0_0_18px_rgba(0,212,255,0.45)]'
                        : 'border-dark-600 bg-dark-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-100">{alert.symbol}</span>
                          <span className="rounded bg-dark-700 px-1.5 py-0.5 text-[11px] text-gray-300">
                            {strategyLabel(alert.strategy)}
                          </span>
                          <span className="text-xs text-neon-cyan">
                            score {alert.score ?? '-'}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-500">{alert.message}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {formatTime(alert.triggeredAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={
                            acknowledgeMutation.isPending &&
                            acknowledgeMutation.variables === alert.id
                          }
                          className="rounded border border-neon-cyan/40 px-2 py-1 text-xs text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
                        >
                          ACK
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">
                  No active alerts.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-neon-green/40 bg-dark-800/90 p-5 shadow-[0_0_22px_rgba(0,255,65,0.12)]">
          <WidgetHeader title="Top Opportunities" updatedAt={opportunitiesQuery.dataUpdatedAt} />

          {opportunitiesQuery.isLoading && (
            <p className="mt-5 text-sm text-gray-500">Loading opportunities...</p>
          )}
          {opportunitiesQuery.error && (
            <p className="mt-5 text-sm text-red-400">
              Failed to load opportunities: {opportunitiesQuery.error.message}
            </p>
          )}
          {!opportunitiesQuery.isLoading && !opportunitiesQuery.error && (
            <div className="mt-4 space-y-3">
              {opportunitiesQuery.data?.data.length ? (
                opportunitiesQuery.data.data.map((row) => (
                  <Link
                    key={row.symbol}
                    to={`/stocks/${encodeURIComponent(row.symbol)}`}
                    className="block rounded-md border border-dark-600 bg-dark-900 px-3 py-2 transition hover:border-neon-green/60 hover:shadow-[0_0_18px_rgba(0,255,65,0.2)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-100">{row.symbol}</p>
                        <p className="text-xs text-gray-500">
                          {formatMoney(row.price)}{' '}
                          <span className={pnlClass(row.change)}>{formatPercent(row.change)}</span>
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-200">
                        {row.score ?? '-'}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-dark-700">
                      <div
                        className={`h-full rounded-full ${scoreFillClass(row.score)}`}
                        style={{ width: `${Math.max(0, Math.min(100, row.score ?? 0))}%` }}
                      />
                    </div>
                  </Link>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">
                  No scored opportunities yet.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-neon-green/40 bg-dark-800/90 p-5 shadow-[0_0_22px_rgba(0,255,65,0.12)]">
          <WidgetHeader title="Portfolio Summary" updatedAt={portfolioQuery.dataUpdatedAt} />

          {portfolioQuery.isLoading && (
            <p className="mt-5 text-sm text-gray-500">Loading portfolio...</p>
          )}
          {portfolioQuery.error && (
            <p className="mt-5 text-sm text-red-400">
              Failed to load portfolio: {portfolioQuery.error.message}
            </p>
          )}
          {!portfolioQuery.isLoading && !portfolioQuery.error && (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-dark-600 bg-dark-900 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Total Value</p>
                <p className="mt-2 text-xl font-bold text-neon-green">
                  {formatMoney(portfolioQuery.data?.data.totalValue ?? 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {portfolioQuery.data?.data.positions.length ?? 0} positions
                </p>
              </div>

              <div className="rounded-md border border-dark-600 bg-dark-900 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Daily P&amp;L</p>
                <p className={`mt-2 text-xl font-bold ${pnlClass(dailyStats.dailyPnL)}`}>
                  {formatMoney(dailyStats.dailyPnL)}
                </p>
                <p className={`mt-1 text-xs ${pnlClass(dailyStats.dailyPnL)}`}>
                  {formatPercent(dailyStats.dailyPnLPercent)}
                </p>
              </div>

              <div className="rounded-md border border-dark-600 bg-dark-900 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Total P&amp;L</p>
                <p
                  className={`mt-2 text-xl font-bold ${pnlClass(
                    portfolioQuery.data?.data.totalPnL ?? 0,
                  )}`}
                >
                  {formatMoney(portfolioQuery.data?.data.totalPnL ?? 0)}
                </p>
                <p
                  className={`mt-1 text-xs ${pnlClass(
                    portfolioQuery.data?.data.totalPnL ?? 0,
                  )}`}
                >
                  {formatPercent(portfolioQuery.data?.data.totalPnLPercent ?? 0)}
                </p>
              </div>
            </div>
          )}

          {!dailyStats.hasData && positions.length > 0 && (
            <p className="mt-4 text-xs text-gray-500">
              Daily P&amp;L is shown when quote previous close is available.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-neon-magenta/40 bg-dark-800/90 p-5 shadow-[0_0_22px_rgba(255,0,255,0.1)]">
          <WidgetHeader
            title="Watchlist"
            updatedAt={watchlistQuery.dataUpdatedAt}
            action={(
              <Link
                to="/watchlist"
                className="rounded border border-neon-magenta/40 px-2 py-1 text-xs text-neon-magenta hover:bg-neon-magenta/10"
              >
                View all
              </Link>
            )}
          />

          {watchlistQuery.isLoading && (
            <p className="mt-5 text-sm text-gray-500">Loading watchlist...</p>
          )}
          {watchlistQuery.error && (
            <p className="mt-5 text-sm text-red-400">
              Failed to load watchlist: {watchlistQuery.error.message}
            </p>
          )}
          {!watchlistQuery.isLoading && !watchlistQuery.error && (
            <div className="mt-4 space-y-2">
              {watchlistQuery.data?.data.length ? (
                watchlistQuery.data.data.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-md border border-dark-600 bg-dark-900 px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-gray-100">{row.symbol}</p>
                      <p className="text-xs text-gray-500">
                        {row.price != null ? formatMoney(row.price) : 'No price'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${pnlClass(row.change ?? 0)}`}>
                        {row.change != null ? formatPercent(row.change) : '-'}
                      </p>
                      <p className="text-xs text-neon-magenta">score {row.score ?? '-'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">
                  Watchlist is empty.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
