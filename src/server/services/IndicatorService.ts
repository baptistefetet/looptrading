import { prisma } from '../lib/prisma.js';

// ============================================
// Types
// ============================================

export interface StockIndicators {
  symbol: string;
  date: string;
  // Trend
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema9: number | null;
  ema21: number | null;
  // Momentum
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  // Volatility
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  // Volume
  obv: number | null;
  avgVol20: number | null;
  volumeRatio: number | null;
  calculatedAt: string;
}

/** @deprecated Use StockIndicators instead */
export type TrendIndicators = StockIndicators;

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
// Momentum & Volatility calculation functions
// ============================================

/**
 * Calculate Relative Strength Index.
 * RSI = 100 - (100 / (1 + RS))
 * where RS = avg gain / avg loss over `period` periods.
 * Uses Wilder's smoothing (exponential) after the initial window.
 * Returns null if insufficient data (need at least period + 1 prices).
 */
export function calculateRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;

  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Initial average gain/loss from first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining changes
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate MACD (Moving Average Convergence Divergence).
 * MACD Line = EMA(fast) - EMA(slow)
 * Signal Line = EMA(signal) of MACD Line
 * Histogram = MACD Line - Signal Line
 * Returns null if insufficient data.
 */
export function calculateMACD(
  prices: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macdLine: number; signalLine: number; histogram: number } | null {
  if (prices.length < slow + signal - 1) return null;

  // Compute full EMA series for fast and slow
  const fastSeries = calculateEMASeries(prices, fast);
  const slowSeries = calculateEMASeries(prices, slow);

  if (slowSeries.length === 0) return null;

  // MACD line: fast EMA - slow EMA, aligned by index
  const fastMap = new Map(fastSeries.map((e) => [e.index, e.value]));
  const macdValues: number[] = [];
  for (const s of slowSeries) {
    const f = fastMap.get(s.index);
    if (f !== undefined) {
      macdValues.push(f - s.value);
    }
  }

  if (macdValues.length < signal) return null;

  // Signal line = EMA of MACD values
  const signalEma = calculateEMA(macdValues, signal);
  if (signalEma === null) return null;

  const lastMacd = macdValues[macdValues.length - 1];
  return {
    macdLine: lastMacd,
    signalLine: signalEma,
    histogram: lastMacd - signalEma,
  };
}

/**
 * Calculate Bollinger Bands.
 * Middle = SMA(period)
 * Upper = SMA + stdDev × σ
 * Lower = SMA - stdDev × σ
 * Returns null if insufficient data.
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number; middle: number; lower: number } | null {
  if (prices.length < period) return null;

  const slice = prices.slice(prices.length - period);
  const middle = slice.reduce((acc, p) => acc + p, 0) / period;

  // Standard deviation
  const squaredDiffs = slice.map((p) => (p - middle) ** 2);
  const variance = squaredDiffs.reduce((acc, d) => acc + d, 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: middle + stdDevMultiplier * stdDev,
    middle,
    lower: middle - stdDevMultiplier * stdDev,
  };
}

/**
 * Calculate On-Balance Volume.
 * OBV = cumulative sum of volume, added when price goes up, subtracted when down.
 * Returns the final OBV value, or null if insufficient data.
 */
export function calculateOBV(prices: number[], volumes: number[]): number | null {
  if (prices.length < 2 || prices.length !== volumes.length) return null;

  let obv = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      obv += volumes[i];
    } else if (prices[i] < prices[i - 1]) {
      obv -= volumes[i];
    }
    // If prices are equal, OBV stays the same
  }

  return obv;
}

/**
 * Calculate full OBV series (one value per data point).
 */
export function calculateOBVSeries(prices: number[], volumes: number[]): number[] {
  if (prices.length < 2 || prices.length !== volumes.length) return [];

  const series: number[] = [0]; // First day OBV = 0
  let obv = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      obv += volumes[i];
    } else if (prices[i] < prices[i - 1]) {
      obv -= volumes[i];
    }
    series.push(obv);
  }
  return series;
}

/**
 * Calculate average volume over the last `period` days and the ratio of current volume to average.
 * Returns null if insufficient data.
 */
export function calculateAverageVolume(
  volumes: number[],
  period: number = 20
): { avgVolume: number; volumeRatio: number } | null {
  if (volumes.length < period) return null;

  const slice = volumes.slice(volumes.length - period);
  const avg = slice.reduce((acc, v) => acc + v, 0) / period;
  const current = volumes[volumes.length - 1];

  return {
    avgVolume: avg,
    volumeRatio: avg > 0 ? current / avg : 0,
  };
}

