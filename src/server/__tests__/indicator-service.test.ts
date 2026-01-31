import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  calculateSMA,
  calculateEMA,
  calculateEMASeries,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateOBV,
  calculateOBVSeries,
  calculateAverageVolume,
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

// Corresponding volumes for the 30 prices
const VOLUMES = [
  50_000_000, 52_000_000, 48_000_000, 55_000_000, 53_000_000,
  47_000_000, 56_000_000, 54_000_000, 49_000_000, 58_000_000,
  57_000_000, 46_000_000, 59_000_000, 60_000_000, 45_000_000,
  61_000_000, 62_000_000, 44_000_000, 63_000_000, 64_000_000,
  43_000_000, 65_000_000, 66_000_000, 42_000_000, 67_000_000,
  68_000_000, 41_000_000, 69_000_000, 70_000_000, 71_000_000,
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

// ============================================
// RSI Tests
// ============================================

describe('calculateRSI', () => {
  it('should return null when insufficient data', () => {
    expect(calculateRSI([1, 2, 3], 14)).toBeNull();
    // Need period + 1 prices minimum (15 for period=14)
    expect(calculateRSI(Array(14).fill(100), 14)).toBeNull();
  });

  it('should return 100 when all prices go up (no losses)', () => {
    // Strictly increasing prices → avgLoss = 0 → RSI = 100
    const rising = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(calculateRSI(rising, 14)).toBe(100);
  });

  it('should return close to 0 when all prices go down', () => {
    // Strictly decreasing prices → avgGain = 0 → RSI ≈ 0
    const falling = Array.from({ length: 20 }, (_, i) => 100 - i);
    const rsi = calculateRSI(falling, 14)!;
    expect(rsi).toBeCloseTo(0, 1);
  });

  it('should return ~50 for alternating equal gains and losses', () => {
    // Alternating +1, -1 pattern → gains ≈ losses → RSI ≈ 50
    const prices = [100];
    for (let i = 1; i < 30; i++) {
      prices.push(prices[i - 1] + (i % 2 === 0 ? -1 : 1));
    }
    const rsi = calculateRSI(prices, 14)!;
    expect(rsi).toBeGreaterThan(40);
    expect(rsi).toBeLessThan(60);
  });

  it('should be between 0 and 100 for reference data', () => {
    const rsi = calculateRSI(PRICES, 14)!;
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it('should calculate RSI(14) manually with Wilder smoothing', () => {
    const period = 14;
    const changes: number[] = [];
    for (let i = 1; i < PRICES.length; i++) {
      changes.push(PRICES[i] - PRICES[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    for (let i = period; i < changes.length; i++) {
      const c = changes[i];
      avgGain = (avgGain * (period - 1) + (c > 0 ? c : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (c < 0 ? Math.abs(c) : 0)) / period;
    }

    const expectedRsi = 100 - 100 / (1 + avgGain / avgLoss);
    expect(calculateRSI(PRICES, 14)).toBeCloseTo(expectedRsi, 6);
  });
});

// ============================================
// MACD Tests
// ============================================

describe('calculateMACD', () => {
  it('should return null when insufficient data', () => {
    // Needs at least slow + signal - 1 = 26 + 9 - 1 = 34 prices
    expect(calculateMACD(PRICES, 12, 26, 9)).toBeNull(); // 30 < 34
  });

  it('should calculate MACD with sufficient data', () => {
    // 50 prices — enough for MACD(12,26,9)
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const result = calculateMACD(prices, 12, 26, 9);
    expect(result).not.toBeNull();
    expect(result!.macdLine).toBeTypeOf('number');
    expect(result!.signalLine).toBeTypeOf('number');
    expect(result!.histogram).toBeTypeOf('number');
  });

  it('should have histogram = macdLine - signalLine', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const result = calculateMACD(prices, 12, 26, 9)!;
    expect(result.histogram).toBeCloseTo(result.macdLine - result.signalLine, 10);
  });

  it('should have positive MACD line in strong uptrend', () => {
    // Strong uptrend: fast EMA > slow EMA → MACD > 0
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const result = calculateMACD(prices, 12, 26, 9)!;
    expect(result.macdLine).toBeGreaterThan(0);
  });

  it('should have negative MACD line in strong downtrend', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
    const result = calculateMACD(prices, 12, 26, 9)!;
    expect(result.macdLine).toBeLessThan(0);
  });

  it('should match manual calculation', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = calculateMACD(prices, 12, 26, 9)!;

    // Manually compute EMA12 and EMA26
    const ema12 = calculateEMA(prices, 12)!;
    const ema26 = calculateEMA(prices, 26)!;
    // The last MACD line should be close to EMA12 - EMA26
    // (Not exact because MACD signal uses EMA of the full MACD series, but the line itself should match)
    expect(result.macdLine).toBeCloseTo(ema12 - ema26, 4);
  });
});

// ============================================
// Bollinger Bands Tests
// ============================================

describe('calculateBollingerBands', () => {
  it('should return null when insufficient data', () => {
    expect(calculateBollingerBands([1, 2, 3], 20)).toBeNull();
  });

  it('should calculate bands with exact period length', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = calculateBollingerBands(data, 20, 2)!;
    expect(result).not.toBeNull();
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.lower).toBeLessThan(result.middle);
  });

  it('should have middle band equal to SMA(period)', () => {
    const result = calculateBollingerBands(PRICES, 20, 2)!;
    const sma = calculateSMA(PRICES, 20)!;
    expect(result.middle).toBeCloseTo(sma, 6);
  });

  it('should have symmetric bands around middle', () => {
    const result = calculateBollingerBands(PRICES, 20, 2)!;
    const upperDist = result.upper - result.middle;
    const lowerDist = result.middle - result.lower;
    expect(upperDist).toBeCloseTo(lowerDist, 10);
  });

  it('should have zero width bands when all prices are equal', () => {
    const flat = Array(20).fill(100);
    const result = calculateBollingerBands(flat, 20, 2)!;
    expect(result.upper).toBe(100);
    expect(result.middle).toBe(100);
    expect(result.lower).toBe(100);
  });

  it('should match manual calculation', () => {
    const slice = PRICES.slice(PRICES.length - 20);
    const mean = slice.reduce((a, b) => a + b, 0) / 20;
    const variance = slice.reduce((acc, p) => acc + (p - mean) ** 2, 0) / 20;
    const stdDev = Math.sqrt(variance);

    const result = calculateBollingerBands(PRICES, 20, 2)!;
    expect(result.middle).toBeCloseTo(mean, 6);
    expect(result.upper).toBeCloseTo(mean + 2 * stdDev, 6);
    expect(result.lower).toBeCloseTo(mean - 2 * stdDev, 6);
  });
});

// ============================================
// OBV Tests
// ============================================

describe('calculateOBV', () => {
  it('should return null when insufficient data', () => {
    expect(calculateOBV([100], [1000])).toBeNull();
    expect(calculateOBV([], [])).toBeNull();
  });

  it('should return null when arrays have different lengths', () => {
    expect(calculateOBV([1, 2, 3], [100, 200])).toBeNull();
  });

  it('should add volume when price goes up', () => {
    const prices = [100, 110]; // up
    const volumes = [1000, 2000];
    expect(calculateOBV(prices, volumes)).toBe(2000);
  });

  it('should subtract volume when price goes down', () => {
    const prices = [110, 100]; // down
    const volumes = [1000, 2000];
    expect(calculateOBV(prices, volumes)).toBe(-2000);
  });

  it('should not change OBV when price is flat', () => {
    const prices = [100, 100];
    const volumes = [1000, 5000];
    expect(calculateOBV(prices, volumes)).toBe(0);
  });

  it('should accumulate correctly over multiple days', () => {
    const prices = [100, 105, 103, 108, 108];
    const volumes = [1000, 2000, 1500, 3000, 2500];
    // Day 1→2: up → +2000 = 2000
    // Day 2→3: down → -1500 = 500
    // Day 3→4: up → +3000 = 3500
    // Day 4→5: flat → 3500
    expect(calculateOBV(prices, volumes)).toBe(3500);
  });

  it('should calculate OBV for reference data', () => {
    const obv = calculateOBV(PRICES, VOLUMES)!;
    expect(obv).toBeTypeOf('number');

    // Manual verification: iterate and accumulate
    let expected = 0;
    for (let i = 1; i < PRICES.length; i++) {
      if (PRICES[i] > PRICES[i - 1]) expected += VOLUMES[i];
      else if (PRICES[i] < PRICES[i - 1]) expected -= VOLUMES[i];
    }
    expect(obv).toBe(expected);
  });
});

describe('calculateOBVSeries', () => {
  it('should return empty array when insufficient data', () => {
    expect(calculateOBVSeries([100], [1000])).toEqual([]);
  });

  it('should return series with first element 0', () => {
    const series = calculateOBVSeries(PRICES, VOLUMES);
    expect(series[0]).toBe(0);
  });

  it('should have last element equal to calculateOBV result', () => {
    const series = calculateOBVSeries(PRICES, VOLUMES);
    const obv = calculateOBV(PRICES, VOLUMES)!;
    expect(series[series.length - 1]).toBe(obv);
  });

  it('should have same length as input arrays', () => {
    const series = calculateOBVSeries(PRICES, VOLUMES);
    expect(series.length).toBe(PRICES.length);
  });
});

// ============================================
// Average Volume Tests
// ============================================

describe('calculateAverageVolume', () => {
  it('should return null when insufficient data', () => {
    expect(calculateAverageVolume([1000, 2000], 20)).toBeNull();
  });

  it('should calculate average of last N volumes', () => {
    const volumes = Array.from({ length: 20 }, (_, i) => (i + 1) * 1000);
    const result = calculateAverageVolume(volumes, 20)!;
    const expected = volumes.reduce((a, b) => a + b, 0) / 20;
    expect(result.avgVolume).toBeCloseTo(expected, 2);
  });

  it('should calculate volumeRatio as current / average', () => {
    const volumes = Array(20).fill(1000);
    volumes[19] = 2000; // last volume is double
    const result = calculateAverageVolume(volumes, 20)!;
    // avg = (19*1000 + 2000) / 20 = 1050
    // ratio = 2000 / 1050 ≈ 1.905
    expect(result.avgVolume).toBeCloseTo(1050, 2);
    expect(result.volumeRatio).toBeCloseTo(2000 / 1050, 4);
  });

  it('should use only last period volumes', () => {
    const volumes = [999_999, ...Array(20).fill(5000)];
    const result = calculateAverageVolume(volumes, 20)!;
    expect(result.avgVolume).toBeCloseTo(5000, 2);
  });

  it('should return ratio of 1 when current equals average', () => {
    const volumes = Array(20).fill(5000);
    const result = calculateAverageVolume(volumes, 20)!;
    expect(result.volumeRatio).toBeCloseTo(1, 6);
  });

  it('should calculate for reference data', () => {
    const result = calculateAverageVolume(VOLUMES, 20)!;
    const last20 = VOLUMES.slice(VOLUMES.length - 20);
    const expectedAvg = last20.reduce((a, b) => a + b, 0) / 20;
    expect(result.avgVolume).toBeCloseTo(expectedAvg, 2);
    expect(result.volumeRatio).toBeCloseTo(VOLUMES[VOLUMES.length - 1] / expectedAvg, 6);
  });
});
