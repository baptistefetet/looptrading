import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('Settings alerts endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.userSettings.deleteMany();
  });

  it('returns default alert settings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/settings/alerts',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.strategies.pullback).toBe(true);
    expect(body.data.strategies.breakout).toBe(true);
    expect(body.data.strategies.macdCross).toBe(true);
    expect(body.data.minScore).toBe(75);
    expect(body.data.pushNotifications).toBe(true);
  });

  it('updates alert settings', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/settings/alerts',
      payload: {
        strategies: {
          pullback: false,
          breakout: true,
          macdCross: false,
        },
        minScore: 82,
        pushNotifications: false,
        quietHours: {
          enabled: true,
          start: '21:30',
          end: '07:15',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.strategies.pullback).toBe(false);
    expect(body.data.strategies.breakout).toBe(true);
    expect(body.data.strategies.macdCross).toBe(false);
    expect(body.data.minScore).toBe(82);
    expect(body.data.pushNotifications).toBe(false);
    expect(body.data.quietHours.enabled).toBe(true);
    expect(body.data.quietHours.start).toBe('21:30');
    expect(body.data.quietHours.end).toBe('07:15');
  });

  it('rejects enabling quiet hours without start/end times', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/settings/alerts',
      payload: {
        quietHours: {
          enabled: true,
          start: null,
          end: null,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
