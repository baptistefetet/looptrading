import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // Health check
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

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
