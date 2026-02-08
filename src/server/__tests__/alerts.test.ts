import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { evaluateAlerts } from '../services/AlertService.js';

describe('Alerts API and engine', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.stockData.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.userSettings.deleteMany();
  });

  it('lists alerts with filters and acknowledges an alert', async () => {
    await prisma.stock.create({
      data: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
    });

    const oldAlert = await prisma.alert.create({
      data: {
        symbol: 'AAPL',
        strategy: 'PULLBACK',
        score: 81,
        message: 'Old alert',
        acknowledged: false,
        triggeredAt: new Date(Date.now() - 10_000),
      },
    });

    await prisma.alert.create({
      data: {
        symbol: 'AAPL',
        strategy: 'BREAKOUT',
        score: 90,
        message: 'New alert',
        acknowledged: true,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/alerts?acknowledged=false',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(oldAlert.id);

    const ackResponse = await app.inject({
      method: 'PUT',
      url: `/api/alerts/${oldAlert.id}/acknowledge`,
    });

    expect(ackResponse.statusCode).toBe(200);
    const ackBody = JSON.parse(ackResponse.body);
    expect(ackBody.data.acknowledged).toBe(true);
    expect(ackBody.data.acknowledgedAt).toBeTruthy();
  });

  it('lists and updates alert rules', async () => {
    const rule = await prisma.alertRule.create({
      data: {
        strategy: 'PULLBACK',
        enabled: true,
        params: JSON.stringify({ pullbackPercent: 2, rsiMin: 40, rsiMax: 50 }),
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/alerts/rules',
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].strategy).toBe('PULLBACK');
    expect(listBody.data[0].params.pullbackPercent).toBe(2);

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/alerts/rules/${rule.id}`,
      payload: {
        enabled: false,
        params: { pullbackPercent: 1.5 },
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const updateBody = JSON.parse(updateResponse.body);
    expect(updateBody.data.enabled).toBe(false);
    expect(updateBody.data.params.pullbackPercent).toBe(1.5);
  });

  it('evaluates pullback alerts and deduplicates within 24h', async () => {
    await prisma.stock.create({
      data: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', active: true },
    });

    await prisma.userSettings.create({
      data: {
        id: 'default',
        strategyPullback: true,
        strategyBreakout: true,
        strategyMacdCross: true,
        minScoreAlert: 0,
        pushEnabled: true,
        quietHoursEnabled: false,
      },
    });

    await prisma.alertRule.create({
      data: {
        strategy: 'PULLBACK',
        enabled: true,
        params: JSON.stringify({ pullbackPercent: 2, rsiMin: 40, rsiMax: 50 }),
      },
    });

    // Latest row triggers pullback:
    // - close > sma200
    // - close near sma50 (within 2%)
    // - rsi in [40, 50]
    // - resting volume vs avgVol20 and previous bar
    await prisma.stockData.createMany({
      data: [
        {
          symbol: 'AAPL',
          date: new Date('2026-02-08T12:00:00.000Z'),
          open: 101,
          high: 103,
          low: 100,
          close: 102,
          volume: 80,
          sma50: 100,
          sma200: 90,
          rsi14: 45,
          avgVol20: 100,
          score: 88,
        },
        {
          symbol: 'AAPL',
          date: new Date('2026-02-07T12:00:00.000Z'),
          open: 104,
          high: 105,
          low: 101,
          close: 103,
          volume: 130,
          sma50: 100,
          sma200: 89,
          rsi14: 55,
          avgVol20: 100,
          score: 86,
        },
      ],
    });

    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const firstRun = await evaluateAlerts(logger);
    expect(firstRun.createdAlerts).toBe(1);

    const secondRun = await evaluateAlerts(logger);
    expect(secondRun.createdAlerts).toBe(0);
    expect(secondRun.skippedDuplicates).toBeGreaterThanOrEqual(1);
  });
});
