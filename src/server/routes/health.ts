import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  timestamp: z.string(),
  version: z.string(),
  scheduler: z.object({
    running: z.boolean(),
    lastRun: z.string().nullable(),
  }),
});

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/api/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const jobs = fastify.scheduler.getStatus();
      const lastRun = jobs
        .map((j) => j.lastRun)
        .filter(Boolean)
        .sort()
        .pop() ?? null;

      return reply.send({
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        scheduler: {
          running: fastify.scheduler.isRunning(),
          lastRun,
        },
      });
    }
  );
};
