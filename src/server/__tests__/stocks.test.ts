import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

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
        date: new Date('2026-01-28'),
        open: 182.0,
        high: 184.5,
        low: 181.0,
        close: 183.15,
        volume: 48000000,
      },
      {
        date: new Date('2026-01-29'),
        open: 183.5,
        high: 185.0,
        low: 182.5,
        close: 184.2,
        volume: 51000000,
      },
      {
        date: new Date('2026-01-30'),
        open: 183.75,
        high: 186.2,
        low: 183.1,
        close: 185.5,
        volume: 52340000,
      },
    ]),
    search: vi.fn().mockResolvedValue({ news: [] }),
  },
}));

describe('Stocks endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const { cacheService } = await import('../services/CacheService.js');
    cacheService.clear();

    const yahooFinance = (await import('yahoo-finance2')).default;
    vi.mocked(yahooFinance.quote).mockClear();
    vi.mocked(yahooFinance.historical).mockClear();
  });

  // ============================================
  // GET /api/stocks/:symbol/quote
  // ============================================

  describe('GET /api/stocks/:symbol/quote', () => {
    it('should return quote data for a valid symbol', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/AAPL/quote',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const quote = body.data;

      expect(quote.symbol).toBe('AAPL');
      expect(quote.price).toBe(185.5);
      expect(quote.change).toBe(2.35);
      expect(quote.changePercent).toBe(1.28);
      expect(quote.volume).toBe(52340000);
      expect(quote.high).toBe(186.2);
      expect(quote.low).toBe(183.1);
      expect(quote.open).toBe(183.75);
      expect(quote.previousClose).toBe(183.15);
      expect(quote.currency).toBe('USD');
      expect(quote.marketState).toBe('REGULAR');
      expect(quote.name).toBe('Apple Inc.');
      expect(quote.exchange).toBe('NasdaqGS');
      expect(quote.fetchedAt).toBeDefined();
    });

    it('should handle lowercase symbols', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/aapl/quote',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
    });

    it('should handle EU market symbols', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/BNP.PA/quote',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('BNP.PA');
    });

    it('should use cache on repeated calls', async () => {
      const yahooFinance = (await import('yahoo-finance2')).default;

      await app.inject({ method: 'GET', url: '/api/stocks/AAPL/quote' });
      await app.inject({ method: 'GET', url: '/api/stocks/AAPL/quote' });

      expect(vi.mocked(yahooFinance.quote)).toHaveBeenCalledTimes(1);
    });

    it('should return 502 when Yahoo Finance fails', async () => {
      const yahooFinance = (await import('yahoo-finance2')).default;
      vi.mocked(yahooFinance.quote).mockRejectedValueOnce(new Error('Symbol not found'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/INVALID/quote',
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MARKET_DATA_ERROR');
    });
  });

  // ============================================
  // GET /api/stocks/:symbol/history
  // ============================================

  describe('GET /api/stocks/:symbol/history', () => {
    it('should return historical data with default period (3m)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/AAPL/history',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const history = body.data;

      expect(history.symbol).toBe('AAPL');
      expect(history.period).toBe('3m');
      expect(history.bars).toHaveLength(3);
      expect(history.fetchedAt).toBeDefined();

      const bar = history.bars[0];
      expect(bar.date).toBe('2026-01-28');
      expect(bar.open).toBe(182.0);
      expect(bar.high).toBe(184.5);
      expect(bar.low).toBe(181.0);
      expect(bar.close).toBe(183.15);
      expect(bar.volume).toBe(48000000);
    });

    it('should accept period query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/AAPL/history?period=1y',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.period).toBe('1y');
    });

    it('should reject invalid period', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/AAPL/history?period=5y',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle lowercase symbols', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/aapl/history',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
    });

    it('should use cache on repeated calls', async () => {
      const yahooFinance = (await import('yahoo-finance2')).default;

      await app.inject({ method: 'GET', url: '/api/stocks/AAPL/history' });
      await app.inject({ method: 'GET', url: '/api/stocks/AAPL/history' });

      expect(vi.mocked(yahooFinance.historical)).toHaveBeenCalledTimes(1);
    });

    it('should return 502 when Yahoo Finance fails', async () => {
      const yahooFinance = (await import('yahoo-finance2')).default;
      vi.mocked(yahooFinance.historical).mockRejectedValueOnce(new Error('Network error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks/INVALID/history',
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MARKET_DATA_ERROR');
    });
  });
});
