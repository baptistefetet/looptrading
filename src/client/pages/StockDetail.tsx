import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { StockHistory, StockQuote } from '@shared/types';
import { api } from '../lib/api';
import { StockChart, type OverlayVisibility } from '../components/StockChart';

type HistoryPeriod = '1d' | '1w' | '1m' | '3m' | '1y';

interface QuoteResponse {
  data: StockQuote;
}

interface HistoryResponse {
  data: StockHistory;
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

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function toggleClass(active: boolean): string {
  if (active) {
    return 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_12px_rgba(0,212,255,0.3)]';
  }
  return 'border-dark-600 bg-dark-800 text-gray-300 hover:border-neon-cyan/50 hover:text-neon-cyan';
}

export function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const upperSymbol = (symbol ?? '').toUpperCase();
  const [timeframe, setTimeframe] = useState<HistoryPeriod>('3m');
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    sma: true,
    ema: true,
    bollinger: true,
  });

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

  const quote = quoteQuery.data?.data;
  const bars = historyQuery.data?.data.bars ?? [];
  const changeClass =
    quote && quote.changePercent >= 0 ? 'text-neon-green' : 'text-red-400';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">{upperSymbol || 'Stock'}</h1>
          {quote && (
            <p className="mt-2 text-sm text-gray-300">
              <span className="font-semibold text-gray-100">{formatPrice(quote.price)}</span>
              <span className={`ml-3 font-medium ${changeClass}`}>
                {formatPercent(quote.changePercent)}
              </span>
              <span className="ml-3 text-xs text-gray-500">
                Vol {quote.volume.toLocaleString('en-US')} · {quote.exchange || quote.marketState}
              </span>
            </p>
          )}
          <p className="mt-2 text-sm text-gray-500">
            Interactive candlestick chart with technical overlays and synchronized panels.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
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
    </div>
  );
}
