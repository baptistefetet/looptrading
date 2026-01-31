import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketDataService } from '../services/MarketDataService.js';
import { cacheService } from '../services/CacheService.js';

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn().mockResolvedValue({
      regularMarketPrice: 185.5,
      regularMarketChange: 2.35,
      regularMarketChangePercent: 1.28,
      regularMarketVolume: 52340000,
      regularMarketDayHigh: 186.2,
      regularMarketDayLow: 183.1,
      regularMarketOpen: 183.75,
      regularMarketPreviousClose: 183.15,
      currency: 'USD',
      marketState: 'REGULAR',
      shortName: 'Apple Inc.',
      fullExchangeName: 'NasdaqGS',
      exchange: 'NMS',
    }),
    historical: vi.fn().mockResolvedValue([
      {
        date: new Date('2026-01-30'),
        open: 183.75,
        high: 186.2,
        low: 183.1,
        close: 185.5,
        volume: 52340000,
      },
    ]),
  },
}));

describe('MarketDataService', () => {
  let service: MarketDataService;

  beforeEach(() => {
    service = new MarketDataService();
    cacheService.clear();
  });

  // ============================================
  // Market detection
  // ============================================

  describe('detectMarket', () => {
    it('should detect US market for plain symbols', () => {
      expect(service.detectMarket('AAPL')).toBe('US');
      expect(service.detectMarket('MSFT')).toBe('US');
      expect(service.detectMarket('TSLA')).toBe('US');
    });

    it('should detect EU market for .PA suffix (Paris)', () => {
      expect(service.detectMarket('BNP.PA')).toBe('EU');
      expect(service.detectMarket('TTE.PA')).toBe('EU');
    });

    it('should detect EU market for .DE suffix (Frankfurt)', () => {
      expect(service.detectMarket('SAP.DE')).toBe('EU');
    });

    it('should detect EU market for .L suffix (London)', () => {
      expect(service.detectMarket('HSBA.L')).toBe('EU');
    });

    it('should detect EU market for .AS suffix (Amsterdam)', () => {
      expect(service.detectMarket('ASML.AS')).toBe('EU');
    });

    it('should return US for unknown suffix', () => {
      expect(service.detectMarket('UNKNOWN.XX')).toBe('US');
    });
  });

  describe('getExchangeName', () => {
    it('should return exchange name for known suffixes', () => {
      expect(service.getExchangeName('BNP.PA')).toBe('Euronext Paris');
      expect(service.getExchangeName('SAP.DE')).toBe('XETRA Frankfurt');
      expect(service.getExchangeName('HSBA.L')).toBe('London Stock Exchange');
    });

    it('should return null for US symbols', () => {
      expect(service.getExchangeName('AAPL')).toBeNull();
    });

    it('should return null for unknown suffix', () => {
      expect(service.getExchangeName('FOO.XX')).toBeNull();
    });
  });

  // ============================================
  // Cache invalidation
  // ============================================

  describe('invalidateCache', () => {
    it('should clear quote and history cache for a symbol', async () => {
      // Populate cache
      await service.getQuote('AAPL');
      await service.getHistory('AAPL', '3m');

      // Verify cache hit
      expect(cacheService.get('market:quote:AAPL')).not.toBeNull();
      expect(cacheService.get('market:history:AAPL:3m')).not.toBeNull();

      // Invalidate
      service.invalidateCache('AAPL');

      // Verify cleared
      expect(cacheService.get('market:quote:AAPL')).toBeNull();
      expect(cacheService.get('market:history:AAPL:3m')).toBeNull();
    });

    it('should handle case-insensitive invalidation', async () => {
      await service.getQuote('AAPL');
      service.invalidateCache('aapl');
      expect(cacheService.get('market:quote:AAPL')).toBeNull();
    });
  });

  // ============================================
  // Retry on 429
  // ============================================

  describe('retry on 429', () => {
    it('should retry on 429 error and succeed', async () => {
      const yahooFinance = (await import('yahoo-finance2')).default;
      const quoteMock = vi.mocked(yahooFinance.quote);
      quoteMock.mockClear();

      quoteMock
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValueOnce({
          regularMarketPrice: 185.5,
          regularMarketChange: 2.35,
          regularMarketChangePercent: 1.28,
          regularMarketVolume: 52340000,
          regularMarketDayHigh: 186.2,
          regularMarketDayLow: 183.1,
          regularMarketOpen: 183.75,
          regularMarketPreviousClose: 183.15,
          currency: 'USD',
          marketState: 'REGULAR' as const,
          shortName: 'Apple Inc.',
          fullExchangeName: 'NasdaqGS',
          exchange: 'NMS',
        } as never);

      const quote = await service.getQuote('RETRY_TEST');
      expect(quote.price).toBe(185.5);
      expect(quoteMock).toHaveBeenCalledTimes(2);
    });
  });
});
