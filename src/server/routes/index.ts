import { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';

export const registerRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
};
