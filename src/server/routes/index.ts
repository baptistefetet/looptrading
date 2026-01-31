import { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { portfolioRoutes } from './portfolio.js';
import { newsRoutes } from './news.js';

export const registerRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(portfolioRoutes);
  await fastify.register(newsRoutes);
};
