import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn().mockResolvedValue({
      regularMarketPrice: 170.5,
      currency: 'USD',
    }),
    search: vi.fn().mockResolvedValue({ news: [] }),
  },
}));

/**
 * Generate N daily OHLCV rows for a symbol with a linear uptrend.
 */
function generateStockData(symbol: string, count: number) {
  const rows = [];
  const baseDate = new Date('2025-06-01');
  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    const close = 150 + i * 0.5; // linear uptrend
    rows.push({
      symbol,
      date,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 50_000_000 + i * 100_000,
    });
  }
  return rows;
}

describe('GET /api/stocks/:symbol/indicators', () => {
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
    await prisma.stock.deleteMany();

    // Seed test stock
    await prisma.stock.create({
      data: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
    });
  });

  it('should return 404 when no data exists', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/stocks/AAPL/indicators',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('NO_DATA');
  });

  it('should return indicators with null values when data is insufficient for SMA', async () => {
    // Insert only 10 data points (not enough for SMA20)
    const rows = generateStockData('AAPL', 10);
    await prisma.stockData.createMany({ data: rows });

    const response = await app.inject({
      method: 'GET',
      url: '/api/stocks/AAPL/indicators?recompute=true',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const data = body.data;

    expect(data.symbol).toBe('AAPL');
    expect(data.sma20).toBeNull();
    expect(data.sma50).toBeNull();
    expect(data.sma200).toBeNull();
    // EMA9 should be computable with 10 data points
    expect(data.ema9).not.toBeNull();
    expect(data.ema21).toBeNull();
  });

  it('should compute and return SMA/EMA indicators with sufficient data', async () => {
    // Insert 60 data points (enough for SMA50 + EMA21)
    const rows = generateStockData('AAPL', 60);
    await prisma.stockData.createMany({ data: rows });

    const response = await app.inject({
      method: 'GET',
      url: '/api/stocks/AAPL/indicators?recompute=true',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const data = body.data;

    expect(data.symbol).toBe('AAPL');
    expect(data.sma20).toBeTypeOf('number');
    expect(data.sma50).toBeTypeOf('number');
    expect(data.sma200).toBeNull(); // only 60 data points
    expect(data.ema9).toBeTypeOf('number');
    expect(data.ema21).toBeTypeOf('number');
    expect(data.date).toBeDefined();
    expect(data.calculatedAt).toBeDefined();
  });

  it('should persist indicators to the database after recompute', async () => {
    const rows = generateStockData('AAPL', 25);
    await prisma.stockData.createMany({ data: rows });

    // Recompute
    await app.inject({
      method: 'GET',
      url: '/api/stocks/AAPL/indicators?recompute=true',
    });

    // Read from DB: the last row should have SMA20 set
    const lastRow = await prisma.stockData.findFirst({
      where: { symbol: 'AAPL' },
      orderBy: { date: 'desc' },
    });

    expect(lastRow).not.toBeNull();
    expect(lastRow!.sma20).toBeTypeOf('number');
    expect(lastRow!.ema9).toBeTypeOf('number');
    expect(lastRow!.ema21).toBeTypeOf('number');
  });

  it('should return stored indicators without recompute by default', async () => {
    const rows = generateStockData('AAPL', 25);
    await prisma.stockData.createMany({ data: rows });

    // First compute
    await app.inject({
      method: 'GET',
      url: '/api/stocks/AAPL/indicators?recompute=true',
    });

    // Now read without recompute (default)
    const response = await app.inject({
      method: 'GET',
      url: '/api/stocks/AAPL/indicators',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.sma20).toBeTypeOf('number');
  });

  it('should handle case-insensitive symbols', async () => {
    const rows = generateStockData('AAPL', 25);
    await prisma.stockData.createMany({ data: rows });

    const response = await app.inject({
      method: 'GET',
      url: '/api/stocks/aapl/indicators?recompute=true',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.symbol).toBe('AAPL');
  });

  it('should produce correct SMA20 value for linear uptrend', async () => {
    const rows = generateStockData('AAPL', 25);
    await prisma.stockData.createMany({ data: rows });

    const response = await app.inject({
      method: 'GET',
      url: '/api/stocks/AAPL/indicators?recompute=true',
    });

    const body = JSON.parse(response.body);
    // Last 20 closes: indices 5-24 => close = 150 + i*0.5
    // = 152.5, 153, 153.5, ..., 162
    // SMA = average of these 20 values
    const closes = rows.map((r) => r.close);
    const last20 = closes.slice(5);
    const expectedSma20 = last20.reduce((a, b) => a + b, 0) / 20;
    expect(body.data.sma20).toBeCloseTo(expectedSma20, 4);
  });
});
