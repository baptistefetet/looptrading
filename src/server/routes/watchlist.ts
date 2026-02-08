import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';

const listWatchlistQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

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
};