// ============================================
// IndicatorService
// ============================================

export class IndicatorService {
  /**
   * Compute all indicators for a symbol using historical data from the database.
   * Updates StockData rows with calculated values and returns the latest indicators.
   */
  async computeIndicators(symbol: string): Promise<StockIndicators | null> {
    const upperSymbol = symbol.toUpperCase();

    // Fetch historical data ordered by date ascending
    const stockData = await prisma.stockData.findMany({
      where: { symbol: upperSymbol },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, close: true, volume: true },
    });

    if (stockData.length === 0) return null;

    const closes = stockData.map((d) => d.close);
    const volumes = stockData.map((d) => d.volume);

    // --- Latest values for all indicators ---
    const latestSma20 = calculateSMA(closes, 20);
    const latestSma50 = calculateSMA(closes, 50);
    const latestSma200 = calculateSMA(closes, 200);
    const latestEma9 = calculateEMA(closes, 9);
    const latestEma21 = calculateEMA(closes, 21);
    const latestRsi = calculateRSI(closes, 14);
    const latestMacd = calculateMACD(closes, 12, 26, 9);
    const latestBB = calculateBollingerBands(closes, 20, 2);
    const latestObv = calculateOBV(closes, volumes);
    const latestAvgVol = calculateAverageVolume(volumes, 20);

    // --- Series for per-row persistence ---
    const ema9Series = calculateEMASeries(closes, 9);
    const ema21Series = calculateEMASeries(closes, 21);
    const obvSeries = calculateOBVSeries(closes, volumes);

    const ema9Map = new Map(ema9Series.map((e) => [e.index, e.value]));
    const ema21Map = new Map(ema21Series.map((e) => [e.index, e.value]));

    // Update rows in a transaction
    await prisma.$transaction(
      stockData.map((row, i) => {
        const slice = closes.slice(0, i + 1);
        const volSlice = volumes.slice(0, i + 1);

        const sma20 = i >= 19 ? calculateSMA(slice, 20) : null;
        const sma50 = i >= 49 ? calculateSMA(slice, 50) : null;
        const sma200 = i >= 199 ? calculateSMA(slice, 200) : null;
        const ema9 = ema9Map.get(i) ?? null;
        const ema21 = ema21Map.get(i) ?? null;
        const rsi14 = i >= 14 ? calculateRSI(slice, 14) : null;
        const macdResult = calculateMACD(slice, 12, 26, 9);
        const bbResult = i >= 19 ? calculateBollingerBands(slice, 20, 2) : null;
        const obv = obvSeries[i] ?? null;
        const avgVolResult = i >= 19 ? calculateAverageVolume(volSlice, 20) : null;

        return prisma.stockData.update({
          where: { id: row.id },
          data: {
            sma20, sma50, sma200, ema9, ema21,
            rsi14,
            macdLine: macdResult?.macdLine ?? null,
            macdSignal: macdResult?.signalLine ?? null,
            macdHist: macdResult?.histogram ?? null,
            bbUpper: bbResult?.upper ?? null,
            bbMiddle: bbResult?.middle ?? null,
            bbLower: bbResult?.lower ?? null,
            obv,
            avgVol20: avgVolResult?.avgVolume ?? null,
          },
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
      rsi14: latestRsi,
      macdLine: latestMacd?.macdLine ?? null,
      macdSignal: latestMacd?.signalLine ?? null,
      macdHist: latestMacd?.histogram ?? null,
      bbUpper: latestBB?.upper ?? null,
      bbMiddle: latestBB?.middle ?? null,
      bbLower: latestBB?.lower ?? null,
      obv: latestObv,
      avgVol20: latestAvgVol?.avgVolume ?? null,
      volumeRatio: latestAvgVol?.volumeRatio ?? null,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get the latest indicators for a symbol from the database.
   * Does NOT recompute - returns what's stored.
   */
  async getIndicators(symbol: string): Promise<StockIndicators | null> {
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
      rsi14: latest.rsi14,
      macdLine: latest.macdLine,
      macdSignal: latest.macdSignal,
      macdHist: latest.macdHist,
      bbUpper: latest.bbUpper,
      bbMiddle: latest.bbMiddle,
      bbLower: latest.bbLower,
      obv: latest.obv,
      avgVol20: latest.avgVol20,
      volumeRatio: null, // volumeRatio is computed on-the-fly, not stored
      calculatedAt: latest.updatedAt.toISOString(),
    };
  }
}

export const indicatorService = new IndicatorService();
