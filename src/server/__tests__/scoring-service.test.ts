import { describe, it, expect } from 'vitest';
import {
  scoreTrendLT,
  scoreTrendMT,
  scoreMomentum,
  scoreVolume,
  scoreSentiment,
  scoreSupportProximity,
  ScoringService,
} from '../services/ScoringService.js';

// ============================================
// scoreTrendLT Tests (25% weight)
// ============================================

describe('scoreTrendLT', () => {
  it('should return 50 when SMA200 is null', () => {
    expect(scoreTrendLT(150, null)).toBe(50);
  });

  it('should return 50 when SMA200 is 0', () => {
    expect(scoreTrendLT(150, 0)).toBe(50);
  });

  it('should return high score when price is well above SMA200', () => {
    // Price 20% above SMA200 → should be ~100
    const score = scoreTrendLT(120, 100);
    expect(score).toBe(100);
  });

  it('should return low score when price is well below SMA200', () => {
    // Price 20% below SMA200 → should be ~0
    const score = scoreTrendLT(80, 100);
    expect(score).toBe(0);
  });

  it('should return ~50 when price equals SMA200', () => {
    const score = scoreTrendLT(100, 100);
    expect(score).toBe(50);
  });

  it('should return ~75 when price is 10% above SMA200', () => {
    const score = scoreTrendLT(110, 100);
    expect(score).toBeCloseTo(75, 0);
  });

  it('should clamp to 0 when price is far below SMA200', () => {
    const score = scoreTrendLT(50, 100); // -50%
    expect(score).toBe(0);
  });

  it('should clamp to 100 when price is far above SMA200', () => {
    const score = scoreTrendLT(150, 100); // +50%
    expect(score).toBe(100);
  });
});

// ============================================
// scoreTrendMT Tests (20% weight)
// ============================================

describe('scoreTrendMT', () => {
  it('should return 50 when SMA50 is null', () => {
    expect(scoreTrendMT(150, null, null)).toBe(50);
  });

  it('should return high score in uptrend (price above SMA50, SMA20 above SMA50)', () => {
    const score = scoreTrendMT(110, 100, 105);
    expect(score).toBeGreaterThan(70);
  });

  it('should return low score in downtrend', () => {
    const score = scoreTrendMT(90, 100, 95);
    expect(score).toBeLessThan(30);
  });

  it('should return ~50 when price equals SMA50 and SMA20 equals SMA50', () => {
    const score = scoreTrendMT(100, 100, 100);
    expect(score).toBe(50);
  });

  it('should work with null SMA20 (only price vs SMA50)', () => {
    const score = scoreTrendMT(110, 100, null);
    // 60% price component + 40% neutral (50)
    expect(score).toBeGreaterThan(50);
  });
});

// ============================================
// scoreMomentum Tests (20% weight)
// ============================================

