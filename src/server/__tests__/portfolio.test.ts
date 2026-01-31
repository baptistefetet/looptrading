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
  },
}));

describe('Portfolio endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up positions and stocks before each test
    await prisma.position.deleteMany();
    await prisma.stock.deleteMany();

    // Seed a test stock
    await prisma.stock.create({
      data: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        market: 'US',
        active: true,
      },
    });
  });

  // ============================================
  // GET /api/portfolio/positions
  // ============================================

  describe('GET /api/portfolio/positions', () => {
    it('should return empty portfolio summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/positions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.positions).toEqual([]);
      expect(body.data.totalValue).toBe(0);
      expect(body.data.totalCost).toBe(0);
      expect(body.data.totalPnL).toBe(0);
      expect(body.data.totalPnLPercent).toBe(0);
    });

    it('should return positions with P&L', async () => {
      await prisma.position.create({
        data: {
          symbol: 'AAPL',
          quantity: 10,
          avgCost: 100,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/positions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.positions).toHaveLength(1);

      const pos = body.data.positions[0];
      expect(pos.symbol).toBe('AAPL');
      expect(pos.quantity).toBe(10);
      expect(pos.avgCost).toBe(100);
      expect(pos.currentPrice).toBe(150);
      expect(pos.marketValue).toBe(1500);
      expect(pos.unrealizedPnL).toBe(500);
      expect(pos.unrealizedPnLPercent).toBe(50);

      expect(body.data.totalValue).toBe(1500);
      expect(body.data.totalCost).toBe(1000);
      expect(body.data.totalPnL).toBe(500);
      expect(body.data.totalPnLPercent).toBe(50);
    });
  });

  // ============================================
  // POST /api/portfolio/positions
  // ============================================

  describe('POST /api/portfolio/positions', () => {
    it('should create a position for existing stock', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/positions',
        payload: {
          symbol: 'AAPL',
          quantity: 5,
          avgCost: 120,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
      expect(body.data.quantity).toBe(5);
      expect(body.data.avgCost).toBe(120);
      expect(body.data.currentPrice).toBe(150);
      expect(body.data.marketValue).toBe(750);
    });

    it('should create a position with optional fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/positions',
        payload: {
          symbol: 'AAPL',
          quantity: 10,
          avgCost: 130,
          dateAcquired: '2026-01-15T00:00:00.000Z',
          notes: 'Bought on dip',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.notes).toBe('Bought on dip');
    });

    it('should reject invalid quantity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/positions',
        payload: {
          symbol: 'AAPL',
          quantity: -5,
          avgCost: 100,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid avgCost', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/positions',
        payload: {
          symbol: 'AAPL',
          quantity: 5,
          avgCost: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should uppercase the symbol', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/positions',
        payload: {
          symbol: 'aapl',
          quantity: 5,
          avgCost: 100,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('AAPL');
    });
  });

  // ============================================
  // PUT /api/portfolio/positions/:id
  // ============================================

  describe('PUT /api/portfolio/positions/:id', () => {
    it('should update a position', async () => {
      const position = await prisma.position.create({
        data: {
          symbol: 'AAPL',
          quantity: 10,
          avgCost: 100,
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/portfolio/positions/${position.id}`,
        payload: {
          quantity: 20,
          notes: 'Added more shares',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.quantity).toBe(20);
      expect(body.data.notes).toBe('Added more shares');
      expect(body.data.symbol).toBe('AAPL');
    });

    it('should return 404 for non-existent position', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/portfolio/positions/nonexistent',
        payload: {
          quantity: 20,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================
  // DELETE /api/portfolio/positions/:id
  // ============================================

  describe('DELETE /api/portfolio/positions/:id', () => {
    it('should delete a position', async () => {
      const position = await prisma.position.create({
        data: {
          symbol: 'AAPL',
          quantity: 10,
          avgCost: 100,
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/portfolio/positions/${position.id}`,
      });

      expect(response.statusCode).toBe(204);

      // Verify it's gone
      const count = await prisma.position.count();
      expect(count).toBe(0);
    });

    it('should return 404 for non-existent position', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/portfolio/positions/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
