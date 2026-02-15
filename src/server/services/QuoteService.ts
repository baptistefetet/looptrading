import yahooFinance from '../lib/yahooFinance.js';
import { cacheService } from './CacheService.js';

const QUOTE_CACHE_TTL = 60; // 60 seconds

export interface Quote {
  symbol: string;
  price: number;
  currency: string;
}

export class QuoteService {
  /**
   * Get current price for a single symbol.
   * Returns cached price if available (60s TTL).
   */
  async getQuote(symbol: string): Promise<Quote> {
    const cacheKey = `quote:${symbol}`;
    const cached = cacheService.get<Quote>(cacheKey);
    if (cached) return cached;

    const result = await yahooFinance.quote(symbol);
    const quote: Quote = {
      symbol,
      price: result.regularMarketPrice ?? 0,
      currency: result.currency ?? 'USD',
    };

    cacheService.set(cacheKey, quote, QUOTE_CACHE_TTL);
    return quote;
  }

  /**
   * Get current prices for multiple symbols.
   * Fetches individually to maximize cache hits.
   */
  async getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const results = new Map<string, Quote>();

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const quote = await this.getQuote(symbol);
          results.set(symbol, quote);
        } catch {
          // If a symbol fails, skip it (price will be 0 in P&L)
          results.set(symbol, { symbol, price: 0, currency: 'USD' });
        }
      })
    );

    return results;
  }

  /**
   * Validate that a symbol exists on Yahoo Finance.
   */
  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      const result = await yahooFinance.quote(symbol);
      return result.regularMarketPrice !== undefined;
    } catch {
      return false;
    }
  }
}

export const quoteService = new QuoteService();
