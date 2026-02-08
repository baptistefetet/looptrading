import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

// Mock yahoo-finance2 (not used by screener but needed for app initialization)
vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn().mockResolvedValue({
      regularMarketPrice: 150.0,
      currency: 'USD',
    }),
  },
}));

describe('Screener endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up in order (foreign key constraints)
    await prisma.stockData.deleteMany();
    await prisma.position.deleteMany();
    await prisma.watchlistItem.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.stock.deleteMany();
  });

  async function seedStocks() {
    // Create stocks
    await prisma.stock.createMany({
      data: [
        { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
        { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', active: true },
        { symbol: 'MC.PA', name: 'LVMH', market: 'EU', active: true },
        { symbol: 'DEAD', name: 'Inactive Corp', market: 'US', active: false },
      ],
    });

    const today = new Date('2026-02-07');
    const yesterday = new Date('2026-02-06');

    // Seed yesterday's data (for change calculation)
    await prisma.stockData.createMany({
      data: [
        {
          symbol: 'AAPL', date: yesterday,
          open: 148, high: 152, low: 147, close: 150, volume: 50000000,
          sma50: 145, sma200: 140, rsi14: 55, avgVol20: 40000000, score: 85,
        },
        {
          symbol: 'MSFT', date: yesterday,
          open: 398, high: 405, low: 396, close: 400, volume: 30000000,
          sma50: 410, sma200: 380, rsi14: 42, avgVol20: 25000000, score: 60,
        },
        {
          symbol: 'MC.PA', date: yesterday,
          open: 780, high: 790, low: 775, close: 785, volume: 2000000,
          sma50: 800, sma200: 750, rsi14: 35, avgVol20: 1800000, score: 45,
        },
        {
          symbol: 'DEAD', date: yesterday,
          open: 5, high: 5.5, low: 4.5, close: 5, volume: 1000,
          score: 20,
        },
      ],
    });

    // Seed today's data (latest) with pre-computed screener fields
    await prisma.stockData.createMany({
      data: [
        {
          symbol: 'AAPL', date: today,
          open: 150, high: 155, low: 149, close: 153, volume: 60000000,
          sma50: 146, sma200: 141, rsi14: 58, avgVol20: 42000000, score: 88,
          aboveSma50: true, aboveSma200: true,
          volumeRatio: 60000000 / 42000000, // ~1.43
          changePct: ((153 - 150) / 150) * 100, // 2.0
        },
        {
          symbol: 'MSFT', date: today,
          open: 400, high: 408, low: 399, close: 405, volume: 35000000,
          sma50: 410, sma200: 382, rsi14: 45, avgVol20: 26000000, score: 62,
          aboveSma50: false, aboveSma200: true,
          volumeRatio: 35000000 / 26000000, // ~1.35
          changePct: ((405 - 400) / 400) * 100, // 1.25
        },
        {
          symbol: 'MC.PA', date: today,
          open: 785, high: 795, low: 780, close: 790, volume: 2500000,
          sma50: 800, sma200: 755, rsi14: 38, avgVol20: 1900000, score: 48,
          aboveSma50: false, aboveSma200: true,
          volumeRatio: 2500000 / 1900000, // ~1.32
          changePct: ((790 - 785) / 785) * 100, // ~0.64
        },
        {
          symbol: 'DEAD', date: today,
          open: 5, high: 5.2, low: 4.8, close: 5.1, volume: 800,
          score: 22,
        },
      ],
    });
  }

  // ============================================
  // Basic functionality
  // ============================================

  describe('GET /api/screener - basics', () => {
    it('should return empty results when no data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.limit).toBe(50);
      expect(body.meta.offset).toBe(0);
    });

    it('should return only active stocks with latest data', async () => {
      await seedStocks();

      const response = await app.inject({
        method: 'GET',
        url: '/api/screener',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // DEAD is inactive, should not appear
      expect(body.data).toHaveLength(3);
      expect(body.meta.total).toBe(3);

      const symbols = body.data.map((r: { symbol: string }) => r.symbol);
      expect(symbols).not.toContain('DEAD');
    });

    it('should return correct response format', async () => {
      await seedStocks();

      const response = await app.inject({
        method: 'GET',
        url: '/api/screener',
      });

      const body = JSON.parse(response.body);
      const aapl = body.data.find((r: { symbol: string }) => r.symbol === 'AAPL');

      expect(aapl).toBeDefined();
      expect(aapl.symbol).toBe('AAPL');
      expect(aapl.name).toBe('Apple Inc.');
      expect(aapl.market).toBe('US');
      expect(aapl.price).toBe(153);
      expect(aapl.score).toBe(88);
      expect(aapl.rsi).toBe(58);
      expect(aapl.aboveSma50).toBe(true);  // 153 > 146
      expect(aapl.aboveSma200).toBe(true); // 153 > 141
      expect(typeof aapl.change).toBe('number');
      expect(typeof aapl.volume).toBe('number');
    });

    it('should calculate change percentage correctly', async () => {
      await seedStocks();

      const response = await app.inject({
        method: 'GET',
        url: '/api/screener',
      });

      const body = JSON.parse(response.body);
      const aapl = body.data.find((r: { symbol: string }) => r.symbol === 'AAPL');
      // (153 - 150) / 150 * 100 = 2.0
      expect(aapl.change).toBe(2);
    });

    it('should set X-Total-Count header', async () => {
      await seedStocks();

      const response = await app.inject({
        method: 'GET',
        url: '/api/screener',
      });

      expect(response.headers['x-total-count']).toBe('3');
    });
  });

  // ============================================
  // Filters
  // ============================================

  describe('GET /api/screener - filters', () => {
    beforeEach(async () => {
      await seedStocks();
    });

    it('should filter by minScore', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?minScore=70',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('AAPL');
      expect(body.meta.total).toBe(1);
    });

    it('should filter by maxScore', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?maxScore=50',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('MC.PA');
    });

    it('should filter by minScore and maxScore', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?minScore=50&maxScore=70',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('MSFT');
    });

    it('should filter by minRsi', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?minRsi=50',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('AAPL');
    });

    it('should filter by maxRsi', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?maxRsi=40',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('MC.PA');
    });

    it('should filter by aboveSma50=true', async () => {
      // AAPL: close 153 > sma50 146 = true
      // MSFT: close 405 < sma50 410 = false
      // MC.PA: close 790 < sma50 800 = false
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?aboveSma50=true',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('AAPL');
    });

    it('should filter by aboveSma50=false', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?aboveSma50=false',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      const symbols = body.data.map((r: { symbol: string }) => r.symbol);
      expect(symbols).toContain('MSFT');
      expect(symbols).toContain('MC.PA');
    });

    it('should filter by aboveSma200=true', async () => {
      // AAPL: 153 > 141 = true
      // MSFT: 405 > 382 = true
      // MC.PA: 790 > 755 = true
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?aboveSma200=true',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);
    });

    it('should filter by minVolume', async () => {
      // AAPL: 60M / 42M = 1.43
      // MSFT: 35M / 26M = 1.35
      // MC.PA: 2.5M / 1.9M = 1.32
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?minVolume=1.4',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('AAPL');
    });

    it('should filter by market=US', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?market=US',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      const symbols = body.data.map((r: { symbol: string }) => r.symbol);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('MSFT');
    });

    it('should filter by market=EU', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?market=EU',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('MC.PA');
    });

    it('should combine multiple filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?minScore=50&market=US&maxRsi=50',
      });

      const body = JSON.parse(response.body);
      // MSFT: score=62 >= 50, market=US, rsi=45 <= 50 -> YES
      // AAPL: score=88 >= 50, market=US, rsi=58 > 50 -> NO
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('MSFT');
    });
  });

  // ============================================
  // Sorting
  // ============================================

  describe('GET /api/screener - sorting', () => {
    beforeEach(async () => {
      await seedStocks();
    });

    it('should sort by score desc by default', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener',
      });

      const body = JSON.parse(response.body);
      const scores = body.data.map((r: { score: number }) => r.score);
      expect(scores).toEqual([88, 62, 48]);
    });

    it('should sort by score asc', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?sortBy=score&sortOrder=asc',
      });

      const body = JSON.parse(response.body);
      const scores = body.data.map((r: { score: number }) => r.score);
      expect(scores).toEqual([48, 62, 88]);
    });

    it('should sort by symbol asc', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?sortBy=symbol&sortOrder=asc',
      });

      const body = JSON.parse(response.body);
      const symbols = body.data.map((r: { symbol: string }) => r.symbol);
      expect(symbols).toEqual(['AAPL', 'MC.PA', 'MSFT']);
    });

    it('should sort by rsi desc', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?sortBy=rsi&sortOrder=desc',
      });

      const body = JSON.parse(response.body);
      const rsis = body.data.map((r: { rsi: number }) => r.rsi);
      expect(rsis).toEqual([58, 45, 38]);
    });

    it('should sort by price asc', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?sortBy=price&sortOrder=asc',
      });

      const body = JSON.parse(response.body);
      const prices = body.data.map((r: { price: number }) => r.price);
      expect(prices).toEqual([153, 405, 790]);
    });
  });

  // ============================================
  // Pagination
  // ============================================

  describe('GET /api/screener - pagination', () => {
    beforeEach(async () => {
      await seedStocks();
    });

    it('should respect limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?limit=2',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(3); // total count not affected by limit
      expect(body.meta.limit).toBe(2);
    });

    it('should respect offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?limit=2&offset=2',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1); // only 1 remaining after offset 2
      expect(body.meta.total).toBe(3);
      expect(body.meta.offset).toBe(2);
    });

    it('should return empty data when offset exceeds total', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?offset=100',
      });

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(3);
    });
  });

  // ============================================
  // Validation
  // ============================================

  describe('GET /api/screener - validation', () => {
    it('should reject minScore > 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?minScore=101',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject minScore < 0', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?minScore=-1',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject limit > 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?limit=101',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject limit < 1', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?limit=0',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid market', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?market=INVALID',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid sortBy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?sortBy=invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid sortOrder', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/screener?sortOrder=random',
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
