import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';
import { quoteService } from '../services/QuoteService.js';

const listWatchlistQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

const createWatchlistItemSchema = z.object({
  symbol: z.string().min(1).max(20).transform((value) => value.toUpperCase().trim()),
  targetPriceHigh: z.number().positive().nullable().optional(),
  targetPriceLow: z.number().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const watchlistItemParamsSchema = z.object({
  id: z.string().min(1),
});

const reorderWatchlistSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

const updateWatchlistAlertSchema = z
  .object({
    targetPriceHigh: z.number().positive().nullable().optional(),
    targetPriceLow: z.number().positive().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (value) =>
      value.targetPriceHigh !== undefined ||
      value.targetPriceLow !== undefined ||
      value.notes !== undefined,
    { message: 'At least one field must be provided' },
  );

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const watchlistRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/watchlist
  app.get(
    '/api/watchlist',
    {
      schema: {
        querystring: listWatchlistQuerySchema,
      },
    },
    async (request, reply) => {
      const { limit, offset } = request.query;

      const [items, total] = await Promise.all([
        prisma.watchlistItem.findMany({
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          take: limit,
          skip: offset,
          include: {
            stock: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.watchlistItem.count(),
      ]);

      const symbols = items.map((item) => item.symbol);
      const latestData =
        symbols.length === 0
          ? []
          : await prisma.stockData.findMany({
              where: {
                symbol: {
                  in: symbols,
                },
              },
              distinct: ['symbol'],
              orderBy: {
                date: 'desc',
              },
              select: {
                symbol: true,
                close: true,
                score: true,
                changePct: true,
              },
            });

      const latestBySymbol = new Map(
        latestData.map((row) => [row.symbol, row] as const),
      );

      const data = items.map((item) => {
        const latest = latestBySymbol.get(item.symbol);
        return {
          id: item.id,
          symbol: item.symbol,
          name: item.stock.name,
          order: item.order,
          targetPriceHigh: item.targetPriceHigh,
          targetPriceLow: item.targetPriceLow,
          notes: item.notes,
          price: latest ? roundTo2(latest.close) : null,
          score: latest?.score ?? null,
          change: latest?.changePct != null ? roundTo2(latest.changePct) : null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });

      return reply.send({
        data,
        meta: {
          total,
          limit,
          offset,
        },
      });
    },
  );

  // POST /api/watchlist
  app.post(
    '/api/watchlist',
    {
      schema: {
        body: createWatchlistItemSchema,
      },
    },
    async (request, reply) => {
      const { symbol, targetPriceHigh, targetPriceLow, notes } = request.body;

      const existingItem = await prisma.watchlistItem.findUnique({
        where: { symbol },
      });
      if (existingItem) {
        return reply.code(409).send({
          error: {
            code: 'ALREADY_EXISTS',
            message: `Symbol "${symbol}" already exists in watchlist`,
          },
        });
      }

      const existingStock = await prisma.stock.findUnique({
        where: { symbol },
      });

      if (!existingStock) {
        const isValid = await quoteService.validateSymbol(symbol);
        if (!isValid) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: `Symbol "${symbol}" not found on Yahoo Finance`,
            },
          });
        }

        await prisma.stock.create({
          data: {
            symbol,
            name: symbol,
            market: symbol.includes('.') ? 'EU' : 'US',
            active: true,
          },
        });
      } else if (!existingStock.active) {
        await prisma.stock.update({
          where: { symbol },
          data: { active: true },
        });
      }

      const lastOrder = await prisma.watchlistItem.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const nextOrder = (lastOrder?.order ?? -1) + 1;

      const item = await prisma.watchlistItem.create({
        data: {
          symbol,
          order: nextOrder,
          targetPriceHigh: targetPriceHigh ?? null,
          targetPriceLow: targetPriceLow ?? null,
          notes: notes ?? null,
        },
        include: {
          stock: {
            select: {
              name: true,
            },
          },
        },
      });

      return reply.code(201).send({
        data: {
          id: item.id,
          symbol: item.symbol,
          name: item.stock.name,
          order: item.order,
          targetPriceHigh: item.targetPriceHigh,
          targetPriceLow: item.targetPriceLow,
          notes: item.notes,
          price: null,
          score: null,
          change: null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      });
    },
  );

  // DELETE /api/watchlist/:id
  app.delete(
    '/api/watchlist/:id',
    {
      schema: {
        params: watchlistItemParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existingItem = await prisma.watchlistItem.findUnique({
        where: { id },
      });
      if (!existingItem) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Watchlist item "${id}" not found`,
          },
        });
      }

      await prisma.watchlistItem.delete({
        where: { id },
      });

      return reply.code(204).send();
    },
  );

  // PUT /api/watchlist/reorder
  app.put(
    '/api/watchlist/reorder',
    {
      schema: {
        body: reorderWatchlistSchema,
      },
    },
    async (request, reply) => {
      const { ids } = request.body;

      const [existingItems, totalItems] = await Promise.all([
        prisma.watchlistItem.findMany({
          where: {
            id: {
              in: ids,
            },
          },
          select: {
            id: true,
          },
        }),
        prisma.watchlistItem.count(),
      ]);

      const idsAreCompleteAndUnique =
        existingItems.length === ids.length &&
        totalItems === ids.length &&
        new Set(ids).size === ids.length;

      if (!idsAreCompleteAndUnique) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Reorder payload must include every watchlist item exactly once',
          },
        });
      }

      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.watchlistItem.update({
            where: { id },
            data: { order: index },
          }),
        ),
      );

      return reply.send({
        data: {
          updated: ids.length,
        },
      });
    },
  );

  // PUT /api/watchlist/:id/alert
  app.put(
    '/api/watchlist/:id/alert',
    {
      schema: {
        params: watchlistItemParamsSchema,
        body: updateWatchlistAlertSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const existingItem = await prisma.watchlistItem.findUnique({
        where: { id },
      });
      if (!existingItem) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Watchlist item "${id}" not found`,
          },
        });
      }

      const item = await prisma.watchlistItem.update({
        where: { id },
        data: {
          ...(updates.targetPriceHigh !== undefined
            ? { targetPriceHigh: updates.targetPriceHigh }
            : {}),
          ...(updates.targetPriceLow !== undefined
            ? { targetPriceLow: updates.targetPriceLow }
            : {}),
          ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        },
        include: {
          stock: {
            select: {
              name: true,
            },
          },
        },
      });

      return reply.send({
        data: {
          id: item.id,
          symbol: item.symbol,
          name: item.stock.name,
          order: item.order,
          targetPriceHigh: item.targetPriceHigh,
          targetPriceLow: item.targetPriceLow,
          notes: item.notes,
          price: null,
          score: null,
          change: null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      });
    },
  );
};
