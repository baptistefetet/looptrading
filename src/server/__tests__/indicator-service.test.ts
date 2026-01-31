import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  calculateSMA,
  calculateEMA,
  calculateEMASeries,
} from '../services/IndicatorService.js';

// ============================================
// Reference data: 30 daily close prices
// (synthetic, but realistic AAPL-like values)
// ============================================
const PRICES = [
  150.0, 151.5, 149.8, 152.3, 153.1, 151.0, 154.2, 155.0, 153.5, 156.0, // 1-10
  157.2, 155.8, 158.0, 159.5, 157.0, 160.2, 161.5, 159.0, 162.3, 163.0, // 11-20
  161.5, 164.0, 165.2, 163.5, 166.0, 167.5, 165.0, 168.2, 169.0, 170.5, // 21-30
];

// ============================================
// SMA Tests
// ============================================

describe('calculateSMA', () => {
  it('should return null when insufficient data', () => {
    expect(calculateSMA([1, 2, 3], 5)).toBeNull();
    expect(calculateSMA([], 1)).toBeNull();
  });

  it('should calculate SMA correctly for exact period length', () => {
    // SMA(5) of [1,2,3,4,5] = 15/5 = 3
    expect(calculateSMA([1, 2, 3, 4, 5], 5)).toBe(3);
  });

  it('should use only the last N prices', () => {
    // SMA(3) of [1,2,3,4,5] = (3+4+5)/3 = 4
    expect(calculateSMA([1, 2, 3, 4, 5], 3)).toBe(4);
  });

  it('should calculate SMA(20) with reference data', () => {
    // SMA(20) uses last 20 prices (indices 10-29)
    const last20 = PRICES.slice(10);
    const expectedSma20 = last20.reduce((a, b) => a + b, 0) / 20;
    expect(calculateSMA(PRICES, 20)).toBeCloseTo(expectedSma20, 6);
  });

  it('should calculate SMA(20) with first 20 prices', () => {
    const first20 = PRICES.slice(0, 20);
    const expected = first20.reduce((a, b) => a + b, 0) / 20;
    expect(calculateSMA(first20, 20)).toBeCloseTo(expected, 6);
    // Manual: (150.0+151.5+149.8+152.3+153.1+151.0+154.2+155.0+153.5+156.0
    //          +157.2+155.8+158.0+159.5+157.0+160.2+161.5+159.0+162.3+163.0) / 20
    // = 3119.9 / 20 = 155.995
    expect(calculateSMA(first20, 20)).toBeCloseTo(155.995, 2);
  });

  it('should return null for SMA(50) with only 30 data points', () => {
    expect(calculateSMA(PRICES, 50)).toBeNull();
  });

  it('should return null for SMA(200) with only 30 data points', () => {
    expect(calculateSMA(PRICES, 200)).toBeNull();
  });

  it('should handle period of 1', () => {
    expect(calculateSMA([42], 1)).toBe(42);
    expect(calculateSMA([10, 20, 30], 1)).toBe(30);
  });
});

// ============================================
// EMA Tests
// ============================================

describe('calculateEMA', () => {
  it('should return null when insufficient data', () => {
    expect(calculateEMA([1, 2, 3], 5)).toBeNull();
    expect(calculateEMA([], 1)).toBeNull();
  });

  it('should equal the price for period 1 (k=1)', () => {
    // k = 2/(1+1) = 1, so EMA = last price
    expect(calculateEMA([10, 20, 30], 1)).toBeCloseTo(30, 6);
  });

  it('should equal SMA when data length equals period', () => {
    // With exactly `period` data points, EMA seed = SMA = the only value
    const data = [10, 20, 30, 40, 50];
    const sma = calculateSMA(data, 5);
    const ema = calculateEMA(data, 5);
    expect(ema).toBeCloseTo(sma!, 6);
  });

  it('should calculate EMA(9) correctly with reference data', () => {
    // Manual step-by-step verification
    const period = 9;
    const k = 2 / (period + 1); // 0.2

    // Seed: SMA of first 9 prices
    const seed = PRICES.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
    // seed = (150.0+151.5+149.8+152.3+153.1+151.0+154.2+155.0+153.5) / 9
    // = 1370.4 / 9 = 152.2666...

    let ema = seed;
    for (let i = 9; i < PRICES.length; i++) {
      ema = PRICES[i] * k + ema * (1 - k);
    }

    expect(calculateEMA(PRICES, 9)).toBeCloseTo(ema, 6);
  });

  it('should calculate EMA(21) correctly with reference data', () => {
    const period = 21;
    const k = 2 / (period + 1); // 2/22 ≈ 0.0909

    const seed = PRICES.slice(0, 21).reduce((a, b) => a + b, 0) / 21;
    let ema = seed;
    for (let i = 21; i < PRICES.length; i++) {
      ema = PRICES[i] * k + ema * (1 - k);
    }

    expect(calculateEMA(PRICES, 21)).toBeCloseTo(ema, 6);
  });

  it('should give more weight to recent prices than SMA', () => {
    // With an uptrend, EMA should be above SMA
    const uptrend = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
    const sma5 = calculateSMA(uptrend, 5)!;
    const ema5 = calculateEMA(uptrend, 5)!;
    expect(ema5).toBeGreaterThan(sma5);
  });
});

// ============================================
// EMA Series Tests
// ============================================

describe('calculateEMASeries', () => {
  it('should return empty array when insufficient data', () => {
    expect(calculateEMASeries([1, 2], 5)).toEqual([]);
  });

  it('should return series starting at index period-1', () => {
    const series = calculateEMASeries(PRICES, 9);
    expect(series.length).toBe(PRICES.length - 9 + 1); // 22 values
    expect(series[0].index).toBe(8); // 0-indexed, period-1
  });

  it('should have first value equal to SMA seed', () => {
    const period = 9;
    const series = calculateEMASeries(PRICES, period);
    const seed = PRICES.slice(0, period).reduce((a, b) => a + b, 0) / period;
    expect(series[0].value).toBeCloseTo(seed, 6);
  });

  it('should have last value equal to calculateEMA result', () => {
    const period = 9;
    const series = calculateEMASeries(PRICES, period);
    const ema = calculateEMA(PRICES, period)!;
    expect(series[series.length - 1].value).toBeCloseTo(ema, 6);
  });
});
