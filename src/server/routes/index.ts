import { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { portfolioRoutes } from './portfolio.js';
import { newsRoutes } from './news.js';
import { stocksRoutes } from './stocks.js';
import { screenerRoutes } from './screener.js';
import { universeRoutes } from './universe.js';
import { alertsRoutes } from './alerts.js';
import { settingsRoutes } from './settings.js';

export const registerRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(portfolioRoutes);
  await fastify.register(newsRoutes);
  await fastify.register(universeRoutes);
  await fastify.register(stocksRoutes);
  await fastify.register(screenerRoutes);
  await fastify.register(alertsRoutes);
  await fastify.register(settingsRoutes);
};
