import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn().mockResolvedValue({
      regularMarketPrice: 150.0,
      regularMarketChange: 2.5,
      regularMarketChangePercent: 1.69,
      regularMarketVolume: 50000000,
      regularMarketDayHigh: 152.0,
      regularMarketDayLow: 148.0,
      regularMarketOpen: 149.0,
      regularMarketPreviousClose: 147.5,
      currency: 'USD',
      marketState: 'REGULAR',
      shortName: 'Apple Inc.',
      fullExchangeName: 'NASDAQ',
      exchange: 'NMS',
    }),
    historical: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue({ quotes: [] }),
  },
}));

describe('Universe endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up all related data before each test
    await prisma.stockData.deleteMany();
    await prisma.position.deleteMany();
    await prisma.watchlistItem.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.stock.deleteMany();
  });

  // ============================================
  // GET /api/stocks
  // ============================================

  describe('GET /api/stocks', () => {
    it('should return empty list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.limit).toBe(50);
      expect(body.meta.offset).toBe(0);
    });

    it('should return stocks with pagination', async () => {
      // Create 3 stocks
      await prisma.stock.createMany({
        data: [
          { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
          { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', active: true },
          { symbol: 'MC.PA', name: 'LVMH', market: 'EU', active: true },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks?limit=2&offset=0',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(3);
      expect(body.meta.limit).toBe(2);
    });

    it('should filter by market', async () => {
      await prisma.stock.createMany({
        data: [
          { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
          { symbol: 'MC.PA', name: 'LVMH', market: 'EU', active: true },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks?market=EU',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('MC.PA');
    });

    it('should filter by active status', async () => {
      await prisma.stock.createMany({
        data: [
          { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
          { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', active: false },
        ],
      });

      // Default: active=true
      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('AAPL');

      // active=all
      const responseAll = await app.inject({
        method: 'GET',
        url: '/api/stocks?active=all',
      });

      const bodyAll = JSON.parse(responseAll.body);
      expect(bodyAll.data).toHaveLength(2);
    });

    it('should sort stocks', async () => {
      await prisma.stock.createMany({
        data: [
          { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', active: true },
          { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/stocks?sortBy=symbol&sortOrder=desc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data[0].symbol).toBe('MSFT');
      expect(body.data[1].symbol).toBe('AAPL');
    });
  });

  // ============================================
  // POST /api/stocks
  // ============================================

  describe('POST /api/stocks', () => {
    it('should add a stock to the universe', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/stocks',
        payload: { symbol: 'AAPL' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
      expect(body.data.name).toBe('Apple Inc.');
      expect(body.data.market).toBe('US');
      expect(body.data.active).toBe(true);
    });

    it('should detect EU market from symbol suffix', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/stocks',
        payload: { symbol: 'MC.PA' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.market).toBe('EU');
    });

    it('should accept explicit market', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/stocks',
        payload: { symbol: 'AAPL', market: 'US', sector: 'Technology' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.market).toBe('US');
      expect(body.data.sector).toBe('Technology');
    });

    it('should uppercase the symbol', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/stocks',
        payload: { symbol: 'aapl' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
    });

    it('should return 409 if stock already exists and is active', async () => {
      await prisma.stock.create({
        data: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stocks',
        payload: { symbol: 'AAPL' },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ALREADY_EXISTS');
    });

    it('should reactivate an inactive stock', async () => {
      await prisma.stock.create({
        data: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: false },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stocks',
        payload: { symbol: 'AAPL' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.active).toBe(true);
    });

    it('should reject when 500-stock limit is reached', async () => {
      // Create 500 active stocks
      const stocks = Array.from({ length: 500 }, (_, i) => ({
        symbol: `STK${String(i).padStart(3, '0')}`,
        name: `Stock ${i}`,
        market: 'US',
        active: true,
      }));
      await prisma.stock.createMany({ data: stocks });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stocks',
        payload: { symbol: 'EXTRA' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('LIMIT_REACHED');
    });
  });

  // ============================================
  // DELETE /api/stocks/:symbol
  // ============================================

  describe('DELETE /api/stocks/:symbol', () => {
    it('should soft-delete a stock (set active=false)', async () => {
      await prisma.stock.create({
        data: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stocks/AAPL',
      });

      expect(response.statusCode).toBe(204);

      // Verify soft delete
      const stock = await prisma.stock.findUnique({ where: { symbol: 'AAPL' } });
      expect(stock).not.toBeNull();
      expect(stock!.active).toBe(false);
    });

    it('should return 404 for non-existent stock', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stocks/UNKNOWN',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should handle case-insensitive symbol', async () => {
      await prisma.stock.create({
        data: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stocks/aapl',
      });

      // Symbol is uppercased in the handler
      expect(response.statusCode).toBe(204);
    });
  });
});
