import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';

const listAlertsQuerySchema = z.object({
  acknowledged: z.enum(['true', 'false', 'all']).default('all'),
  strategy: z.string().min(1).max(50).optional(),
  symbol: z.string().min(1).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const alertIdParamsSchema = z.object({
  id: z.string().min(1),
});

const ruleIdParamsSchema = z.object({
  id: z.string().min(1),
});

const updateRuleSchema = z
  .object({
    enabled: z.boolean().optional(),
    params: z.record(z.unknown()).optional(),
  })
  .refine((value) => value.enabled !== undefined || value.params !== undefined, {
    message: 'At least one field must be provided',
  });

function parseParams(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/alerts
  app.get(
    '/api/alerts',
    {
      schema: {
        querystring: listAlertsQuerySchema,
      },
    },
    async (request, reply) => {
      const { acknowledged, strategy, symbol, limit, offset } = request.query;

      const where: Record<string, unknown> = {};
      if (acknowledged !== 'all') where.acknowledged = acknowledged === 'true';
      if (strategy) where.strategy = strategy;
      if (symbol) where.symbol = symbol.toUpperCase();

      const [alerts, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          orderBy: { triggeredAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.alert.count({ where }),
      ]);

      return reply.send({
        data: alerts,
        meta: { total, limit, offset },
      });
    },
  );

  // PUT /api/alerts/:id/acknowledge
  app.put(
    '/api/alerts/:id/acknowledge',
    {
      schema: {
        params: alertIdParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const existing = await prisma.alert.findUnique({ where: { id } });

      if (!existing) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Alert "${id}" not found`,
          },
        });
      }

      const alert = await prisma.alert.update({
        where: { id },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
        },
      });

      return reply.send({ data: alert });
    },
  );

  // GET /api/alerts/rules
  app.get('/api/alerts/rules', async (_request, reply) => {
    const rules = await prisma.alertRule.findMany({
      orderBy: { strategy: 'asc' },
    });

    return reply.send({
      data: rules.map((rule) => ({
        ...rule,
        params: parseParams(rule.params),
      })),
    });
  });

  // PUT /api/alerts/rules/:id
  app.put(
    '/api/alerts/rules/:id',
    {
      schema: {
        params: ruleIdParamsSchema,
        body: updateRuleSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { enabled, params } = request.body;

      const existing = await prisma.alertRule.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Alert rule "${id}" not found`,
          },
        });
      }

      const updated = await prisma.alertRule.update({
        where: { id },
        data: {
          ...(enabled !== undefined ? { enabled } : {}),
          ...(params !== undefined ? { params: JSON.stringify(params) } : {}),
        },
      });

      return reply.send({
        data: {
          ...updated,
          params: parseParams(updated.params),
        },
      });
    },
  );
};