describe('scoreMomentum', () => {
  it('should return 50 when both RSI and MACD are null', () => {
    expect(scoreMomentum(null, null)).toBe(50);
  });

  it('should return high score for ideal swing conditions (RSI ~55, positive MACD)', () => {
    const score = scoreMomentum(55, 1.5);
    expect(score).toBeGreaterThan(70);
  });

  it('should penalize overbought RSI (>70)', () => {
    const scoreNormal = scoreMomentum(55, 0);
    const scoreOverbought = scoreMomentum(85, 0);
    expect(scoreOverbought).toBeLessThan(scoreNormal);
  });

  it('should penalize oversold RSI (<30)', () => {
    const score = scoreMomentum(15, 0);
    expect(score).toBeLessThan(50);
  });

  it('should give bonus for positive MACD histogram', () => {
    const scoreNeg = scoreMomentum(50, -1);
    const scorePos = scoreMomentum(50, 1);
    expect(scorePos).toBeGreaterThan(scoreNeg);
  });

  it('should handle extreme RSI (100)', () => {
    const score = scoreMomentum(100, 0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should handle extreme RSI (0)', () => {
    const score = scoreMomentum(0, 0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ============================================
// scoreVolume Tests (15% weight)
// ============================================

describe('scoreVolume', () => {
  it('should return 50 when avgVol20 is null', () => {
    expect(scoreVolume(1000, null)).toBe(50);
  });

  it('should return 50 when avgVol20 is 0', () => {
    expect(scoreVolume(1000, 0)).toBe(50);
  });

  it('should return 50 when volume equals average', () => {
    expect(scoreVolume(1000, 1000)).toBe(50);
  });

  it('should return high score for high volume', () => {
    const score = scoreVolume(2000, 1000); // 2x average
    expect(score).toBe(100);
  });

  it('should return low score for low volume', () => {
    const score = scoreVolume(250, 1000); // 0.25x average
    expect(score).toBeCloseTo(12.5, 1);
  });

  it('should clamp at 100 for very high volume', () => {
    const score = scoreVolume(5000, 1000); // 5x average
    expect(score).toBe(100);
  });

  it('should return 0 for zero volume', () => {
    expect(scoreVolume(0, 1000)).toBe(0);
  });
});

// ============================================
// scoreSentiment Tests (10% weight)
// ============================================

describe('scoreSentiment', () => {
  it('should return 30 for 0 news', () => {
    expect(scoreSentiment(0)).toBe(30);
  });

  it('should return 50 for 1-3 news', () => {
    expect(scoreSentiment(1)).toBe(50);
    expect(scoreSentiment(3)).toBe(50);
  });

  it('should return 70 for 4-7 news', () => {
    expect(scoreSentiment(4)).toBe(70);
    expect(scoreSentiment(7)).toBe(70);
  });

  it('should return 85 for 8+ news', () => {
    expect(scoreSentiment(8)).toBe(85);
    expect(scoreSentiment(15)).toBe(85);
  });
});

// ============================================
// scoreSupportProximity Tests (10% weight)
// ============================================

describe('scoreSupportProximity', () => {
  it('should return 50 when no recent lows', () => {
    expect(scoreSupportProximity(150, [])).toBe(50);
  });

  it('should return 100 when price is at support', () => {
    const score = scoreSupportProximity(100, [100, 105, 110]);
    expect(score).toBe(100);
  });

  it('should return lower score when price is far above support', () => {
    // Price 15% above support → score should be ~20
    const score = scoreSupportProximity(115, [100, 105, 110]);
    expect(score).toBeCloseTo(20, 0);
  });

  it('should return 0 when price is way above support', () => {
    const score = scoreSupportProximity(200, [100, 105, 110]);
    expect(score).toBe(0);
  });

  it('should use the minimum low as support', () => {
    const score1 = scoreSupportProximity(105, [100, 110, 120]);
    const score2 = scoreSupportProximity(105, [90, 110, 120]);
    // score2 should be lower because support is further away (90 vs 100)
    expect(score2).toBeLessThan(score1);
  });
});

// ============================================
// ScoringService.computeComponents Tests
// ============================================

describe('ScoringService.computeComponents', () => {
  const service = new ScoringService();

  it('should return 6 components', () => {
    const components = service.computeComponents(
      150,
      { sma20: 148, sma50: 145, sma200: 130, rsi14: 55, macdHist: 0.5, volume: 1000, avgVol20: 1000 },
      [140, 142, 145],
      5
    );
    expect(components).toHaveLength(6);
  });

  it('should have weights summing to 1.0', () => {
    const components = service.computeComponents(
      150,
      { sma20: 148, sma50: 145, sma200: 130, rsi14: 55, macdHist: 0.5, volume: 1000, avgVol20: 1000 },
      [140, 142, 145],
      5
    );
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it('should produce score > 80 for strong bullish scenario', () => {
    // Price well above all SMAs, good RSI, positive MACD, high volume, news, near support
    const components = service.computeComponents(
      120,
      {
        sma20: 115,
        sma50: 110,
        sma200: 100,
        rsi14: 55,
        macdHist: 1.5,
        volume: 2000,
        avgVol20: 1000,
      },
      [118, 119, 120], // very close to support
      8
    );
    const totalScore = Math.round(components.reduce((sum, c) => sum + c.weightedScore, 0));
    expect(totalScore).toBeGreaterThan(80);
  });

  it('should produce score < 30 for strong bearish scenario', () => {
    // Price below all SMAs, oversold RSI, negative MACD, low volume, no news, far from support
    const components = service.computeComponents(
      80,
      {
        sma20: 90,
        sma50: 95,
        sma200: 100,
        rsi14: 20,
        macdHist: -2,
        volume: 300,
        avgVol20: 1000,
      },
      [60, 65, 70], // support is much lower
      0
    );
    const totalScore = Math.round(components.reduce((sum, c) => sum + c.weightedScore, 0));
    expect(totalScore).toBeLessThan(30);
  });

  it('should produce score ~50 for neutral scenario', () => {
    // Price at SMA levels, neutral RSI, flat MACD, average volume
    const components = service.computeComponents(
      100,
      {
        sma20: 100,
        sma50: 100,
        sma200: 100,
        rsi14: 50,
        macdHist: 0,
        volume: 1000,
        avgVol20: 1000,
      },
      [95, 96, 97],
      3
    );
    const totalScore = Math.round(components.reduce((sum, c) => sum + c.weightedScore, 0));
    expect(totalScore).toBeGreaterThan(35);
    expect(totalScore).toBeLessThan(65);
  });

  it('should handle all null indicators gracefully', () => {
    const components = service.computeComponents(
      100,
      { sma20: null, sma50: null, sma200: null, rsi14: null, macdHist: null, volume: 0, avgVol20: null },
      [],
      0
    );
    const totalScore = Math.round(components.reduce((sum, c) => sum + c.weightedScore, 0));
    // With all nulls, most components default to 50 → score should be around 40-50
    expect(totalScore).toBeGreaterThanOrEqual(0);
    expect(totalScore).toBeLessThanOrEqual(100);
  });

  it('should have each component rawScore between 0 and 100', () => {
    const components = service.computeComponents(
      150,
      { sma20: 148, sma50: 145, sma200: 130, rsi14: 55, macdHist: 0.5, volume: 1000, avgVol20: 1000 },
      [140, 142, 145],
      5
    );
    for (const c of components) {
      expect(c.rawScore).toBeGreaterThanOrEqual(0);
      expect(c.rawScore).toBeLessThanOrEqual(100);
    }
  });

  it('should have weightedScore = rawScore * weight (approximately)', () => {
    const components = service.computeComponents(
      150,
      { sma20: 148, sma50: 145, sma200: 130, rsi14: 55, macdHist: 0.5, volume: 1000, avgVol20: 1000 },
      [140, 142, 145],
      5
    );
    for (const c of components) {
      // rawScore is rounded to 2 decimals, so we check loosely
      expect(c.weightedScore).toBeCloseTo(c.rawScore * c.weight, 0);
    }
  });
});
