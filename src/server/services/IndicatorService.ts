import { prisma } from '../lib/prisma.js';

// ============================================
// Types
// ============================================

export interface TrendIndicators {
  symbol: string;
  date: string;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema9: number | null;
  ema21: number | null;
  calculatedAt: string;
}

// ============================================
// Pure calculation functions
// ============================================

/**
 * Calculate Simple Moving Average.
 * SMA = Σ(prices over n periods) / n
 * Returns null if insufficient data.
 */
export function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(prices.length - period);
  const sum = slice.reduce((acc, p) => acc + p, 0);
  return sum / period;
}

/**
 * Calculate Exponential Moving Average for the full series.
 * EMA = (Price × k) + (EMA_prev × (1 - k))
 * where k = 2 / (period + 1)
 * Uses SMA of the first `period` values as the seed.
 * Returns the final EMA value, or null if insufficient data.
 */
export function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;

  const k = 2 / (period + 1);

  // Seed with SMA of first `period` prices
  let ema = prices.slice(0, period).reduce((acc, p) => acc + p, 0) / period;

  // Apply EMA formula from period onward
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

/**
 * Calculate full EMA series (one value per input price after the seed period).
 * Returns an array of { index, value } for each computed EMA.
 */
export function calculateEMASeries(
  prices: number[],
  period: number
): Array<{ index: number; value: number }> {
  if (prices.length < period) return [];

  const k = 2 / (period + 1);
  const results: Array<{ index: number; value: number }> = [];

  // Seed with SMA of first `period` prices
  let ema = prices.slice(0, period).reduce((acc, p) => acc + p, 0) / period;
  results.push({ index: period - 1, value: ema });

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    results.push({ index: i, value: ema });
  }

  return results;
}

// ============================================
// IndicatorService
// ============================================

export class IndicatorService {
  /**
   * Compute trend indicators for a symbol using historical data from the database.
   * Updates StockData rows with calculated SMA and EMA values.
   * Returns the latest indicators.
   */
  async computeIndicators(symbol: string): Promise<TrendIndicators | null> {
    const upperSymbol = symbol.toUpperCase();

    // Fetch historical data ordered by date ascending
    const stockData = await prisma.stockData.findMany({
      where: { symbol: upperSymbol },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, close: true },
    });

    if (stockData.length === 0) return null;

    const closes = stockData.map((d) => d.close);

    // Calculate latest values for each indicator
    const latestSma20 = calculateSMA(closes, 20);
    const latestSma50 = calculateSMA(closes, 50);
    const latestSma200 = calculateSMA(closes, 200);
    const latestEma9 = calculateEMA(closes, 9);
    const latestEma21 = calculateEMA(closes, 21);

    // Batch update: compute indicators for each row and persist
    // We process in bulk using individual SMA windows and EMA series
    const ema9Series = calculateEMASeries(closes, 9);
    const ema21Series = calculateEMASeries(closes, 21);

    // Build a map of index -> EMA values for quick lookup
    const ema9Map = new Map(ema9Series.map((e) => [e.index, e.value]));
    const ema21Map = new Map(ema21Series.map((e) => [e.index, e.value]));

    // Update rows in a transaction
    await prisma.$transaction(
      stockData.map((row, i) => {
        const sma20 = i >= 19 ? calculateSMA(closes.slice(0, i + 1), 20) : null;
        const sma50 = i >= 49 ? calculateSMA(closes.slice(0, i + 1), 50) : null;
        const sma200 = i >= 199 ? calculateSMA(closes.slice(0, i + 1), 200) : null;
        const ema9 = ema9Map.get(i) ?? null;
        const ema21 = ema21Map.get(i) ?? null;

        return prisma.stockData.update({
          where: { id: row.id },
          data: { sma20, sma50, sma200, ema9, ema21 },
        });
      })
    );

    const lastRow = stockData[stockData.length - 1];

    return {
      symbol: upperSymbol,
      date: lastRow.date.toISOString().split('T')[0],
      sma20: latestSma20,
      sma50: latestSma50,
      sma200: latestSma200,
      ema9: latestEma9,
      ema21: latestEma21,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get the latest indicators for a symbol from the database.
   * Does NOT recompute - returns what's stored.
   */
  async getIndicators(symbol: string): Promise<TrendIndicators | null> {
    const upperSymbol = symbol.toUpperCase();

    const latest = await prisma.stockData.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { date: 'desc' },
    });

    if (!latest) return null;

    return {
      symbol: upperSymbol,
      date: latest.date.toISOString().split('T')[0],
      sma20: latest.sma20,
      sma50: latest.sma50,
      sma200: latest.sma200,
      ema9: latest.ema9,
      ema21: latest.ema21,
      calculatedAt: latest.updatedAt.toISOString(),
    };
  }
}

export const indicatorService = new IndicatorService();
