import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Health endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBe('0.1.0');
    expect(body.scheduler).toBeDefined();
    expect(body.scheduler.running).toBe(false);
  });

  it('should return 404 for unknown API routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/unknown',
    });

    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
