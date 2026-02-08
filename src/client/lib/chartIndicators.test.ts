import { describe, expect, it } from 'vitest';
import type { OHLCVBar } from '@shared/types';
import { buildChartSeries } from './chartIndicators';

function generateBars(count: number, startDate: string): OHLCVBar[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const close = 100 + index;

    return {
      date: date.toISOString().slice(0, 10),
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000 + index * 10,
    };
  });
}

describe('buildChartSeries', () => {
  it('builds expected indicator series for sufficient data', () => {
    const bars = generateBars(70, '2026-01-01');
    const result = buildChartSeries(bars);

    expect(result.candlesticks).toHaveLength(70);
    expect(result.sma20[0].time).toBe(bars[19].date);
    expect(result.sma20[0].value).toBeCloseTo(109.5, 6);
    expect(result.ema9[0].time).toBe(bars[8].date);
    expect(result.ema9[0].value).toBeCloseTo(104, 6);
    expect(result.bbUpper.length).toBeGreaterThan(0);
    expect(result.bbMiddle.length).toBe(result.bbUpper.length);
    expect(result.bbLower.length).toBe(result.bbUpper.length);
    expect(result.rsi14.at(-1)?.value).toBeCloseTo(100, 6);
    expect(result.macdLine.length).toBeGreaterThan(0);
    expect(result.macdSignal.length).toBeGreaterThan(0);
    expect(result.macdHist.length).toBeGreaterThan(0);
    expect(result.volume).toHaveLength(70);
    expect(result.volume[0].color).toBe('rgba(0,212,255,0.6)');
  });

  it('returns sparse overlays when history is too short', () => {
    const bars = generateBars(10, '2026-01-01');
    const result = buildChartSeries(bars);

    expect(result.candlesticks).toHaveLength(10);
    expect(result.sma20).toHaveLength(0);
    expect(result.sma50).toHaveLength(0);
    expect(result.sma200).toHaveLength(0);
    expect(result.ema21).toHaveLength(0);
    expect(result.bbUpper).toHaveLength(0);
    expect(result.bbMiddle).toHaveLength(0);
    expect(result.bbLower).toHaveLength(0);
    expect(result.rsi14).toHaveLength(0);
    expect(result.macdLine).toHaveLength(0);
    expect(result.macdSignal).toHaveLength(0);
    expect(result.macdHist).toHaveLength(0);
    expect(result.volume).toHaveLength(10);
  });
});
