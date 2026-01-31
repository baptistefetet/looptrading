import { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { portfolioRoutes } from './portfolio.js';

export const registerRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(portfolioRoutes);
};
