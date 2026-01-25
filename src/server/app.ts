import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import path from 'path';
import { loggerConfig } from './config/logger.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: loggerConfig,
  });

  // Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register API routes
  await app.register(registerRoutes);

  // Serve React build (always - same behavior in dev and prod)
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'dist/client'),
    prefix: '/',
  });

  // SPA fallback - serve index.html for all non-API routes
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'API endpoint not found',
        },
      });
    } else {
      reply.sendFile('index.html');
    }
  });

  return app;
}
