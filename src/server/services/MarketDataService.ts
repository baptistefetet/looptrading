import yahooFinance from 'yahoo-finance2';
import { cacheService } from './CacheService.js';

const QUOTE_CACHE_TTL = 900; // 15 minutes (NFR3)
const HISTORY_CACHE_TTL = 900; // 15 minutes
const RATE_LIMIT_DELAY_MS = 200; // 200ms between Yahoo calls
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

// ============================================
// Types
// ============================================

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  currency: string;
  marketState: string;
  name: string;
  exchange: string;
  fetchedAt: string;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockHistory {
  symbol: string;
  period: string;
  bars: OHLCVBar[];
  fetchedAt: string;
}

export type HistoryPeriod = '1d' | '1w' | '1m' | '3m' | '1y';

// Period to Yahoo Finance interval/range mapping
const PERIOD_CONFIG: Record<HistoryPeriod, { period1: string; interval: '1d' | '1wk' | '1mo' }> = {
  '1d': { period1: '5d', interval: '1d' },
  '1w': { period1: '1mo', interval: '1d' },
  '1m': { period1: '1mo', interval: '1d' },
  '3m': { period1: '3mo', interval: '1d' },
  '1y': { period1: '1y', interval: '1wk' },
};

// EU market suffix mapping
const EU_MARKET_SUFFIXES: Record<string, string> = {
  PA: 'Euronext Paris',
  DE: 'XETRA Frankfurt',
  AS: 'Euronext Amsterdam',
  MI: 'Borsa Italiana',
  MC: 'Bolsa de Madrid',
  L: 'London Stock Exchange',
  BR: 'Euronext Brussels',
  LS: 'Euronext Lisbon',
  HE: 'Helsinki',
  ST: 'Stockholm',
  CO: 'Copenhagen',
  OL: 'Oslo',
  SW: 'SIX Swiss Exchange',
  VI: 'Vienna',
};

// ============================================
// Rate Limiter
// ============================================

class RateLimiter {
  private lastCallTime = 0;
  private queue: Array<{ resolve: () => void }> = [];
  private processing = false;

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastCallTime;
      if (elapsed < RATE_LIMIT_DELAY_MS) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed));
      }
      this.lastCallTime = Date.now();
      const item = this.queue.shift();
      item?.resolve();
    }

    this.processing = false;
  }
}

// ============================================
// MarketDataService
// ============================================

export class MarketDataService {
  private rateLimiter = new RateLimiter();

  /**
   * Detect market from symbol suffix.
   * Symbols with .XX suffix are EU, otherwise US.
   */
  detectMarket(symbol: string): 'US' | 'EU' {
    const suffix = symbol.split('.')[1];
    if (suffix && EU_MARKET_SUFFIXES[suffix.toUpperCase()]) {
      return 'EU';
    }
    return 'US';
  }

  /**
   * Get exchange name from symbol suffix.
   */
  getExchangeName(symbol: string): string | null {
    const suffix = symbol.split('.')[1];
    if (suffix) {
      return EU_MARKET_SUFFIXES[suffix.toUpperCase()] ?? null;
    }
    return null;
  }

  /**
   * Fetch with rate limiting and retry on 429/network errors.
   */
  private async fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await this.rateLimiter.acquire();

      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;
        const is429 =
          error instanceof Error &&
          (error.message.includes('429') || error.message.includes('Too Many Requests'));

        if (is429 && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // Non-retryable error or last attempt
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Get real-time quote for a symbol.
   * Cache: 15 minutes (NFR3).
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `market:quote:${upperSymbol}`;
    const cached = cacheService.get<StockQuote>(cacheKey);
    if (cached) return cached;

    const result = await this.fetchWithRetry(() => yahooFinance.quote(upperSymbol));

    const quote: StockQuote = {
      symbol: upperSymbol,
      price: result.regularMarketPrice ?? 0,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      volume: result.regularMarketVolume ?? 0,
      high: result.regularMarketDayHigh ?? 0,
      low: result.regularMarketDayLow ?? 0,
      open: result.regularMarketOpen ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      currency: result.currency ?? 'USD',
      marketState: result.marketState ?? 'CLOSED',
      name: result.shortName ?? result.longName ?? upperSymbol,
      exchange: result.fullExchangeName ?? result.exchange ?? '',
      fetchedAt: new Date().toISOString(),
    };

    cacheService.set(cacheKey, quote, QUOTE_CACHE_TTL);
    return quote;
  }

  /**
   * Get historical OHLCV data for a symbol.
   * Cache: 15 minutes.
   */
  async getHistory(symbol: string, period: HistoryPeriod = '3m'): Promise<StockHistory> {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `market:history:${upperSymbol}:${period}`;
    const cached = cacheService.get<StockHistory>(cacheKey);
    if (cached) return cached;

    const config = PERIOD_CONFIG[period];
    const now = new Date();
    const period1 = this.computePeriod1(now, config.period1);

    const result = await this.fetchWithRetry(() =>
      yahooFinance.historical(upperSymbol, {
        period1,
        period2: now,
        interval: config.interval,
      })
    );

    const bars: OHLCVBar[] = result.map((bar) => ({
      date: bar.date.toISOString().split('T')[0],
      open: bar.open ?? 0,
      high: bar.high ?? 0,
      low: bar.low ?? 0,
      close: bar.close ?? 0,
      volume: bar.volume ?? 0,
    }));

    const history: StockHistory = {
      symbol: upperSymbol,
      period,
      bars,
      fetchedAt: new Date().toISOString(),
    };

    cacheService.set(cacheKey, history, HISTORY_CACHE_TTL);
    return history;
  }

  /**
   * Invalidate cache for a specific symbol.
   */
  invalidateCache(symbol: string): void {
    const upperSymbol = symbol.toUpperCase();
    cacheService.delete(`market:quote:${upperSymbol}`);
    for (const period of Object.keys(PERIOD_CONFIG)) {
      cacheService.delete(`market:history:${upperSymbol}:${period}`);
    }
  }

  private computePeriod1(now: Date, periodStr: string): Date {
    const d = new Date(now);
    const match = periodStr.match(/^(\d+)(d|mo|y)$/);
    if (!match) return d;

    const [, numStr, unit] = match;
    const num = parseInt(numStr, 10);

    switch (unit) {
      case 'd':
        d.setDate(d.getDate() - num);
        break;
      case 'mo':
        d.setMonth(d.getMonth() - num);
        break;
      case 'y':
        d.setFullYear(d.getFullYear() - num);
        break;
    }

    return d;
  }
}

export const marketDataService = new MarketDataService();
