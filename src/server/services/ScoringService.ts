import { prisma } from '../lib/prisma.js';
import { newsService } from './NewsService.js';

// ============================================
// Types
// ============================================

export interface ScoreComponent {
  name: string;
  weight: number;
  rawScore: number; // 0-100 before weighting
  weightedScore: number; // 0-weight*100, i.e. the contribution
}

export interface CompositeScore {
  symbol: string;
  score: number; // 0-100
  components: ScoreComponent[];
  calculatedAt: string;
}

interface StockDataRow {
  close: number;
  low: number;
  high: number;
  volume: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macdHist: number | null;
  avgVol20: number | null;
}

// ============================================
// Score calculation helpers (pure functions)
// ============================================

/**
 * Tendance LT (25%): price position vs SMA200.
 * Above SMA200 → positive, below → negative.
 * Score 0-100 based on distance (capped at ±20%).
 */
export function scoreTrendLT(price: number, sma200: number | null): number {
  if (sma200 === null || sma200 === 0) return 50; // neutral if no data
  const pctDiff = (price - sma200) / sma200;
  // Map [-0.20, +0.20] to [0, 100], clamp
  const normalized = ((pctDiff + 0.20) / 0.40) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Tendance MT (20%): price vs SMA50 + SMA20/SMA50 crossover.
 * Combined: 60% price vs SMA50 + 40% SMA20 vs SMA50 crossover.
 */
export function scoreTrendMT(
  price: number,
  sma50: number | null,
  sma20: number | null
): number {
  if (sma50 === null || sma50 === 0) return 50;

  // Price vs SMA50 (60% of component)
  const pctDiffPrice = (price - sma50) / sma50;
  const priceScore = ((pctDiffPrice + 0.15) / 0.30) * 100;
  const clampedPriceScore = Math.max(0, Math.min(100, priceScore));

  // SMA20/SMA50 crossover (40% of component)
  let crossScore = 50;
  if (sma20 !== null && sma50 !== 0) {
    const crossDiff = (sma20 - sma50) / sma50;
    crossScore = ((crossDiff + 0.10) / 0.20) * 100;
    crossScore = Math.max(0, Math.min(100, crossScore));
  }

  return clampedPriceScore * 0.6 + crossScore * 0.4;
}

/**
 * Momentum (20%): RSI + MACD histogram.
 * RSI: 30-70 optimal range (50 = perfect center).
 *   Below 30 or above 70 = penalized (overbought/oversold).
 * MACD histogram positive = bonus.
 * Combined: 50% RSI + 50% MACD.
 */
export function scoreMomentum(
  rsi: number | null,
  macdHist: number | null
): number {
  // RSI component (50%)
  let rsiScore = 50;
  if (rsi !== null) {
    if (rsi >= 30 && rsi <= 70) {
      // In optimal range: map 30-70 → higher score for 40-60 zone
      // Best at 50-60 for swing trading (slight bullish)
      if (rsi >= 40 && rsi <= 60) {
        rsiScore = 70 + ((rsi - 40) / 20) * 30; // 70-100
      } else if (rsi > 60) {
        rsiScore = 100 - ((rsi - 60) / 10) * 30; // 100→70
      } else {
        // 30-40: recovering from oversold
        rsiScore = 50 + ((rsi - 30) / 10) * 20; // 50-70
      }
    } else if (rsi < 30) {
      // Oversold: potential bounce but risky
      rsiScore = (rsi / 30) * 50; // 0-50
    } else {
      // >70: Overbought
      rsiScore = Math.max(0, 50 - ((rsi - 70) / 30) * 50); // 50→0
    }
  }

  // MACD histogram component (50%)
  let macdScore = 50;
  if (macdHist !== null) {
    // Positive histogram = bullish momentum
    // Map roughly [-2, +2] to [0, 100]
    const normalized = ((macdHist + 2) / 4) * 100;
    macdScore = Math.max(0, Math.min(100, normalized));
  }

  return rsiScore * 0.5 + macdScore * 0.5;
}

/**
 * Volume (15%): current volume vs 20-day average.
 * Higher volume = confirmation of trend.
 * Ratio 1.0 = average, >1.5 = strong confirmation, <0.5 = weak.
 */
export function scoreVolume(
  currentVolume: number,
  avgVol20: number | null
): number {
  if (avgVol20 === null || avgVol20 === 0) return 50;
  const ratio = currentVolume / avgVol20;
  // Map [0, 2.0] → [0, 100], clamp
  const normalized = (ratio / 2.0) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Sentiment (10%): based on recent news count.
 * More recent news = more attention = higher score.
 * Simple heuristic: 0 news = 30, 1-3 = 50, 4-7 = 70, 8+ = 85.
 */
export function scoreSentiment(newsCount: number): number {
  if (newsCount === 0) return 30;
  if (newsCount <= 3) return 50;
  if (newsCount <= 7) return 70;
  return 85;
}

/**
 * Support Proximity (10%): how close price is to recent support level.
 * Support = lowest low in last N bars.
 * Closer to support = better entry point = higher score.
 * Distance mapped: at support = 100, >15% above = 20.
 */
export function scoreSupportProximity(
  price: number,
  recentLows: number[]
): number {
  if (recentLows.length === 0) return 50;
  const support = Math.min(...recentLows);
  if (support === 0) return 50;

  const distancePct = (price - support) / support;
  // At support (0%) = 100, at 15% above = 20
  const score = 100 - (distancePct / 0.15) * 80;
  return Math.max(0, Math.min(100, score));
}

// ============================================
// ScoringService
// ============================================

export class ScoringService {
  /**
   * Calculate the composite score for a symbol.
   * Reads latest indicators from DB and news from NewsService.
   */
  async calculateScore(symbol: string): Promise<CompositeScore | null> {
    const upperSymbol = symbol.toUpperCase();

    // Fetch recent stock data (last 50 bars for support calculation)
    const stockData = await prisma.stockData.findMany({
      where: { symbol: upperSymbol },
      orderBy: { date: 'desc' },
      take: 50,
      select: {
        close: true,
        low: true,
        high: true,
        volume: true,
        sma20: true,
        sma50: true,
        sma200: true,
        rsi14: true,
        macdHist: true,
        avgVol20: true,
      },
    });

    if (stockData.length === 0) return null;

    const latest = stockData[0] as StockDataRow;
    const price = latest.close;

    // Recent lows for support (last 20 bars)
    const recentLows = stockData
      .slice(0, 20)
      .map((d) => d.low);

    // Fetch news count
    let newsCount = 0;
    try {
      const news = await newsService.getNewsBySymbol(upperSymbol);
      newsCount = news.length;
    } catch {
      // If news fetch fails, use 0
    }

    // Calculate each component
    const components = this.computeComponents(
      price,
      latest,
      recentLows,
      newsCount
    );

    // Sum weighted scores
    const totalScore = Math.round(
      components.reduce((sum, c) => sum + c.weightedScore, 0)
    );

    // Persist score to latest StockData row
    const latestRow = await prisma.stockData.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { date: 'desc' },
      select: { id: true },
    });

    if (latestRow) {
      await prisma.stockData.update({
        where: { id: latestRow.id },
        data: { score: totalScore },
      });
    }

    return {
      symbol: upperSymbol,
      score: totalScore,
      components,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Compute all score components (pure logic, extracted for testing).
   */
  computeComponents(
    price: number,
    indicators: Pick<StockDataRow, 'sma20' | 'sma50' | 'sma200' | 'rsi14' | 'macdHist' | 'volume' | 'avgVol20'>,
    recentLows: number[],
    newsCount: number
  ): ScoreComponent[] {
    const weights = {
      trendLT: 0.25,
      trendMT: 0.20,
      momentum: 0.20,
      volume: 0.15,
      sentiment: 0.10,
      support: 0.10,
    };

    const trendLTRaw = scoreTrendLT(price, indicators.sma200);
    const trendMTRaw = scoreTrendMT(price, indicators.sma50, indicators.sma20);
    const momentumRaw = scoreMomentum(indicators.rsi14, indicators.macdHist);
    const volumeRaw = scoreVolume(indicators.volume, indicators.avgVol20);
    const sentimentRaw = scoreSentiment(newsCount);
    const supportRaw = scoreSupportProximity(price, recentLows);

    return [
      {
        name: 'Tendance LT',
        weight: weights.trendLT,
        rawScore: Math.round(trendLTRaw * 100) / 100,
        weightedScore: trendLTRaw * weights.trendLT,
      },
      {
        name: 'Tendance MT',
        weight: weights.trendMT,
        rawScore: Math.round(trendMTRaw * 100) / 100,
        weightedScore: trendMTRaw * weights.trendMT,
      },
      {
        name: 'Momentum',
        weight: weights.momentum,
        rawScore: Math.round(momentumRaw * 100) / 100,
        weightedScore: momentumRaw * weights.momentum,
      },
      {
        name: 'Volume',
        weight: weights.volume,
        rawScore: Math.round(volumeRaw * 100) / 100,
        weightedScore: volumeRaw * weights.volume,
      },
      {
        name: 'Sentiment',
        weight: weights.sentiment,
        rawScore: Math.round(sentimentRaw * 100) / 100,
        weightedScore: sentimentRaw * weights.sentiment,
      },
      {
        name: 'Proximité Support',
        weight: weights.support,
        rawScore: Math.round(supportRaw * 100) / 100,
        weightedScore: supportRaw * weights.support,
      },
    ];
  }
}

export const scoringService = new ScoringService();
