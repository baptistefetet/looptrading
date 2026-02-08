import type { OHLCVBar } from '@shared/types';

export interface CandlestickPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LinePoint {
  time: string;
  value: number;
}

export interface HistogramPoint extends LinePoint {
  color?: string;
}

export interface ChartSeriesBundle {
  candlesticks: CandlestickPoint[];
  sma20: LinePoint[];
  sma50: LinePoint[];
  sma200: LinePoint[];
  ema9: LinePoint[];
  ema21: LinePoint[];
  bbUpper: LinePoint[];
  bbMiddle: LinePoint[];
  bbLower: LinePoint[];
  rsi14: LinePoint[];
  macdLine: LinePoint[];
  macdSignal: LinePoint[];
  macdHist: HistogramPoint[];
  volume: HistogramPoint[];
}

type NullableSeries = Array<number | null>;

function toPoints(times: string[], values: NullableSeries): LinePoint[] {
  const points: LinePoint[] = [];

  for (let i = 0; i < times.length; i += 1) {
    const value = values[i];
    if (value == null || !Number.isFinite(value)) continue;
    points.push({ time: times[i], value });
  }

  return points;
}

function calculateSmaSeries(prices: number[], period: number): NullableSeries {
  const series: NullableSeries = Array(prices.length).fill(null);
  if (prices.length < period) return series;

  let rollingSum = 0;
  for (let i = 0; i < prices.length; i += 1) {
    rollingSum += prices[i];
    if (i >= period) {
      rollingSum -= prices[i - period];
    }
    if (i >= period - 1) {
      series[i] = rollingSum / period;
    }
  }

  return series;
}

function calculateEmaSeries(prices: number[], period: number): NullableSeries {
  const series: NullableSeries = Array(prices.length).fill(null);
  if (prices.length < period) return series;

  const multiplier = 2 / (period + 1);
  const seed =
    prices.slice(0, period).reduce((acc, current) => acc + current, 0) / period;

  let ema = seed;
  series[period - 1] = seed;

  for (let i = period; i < prices.length; i += 1) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
    series[i] = ema;
  }

  return series;
}

function calculateBollingerSeries(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: NullableSeries; middle: NullableSeries; lower: NullableSeries } {
  const upper: NullableSeries = Array(prices.length).fill(null);
  const middle: NullableSeries = Array(prices.length).fill(null);
  const lower: NullableSeries = Array(prices.length).fill(null);

  if (prices.length < period) {
    return { upper, middle, lower };
  }

  for (let i = period - 1; i < prices.length; i += 1) {
    const window = prices.slice(i - period + 1, i + 1);
    const mean = window.reduce((acc, current) => acc + current, 0) / period;
    const variance =
      window.reduce((acc, current) => acc + (current - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);

    middle[i] = mean;
    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}

function calculateRsiSeries(prices: number[], period: number = 14): NullableSeries {
  const series: NullableSeries = Array(prices.length).fill(null);
  if (prices.length < period + 1) return series;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  series[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i += 1) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    series[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return series;
}

function calculateMacdSeries(
  prices: number[],
  fast: number = 12,
  slow: number = 26,
  signalPeriod: number = 9
): { macd: NullableSeries; signal: NullableSeries; histogram: NullableSeries } {
  const macd: NullableSeries = Array(prices.length).fill(null);
  const signal: NullableSeries = Array(prices.length).fill(null);
  const histogram: NullableSeries = Array(prices.length).fill(null);

  if (prices.length < slow) {
    return { macd, signal, histogram };
  }

  const emaFast = calculateEmaSeries(prices, fast);
  const emaSlow = calculateEmaSeries(prices, slow);

  for (let i = 0; i < prices.length; i += 1) {
    const fastValue = emaFast[i];
    const slowValue = emaSlow[i];
    if (fastValue == null || slowValue == null) continue;
    macd[i] = fastValue - slowValue;
  }

  const multiplier = 2 / (signalPeriod + 1);
  let seedSum = 0;
  let seedCount = 0;
  let signalEma: number | null = null;

  for (let i = 0; i < macd.length; i += 1) {
    const value = macd[i];
    if (value == null) continue;

    if (signalEma == null) {
      seedSum += value;
      seedCount += 1;
      if (seedCount === signalPeriod) {
        signalEma = seedSum / signalPeriod;
        signal[i] = signalEma;
      }
      continue;
    }

    signalEma = value * multiplier + signalEma * (1 - multiplier);
    signal[i] = signalEma;
  }

  for (let i = 0; i < macd.length; i += 1) {
    if (macd[i] == null || signal[i] == null) continue;
    histogram[i] = macd[i] - signal[i];
  }

  return { macd, signal, histogram };
}

export function buildChartSeries(rawBars: OHLCVBar[]): ChartSeriesBundle {
  const bars = [...rawBars].sort((a, b) => a.date.localeCompare(b.date));
  const times = bars.map((bar) => bar.date);
  const closes = bars.map((bar) => bar.close);

  const sma20Series = calculateSmaSeries(closes, 20);
  const sma50Series = calculateSmaSeries(closes, 50);
  const sma200Series = calculateSmaSeries(closes, 200);
  const ema9Series = calculateEmaSeries(closes, 9);
  const ema21Series = calculateEmaSeries(closes, 21);
  const bollinger = calculateBollingerSeries(closes, 20, 2);
  const rsi14Series = calculateRsiSeries(closes, 14);
  const macdSeries = calculateMacdSeries(closes, 12, 26, 9);

  return {
    candlesticks: bars.map((bar) => ({
      time: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    })),
    sma20: toPoints(times, sma20Series),
    sma50: toPoints(times, sma50Series),
    sma200: toPoints(times, sma200Series),
    ema9: toPoints(times, ema9Series),
    ema21: toPoints(times, ema21Series),
    bbUpper: toPoints(times, bollinger.upper),
    bbMiddle: toPoints(times, bollinger.middle),
    bbLower: toPoints(times, bollinger.lower),
    rsi14: toPoints(times, rsi14Series),
    macdLine: toPoints(times, macdSeries.macd),
    macdSignal: toPoints(times, macdSeries.signal),
    macdHist: times.flatMap((time, index) => {
      const value = macdSeries.histogram[index];
      if (value == null || !Number.isFinite(value)) return [];
      return [
        {
          time,
          value,
          color: value >= 0 ? 'rgba(0,255,65,0.7)' : 'rgba(255,77,79,0.7)',
        },
      ];
    }),
    volume: bars.map((bar, index) => {
      const previousClose = index > 0 ? bars[index - 1].close : bar.close;
      const isUp = bar.close >= previousClose;

      return {
        time: bar.date,
        value: bar.volume,
        color:
          index === 0
            ? 'rgba(0,212,255,0.6)'
            : isUp
              ? 'rgba(0,255,65,0.65)'
              : 'rgba(255,77,79,0.65)',
      };
    }),
  };
}
