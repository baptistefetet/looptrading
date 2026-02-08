import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewsResponse, StockHistory, StockQuote } from '@shared/types';
import { api } from '../lib/api';
import { StockChart, type OverlayVisibility } from '../components/StockChart';
import type { WatchlistRow } from '../hooks/useWatchlist';

type HistoryPeriod = '1d' | '1w' | '1m' | '3m' | '1y';
type Signal = 'bullish' | 'bearish' | 'neutral';

interface QuoteResponse {
  data: StockQuote;
}

interface HistoryResponse {
  data: StockHistory;
}

interface ScoreResponse {
  data: {
    symbol: string;
    score: number;
  };
}

interface IndicatorsResponse {
  data: {
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    ema9: number | null;
    ema21: number | null;
    rsi14: number | null;
    macdLine: number | null;
    macdSignal: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
    obv: number | null;
  };
}

interface AlertsResponse {
  data: Array<{
    id: string;
    symbol: string;
    strategy: string;
    score: number | null;
    message: string;
    triggeredAt: string;
  }>;
}

interface WatchlistResponse {
  data: WatchlistRow[];
}

const TIMEFRAME_OPTIONS: Array<{ value: HistoryPeriod; label: string }> = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
];

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedMoney(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPrice(value)}`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatIndicator(value: number | null, digits = 2): string {
  if (value == null) return '-';
  return value.toFixed(digits);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function toggleClass(active: boolean): string {
  if (active) {
    return 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_12px_rgba(0,212,255,0.3)]';
  }
  return 'border-dark-600 bg-dark-800 text-gray-300 hover:border-neon-cyan/50 hover:text-neon-cyan';
}

function signalClass(signal: Signal): string {
  if (signal === 'bullish') return 'text-neon-green';
  if (signal === 'bearish') return 'text-red-400';
  return 'text-gray-300';
}

function getTrendSignal(price: number | undefined, indicator: number | null): Signal {
  if (price == null || indicator == null) return 'neutral';
  return price >= indicator ? 'bullish' : 'bearish';
}

function getRsiSignal(rsi: number | null): Signal {
  if (rsi == null) return 'neutral';
  if (rsi < 30) return 'bullish';
  if (rsi > 70) return 'bearish';
  return 'neutral';
}

function getMacdSignal(macdLine: number | null, macdSignal: number | null): Signal {
  if (macdLine == null || macdSignal == null) return 'neutral';
  if (macdLine > macdSignal) return 'bullish';
  if (macdLine < macdSignal) return 'bearish';
  return 'neutral';
}

function getBollingerSignal(
  price: number | undefined,
  upper: number | null,
  lower: number | null,
): Signal {
  if (price == null || upper == null || lower == null) return 'neutral';
  if (price < lower) return 'bullish';
  if (price > upper) return 'bearish';
  return 'neutral';
}

function getObvSignal(obv: number | null): Signal {
  if (obv == null) return 'neutral';
  if (obv > 0) return 'bullish';
  if (obv < 0) return 'bearish';
  return 'neutral';
}

function scoreFillClass(score: number): string {
  if (score >= 80) return 'bg-neon-green';
  if (score >= 60) return 'bg-neon-cyan';
  if (score >= 40) return 'bg-yellow-400';
  return 'bg-red-400';
}

export function StockDetail() {
  const queryClient = useQueryClient();
  const { symbol } = useParams<{ symbol: string }>();
  const upperSymbol = (symbol ?? '').toUpperCase();
  const [timeframe, setTimeframe] = useState<HistoryPeriod>('3m');
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    sma: true,
    ema: true,
    bollinger: true,
  });
  const [expandedNewsLinks, setExpandedNewsLinks] = useState<Record<string, boolean>>({});

  const quoteQuery = useQuery({
    queryKey: ['stocks', 'quote', upperSymbol],
    queryFn: () =>
      api.get<QuoteResponse>(
        `/stocks/${encodeURIComponent(upperSymbol)}/quote`,
      ),
    enabled: upperSymbol.length > 0,
    refetchInterval: 30_000,
  });

  const historyQuery = useQuery({
    queryKey: ['stocks', 'history', upperSymbol, timeframe],
    queryFn: () =>
      api.get<HistoryResponse>(
        `/stocks/${encodeURIComponent(upperSymbol)}/history?period=${timeframe}`,
      ),
    enabled: upperSymbol.length > 0,
    refetchInterval: 30_000,
  });

  const scoreQuery = useQuery({
    queryKey: ['stocks', 'score', upperSymbol],
    queryFn: () =>
      api.get<ScoreResponse>(
        `/stocks/${encodeURIComponent(upperSymbol)}/score`,
      ),
    enabled: upperSymbol.length > 0,
    refetchInterval: 60_000,
  });

  const indicatorsQuery = useQuery({
    queryKey: ['stocks', 'indicators', upperSymbol],
    queryFn: () =>
      api.get<IndicatorsResponse>(
        `/stocks/${encodeURIComponent(upperSymbol)}/indicators`,
      ),
    enabled: upperSymbol.length > 0,
    refetchInterval: 60_000,
  });

  const newsQuery = useQuery({
    queryKey: ['news', upperSymbol],
    queryFn: () => api.get<{ data: NewsResponse }>(`/news/${encodeURIComponent(upperSymbol)}?limit=10`),
    enabled: upperSymbol.length > 0,
    refetchInterval: 300_000,
  });

  const alertsQuery = useQuery({
    queryKey: ['alerts', 'symbol', upperSymbol],
    queryFn: () =>
      api.get<AlertsResponse>(
        `/alerts?symbol=${encodeURIComponent(upperSymbol)}&limit=100`,
      ),
    enabled: upperSymbol.length > 0,
    refetchInterval: 30_000,
  });

  const watchlistQuery = useQuery({
    queryKey: ['watchlist', 'stock-detail', upperSymbol],
    queryFn: () => api.get<WatchlistResponse>('/watchlist?limit=100'),
    enabled: upperSymbol.length > 0,
  });

  const watchlistMutation = useMutation({
    mutationFn: async ({
      id,
      inWatchlist,
    }: {
      id: string | null;
      inWatchlist: boolean;
    }) => {
      if (inWatchlist && id) {
        return api.delete(`/watchlist/${id}`);
      }
      return api.post('/watchlist', { symbol: upperSymbol });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const quote = quoteQuery.data?.data;
  const bars = historyQuery.data?.data.bars ?? [];
  const score = scoreQuery.data?.data.score ?? 0;
  const indicators = indicatorsQuery.data?.data;

  const changeClass =
    quote && quote.changePercent >= 0 ? 'text-neon-green' : 'text-red-400';

  const watchlistItem = watchlistQuery.data?.data.find(
    (item) => item.symbol === upperSymbol,
  );
  const isInWatchlist = Boolean(watchlistItem);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentAlerts = useMemo(
    () =>
      (alertsQuery.data?.data ?? []).filter(
        (alert) => new Date(alert.triggeredAt).getTime() >= thirtyDaysAgo,
      ),
    [alertsQuery.data?.data, thirtyDaysAgo],
  );

  const indicatorRows = useMemo(() => {
    return [
      {
        label: 'SMA20',
        value: formatIndicator(indicators?.sma20 ?? null),
        signal: getTrendSignal(quote?.price, indicators?.sma20 ?? null),
      },
      {
        label: 'SMA50',
        value: formatIndicator(indicators?.sma50 ?? null),
        signal: getTrendSignal(quote?.price, indicators?.sma50 ?? null),
      },
      {
        label: 'SMA200',
        value: formatIndicator(indicators?.sma200 ?? null),
        signal: getTrendSignal(quote?.price, indicators?.sma200 ?? null),
      },
      {
        label: 'EMA9',
        value: formatIndicator(indicators?.ema9 ?? null),
        signal: getTrendSignal(quote?.price, indicators?.ema9 ?? null),
      },
      {
        label: 'EMA21',
        value: formatIndicator(indicators?.ema21 ?? null),
        signal: getTrendSignal(quote?.price, indicators?.ema21 ?? null),
      },
      {
        label: 'RSI14',
        value: formatIndicator(indicators?.rsi14 ?? null),
        signal: getRsiSignal(indicators?.rsi14 ?? null),
      },
      {
        label: 'MACD',
        value:
          indicators?.macdLine != null && indicators.macdSignal != null
            ? `${indicators.macdLine.toFixed(2)} / ${indicators.macdSignal.toFixed(2)}`
            : '-',
        signal: getMacdSignal(indicators?.macdLine ?? null, indicators?.macdSignal ?? null),
      },
      {
        label: 'Bollinger',
        value:
          indicators?.bbLower != null &&
          indicators.bbMiddle != null &&
          indicators.bbUpper != null
            ? `${indicators.bbLower.toFixed(2)} / ${indicators.bbMiddle.toFixed(2)} / ${indicators.bbUpper.toFixed(2)}`
            : '-',
        signal: getBollingerSignal(
          quote?.price,
          indicators?.bbUpper ?? null,
          indicators?.bbLower ?? null,
        ),
      },
      {
        label: 'OBV',
        value: formatIndicator(indicators?.obv ?? null, 0),
        signal: getObvSignal(indicators?.obv ?? null),
      },
    ];
  }, [indicators, quote?.price]);

  const toggleNews = (link: string) => {
    setExpandedNewsLinks((previous) => ({
      ...previous,
      [link]: !previous[link],
    }));
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">{upperSymbol || 'Stock'}</h1>
          <p className="mt-1 text-sm text-gray-500">{quote?.name || 'Loading company name...'}</p>
          {quote && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <p className="text-2xl font-semibold text-gray-100">{formatPrice(quote.price)}</p>
              <div className={changeClass}>
                <p className="text-sm font-semibold">{formatSignedMoney(quote.change)}</p>
                <p className="text-xs">{formatPercent(quote.changePercent)}</p>
              </div>
              <p className="text-xs text-gray-500">
                Vol {quote.volume.toLocaleString('en-US')} · {quote.exchange || quote.marketState}
              </p>
            </div>
          )}
        </div>

        <div className="min-w-[220px] rounded-lg border border-dark-600 bg-dark-800 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Composite Score</p>
            <p className="text-sm font-semibold text-gray-100">{score.toFixed(0)}</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-dark-700">
            <div
              className={`h-full rounded-full ${scoreFillClass(score)}`}
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              watchlistMutation.mutate({
                id: watchlistItem?.id ?? null,
                inWatchlist: isInWatchlist,
              })
            }
            disabled={watchlistMutation.isPending}
            className={`mt-3 w-full rounded border px-3 py-2 text-sm transition ${
              isInWatchlist
                ? 'border-red-400/60 text-red-300 hover:bg-red-500/10'
                : 'border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/10'
            } disabled:opacity-50`}
          >
            {watchlistMutation.isPending
              ? 'Updating...'
              : isInWatchlist
                ? 'Remove from Watchlist'
                : 'Add to Watchlist'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {TIMEFRAME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTimeframe(option.value)}
            className={`rounded border px-3 py-1.5 text-xs font-semibold tracking-[0.12em] transition ${toggleClass(
              timeframe === option.value,
            )}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setOverlayVisibility((previous) => ({
              ...previous,
              sma: !previous.sma,
            }))
          }
          className={`rounded border px-3 py-1.5 text-xs font-medium transition ${toggleClass(overlayVisibility.sma)}`}
        >
          SMA (20/50/200)
        </button>
        <button
          type="button"
          onClick={() =>
            setOverlayVisibility((previous) => ({
              ...previous,
              ema: !previous.ema,
            }))
          }
          className={`rounded border px-3 py-1.5 text-xs font-medium transition ${toggleClass(overlayVisibility.ema)}`}
        >
          EMA (9/21)
        </button>
        <button
          type="button"
          onClick={() =>
            setOverlayVisibility((previous) => ({
              ...previous,
              bollinger: !previous.bollinger,
            }))
          }
          className={`rounded border px-3 py-1.5 text-xs font-medium transition ${toggleClass(
            overlayVisibility.bollinger,
          )}`}
        >
          Bollinger Bands
        </button>
      </div>

      {historyQuery.isLoading && (
        <div className="card mt-6">
          <p className="text-sm text-gray-400">Loading historical data...</p>
        </div>
      )}
      {historyQuery.error && (
        <div className="card mt-6">
          <p className="text-sm text-red-400">
            Failed to load chart data: {historyQuery.error.message}
          </p>
        </div>
      )}
      {!historyQuery.isLoading && !historyQuery.error && (
        <div className="mt-6">
          <StockChart
            symbol={upperSymbol}
            bars={bars}
            overlayVisibility={overlayVisibility}
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-dark-600 bg-dark-800/90 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neon-cyan">
            Indicateurs Techniques
          </h2>
          {indicatorsQuery.isLoading && (
            <p className="mt-4 text-sm text-gray-500">Loading indicators...</p>
          )}
          {indicatorsQuery.error && (
            <p className="mt-4 text-sm text-red-400">
              Failed to load indicators: {indicatorsQuery.error.message}
            </p>
          )}
          {!indicatorsQuery.isLoading && !indicatorsQuery.error && (
            <div className="mt-4 overflow-x-auto rounded border border-dark-600">
              <table className="min-w-full divide-y divide-dark-600 text-sm">
                <thead className="bg-dark-900/70 text-xs uppercase tracking-[0.08em] text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Indicator</th>
                    <th className="px-3 py-2 text-left">Value</th>
                    <th className="px-3 py-2 text-left">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {indicatorRows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-3 py-2 text-gray-200">{row.label}</td>
                      <td className="px-3 py-2 text-gray-300">{row.value}</td>
                      <td className={`px-3 py-2 font-medium uppercase ${signalClass(row.signal)}`}>
                        {row.signal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-dark-600 bg-dark-800/90 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neon-magenta">
            Yahoo News
          </h2>
          {newsQuery.isLoading && (
            <p className="mt-4 text-sm text-gray-500">Loading news...</p>
          )}
          {newsQuery.error && (
            <p className="mt-4 text-sm text-red-400">
              Failed to load news: {newsQuery.error.message}
            </p>
          )}
          {!newsQuery.isLoading && !newsQuery.error && (
            <div className="mt-4 space-y-2">
              {(newsQuery.data?.data.news ?? []).length === 0 && (
                <p className="text-sm text-gray-500">No recent news for this symbol.</p>
              )}
              {(newsQuery.data?.data.news ?? []).map((item) => {
                const expanded = expandedNewsLinks[item.link] ?? false;
                return (
                  <div
                    key={item.link}
                    className="rounded border border-dark-600 bg-dark-900/60 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleNews(item.link)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-medium text-gray-100">{item.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.publisher} · {formatTimestamp(item.publishedAt)}
                      </p>
                    </button>
                    {expanded && (
                      <div className="mt-2 border-t border-dark-700 pt-2 text-xs text-gray-400">
                        <p>
                          {item.summary?.trim().length
                            ? item.summary
                            : 'No summary provided by source.'}
                        </p>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-neon-cyan hover:underline"
                        >
                          Open original article
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-dark-600 bg-dark-800/90 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neon-green">
          Historique Alertes (30 days)
        </h2>
        {alertsQuery.isLoading && (
          <p className="mt-4 text-sm text-gray-500">Loading alerts...</p>
        )}
        {alertsQuery.error && (
          <p className="mt-4 text-sm text-red-400">
            Failed to load alerts: {alertsQuery.error.message}
          </p>
        )}
        {!alertsQuery.isLoading && !alertsQuery.error && (
          <div className="mt-4 space-y-2">
            {recentAlerts.length === 0 && (
              <p className="text-sm text-gray-500">No alerts in the last 30 days.</p>
            )}
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded border border-dark-600 bg-dark-900/70 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-100">{alert.strategy}</p>
                    <p className="text-xs text-gray-500">{alert.message}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neon-green">score {alert.score ?? '-'}</p>
                    <p className="text-xs text-gray-500">{formatTimestamp(alert.triggeredAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
