import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn().mockResolvedValue({
      regularMarketPrice: 150.0,
      currency: 'USD',
    }),
    search: vi.fn().mockResolvedValue({
      news: [
        {
          title: 'Apple Reports Record Revenue',
          link: 'https://example.com/article1',
          publisher: 'Reuters',
          providerPublishTime: new Date('2026-01-30T10:00:00Z'),
          thumbnail: {
            resolutions: [{ url: 'https://example.com/thumb1.jpg' }],
          },
        },
        {
          title: 'Tech Stocks Rally',
          link: 'https://example.com/article2',
          publisher: 'Bloomberg',
          providerPublishTime: new Date('2026-01-29T14:00:00Z'),
          thumbnail: null,
        },
        {
          title: '',
          link: 'https://example.com/article3',
          publisher: 'Unknown',
          providerPublishTime: new Date('2026-01-28T08:00:00Z'),
          thumbnail: null,
        },
      ],
    }),
  },
}));

describe('News endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.position.deleteMany();
    await prisma.watchlistItem.deleteMany();
    await prisma.stock.deleteMany();

    // Clear news cache
    const { cacheService } = await import('../services/CacheService.js');
    cacheService.clear();
  });

  // ============================================
  // GET /api/news/:symbol
  // ============================================

  describe('GET /api/news/:symbol', () => {
    it('should return news for a symbol', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/news/AAPL',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
      expect(body.data.news).toHaveLength(2); // 3rd item filtered (empty title)
      expect(body.data.fetchedAt).toBeDefined();

      const first = body.data.news[0];
      expect(first.title).toBe('Apple Reports Record Revenue');
      expect(first.link).toBe('https://example.com/article1');
      expect(first.publisher).toBe('Reuters');
      expect(first.publishedAt).toBeDefined();
      expect(first.thumbnail).toBe('https://example.com/thumb1.jpg');
    });

    it('should handle lowercase symbol', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/news/aapl',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
    });

    it('should respect limit query param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/news/AAPL?limit=1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.news).toHaveLength(1);
    });

    it('should sort news by date descending', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/news/AAPL',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const dates = body.data.news.map((n: { publishedAt: string }) => new Date(n.publishedAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('should filter out news items without title', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/news/AAPL',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // The mock has 3 items but one has empty title
      expect(body.data.news).toHaveLength(2);
      expect(body.data.news.every((n: { title: string }) => n.title.length > 0)).toBe(true);
    });
  });

  // ============================================
  // GET /api/news
  // ============================================

  describe('GET /api/news', () => {
    it('should return empty news when no watchlist/positions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/news',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.news).toEqual([]);
      expect(body.data.fetchedAt).toBeDefined();
    });

    it('should return news from portfolio positions when no watchlist', async () => {
      await prisma.stock.create({
        data: { symbol: 'AAPL', name: 'Apple', market: 'US', active: true },
      });
      await prisma.position.create({
        data: { symbol: 'AAPL', quantity: 10, avgCost: 100 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/news',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.news.length).toBeGreaterThan(0);
    });

    it('should prefer watchlist symbols over portfolio', async () => {
      // Create both watchlist and portfolio
      await prisma.stock.create({
        data: { symbol: 'AAPL', name: 'Apple', market: 'US', active: true },
      });
      await prisma.stock.create({
        data: { symbol: 'MSFT', name: 'Microsoft', market: 'US', active: true },
      });
      await prisma.position.create({
        data: { symbol: 'AAPL', quantity: 10, avgCost: 100 },
      });
      await prisma.watchlistItem.create({
        data: { symbol: 'MSFT', order: 1 },
      });

      const yahooFinance = (await import('yahoo-finance2')).default;
      const searchMock = vi.mocked(yahooFinance.search);
      searchMock.mockClear();

      const response = await app.inject({
        method: 'GET',
        url: '/api/news',
      });

      expect(response.statusCode).toBe(200);
      // Should have called search with MSFT (watchlist), not AAPL (portfolio)
      expect(searchMock).toHaveBeenCalledWith('MSFT', { newsCount: 10 });
    });

    it('should respect limit query param', async () => {
      await prisma.stock.create({
        data: { symbol: 'AAPL', name: 'Apple', market: 'US', active: true },
      });
      await prisma.position.create({
        data: { symbol: 'AAPL', quantity: 10, avgCost: 100 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/news?limit=1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.news).toHaveLength(1);
    });
  });
});
