import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn().mockResolvedValue({
      regularMarketPrice: 150.0,
      currency: 'USD',
    }),
  },
}));

describe('Watchlist endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.stockData.deleteMany();
    await prisma.position.deleteMany();
    await prisma.watchlistItem.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.stock.deleteMany();
  });

  it('returns watchlist items ordered by order with latest market fields', async () => {
    await prisma.stock.createMany({
      data: [
        { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
        { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', active: true },
      ],
    });

    await prisma.watchlistItem.create({
      data: {
        symbol: 'AAPL',
        order: 2,
      },
    });
    await prisma.watchlistItem.create({
      data: {
        symbol: 'MSFT',
        order: 1,
      },
    });

    await prisma.stockData.createMany({
      data: [
        {
          symbol: 'AAPL',
          date: new Date('2026-02-07T00:00:00.000Z'),
          open: 150,
          high: 152,
          low: 149,
          close: 151,
          volume: 1_000_000,
          score: 84,
          changePct: 1.2,
        },
        {
          symbol: 'AAPL',
          date: new Date('2026-02-08T00:00:00.000Z'),
          open: 152,
          high: 156,
          low: 151,
          close: 155.124,
          volume: 1_100_000,
          score: 88,
          changePct: 2.44,
        },
        {
          symbol: 'MSFT',
          date: new Date('2026-02-08T00:00:00.000Z'),
          open: 401,
          high: 406,
          low: 400,
          close: 405.499,
          volume: 900_000,
          score: 72,
          changePct: -0.55,
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/watchlist',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].symbol).toBe('MSFT');
    expect(body.data[0].price).toBe(405.5);
    expect(body.data[0].score).toBe(72);
    expect(body.data[0].change).toBe(-0.55);
    expect(body.data[1].symbol).toBe('AAPL');
    expect(body.data[1].price).toBe(155.12);
    expect(body.data[1].score).toBe(88);
    expect(body.data[1].change).toBe(2.44);
    expect(body.meta).toEqual({
      total: 2,
      limit: 10,
      offset: 0,
    });
  });

  it('supports pagination with limit and offset', async () => {
    await prisma.stock.createMany({
      data: [
        { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
        { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', active: true },
      ],
    });

    await prisma.watchlistItem.createMany({
      data: [
        { symbol: 'AAPL', order: 0 },
        { symbol: 'MSFT', order: 1 },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/watchlist?limit=1&offset=1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].symbol).toBe('MSFT');
    expect(body.meta).toEqual({
      total: 2,
      limit: 1,
      offset: 1,
    });
  });

  it('returns empty data when watchlist is empty', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/watchlist',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });
});
