import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { ScreenerResult } from '../../shared/types.js';

const screenerQuerySchema = z.object({
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  minRsi: z.coerce.number().min(0).max(100).optional(),
  maxRsi: z.coerce.number().min(0).max(100).optional(),
  aboveSma50: z.enum(['true', 'false']).optional(),
  aboveSma200: z.enum(['true', 'false']).optional(),
  minVolume: z.coerce.number().min(0).optional(),
  market: z.enum(['US', 'EU', 'ALL']).default('ALL'),
  sortBy: z
    .enum(['score', 'symbol', 'rsi', 'volume', 'price', 'change'])
    .default('score'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

type Filters = z.infer<typeof screenerQuerySchema>;

// Sort key mapping to row accessor
type RowWithStock = Prisma.StockDataGetPayload<{
  include: { stock: { select: { name: true; market: true } } };
}>;

function getSortValue(row: RowWithStock, sortBy: string): number | string | null {
  switch (sortBy) {
    case 'score': return row.score;
    case 'symbol': return row.symbol;
    case 'rsi': return row.rsi14;
    case 'volume': return row.volumeRatio;
    case 'price': return row.close;
    case 'change': return row.changePct;
    default: return row.score;
  }
}

function buildWhereFilter(filters: Filters): Prisma.StockDataWhereInput {
  const where: Prisma.StockDataWhereInput = {
    stock: {
      active: true,
      ...(filters.market !== 'ALL' ? { market: filters.market } : {}),
    },
  };

  // Score filters
  if (filters.minScore !== undefined || filters.maxScore !== undefined) {
    where.score = {
      ...(filters.minScore !== undefined ? { gte: filters.minScore } : {}),
      ...(filters.maxScore !== undefined ? { lte: filters.maxScore } : {}),
    };
  }

  // RSI filters
  if (filters.minRsi !== undefined || filters.maxRsi !== undefined) {
    where.rsi14 = {
      ...(filters.minRsi !== undefined ? { gte: filters.minRsi } : {}),
      ...(filters.maxRsi !== undefined ? { lte: filters.maxRsi } : {}),
    };
  }

  // aboveSma50/200 - now stored as booleans
  if (filters.aboveSma50 !== undefined) {
    where.aboveSma50 = filters.aboveSma50 === 'true';
  }
  if (filters.aboveSma200 !== undefined) {
    where.aboveSma200 = filters.aboveSma200 === 'true';
  }

  // Volume ratio filter
  if (filters.minVolume !== undefined) {
    where.volumeRatio = { gte: filters.minVolume };
  }

  return where;
}

function mapRowToResult(row: RowWithStock): ScreenerResult {
  return {
    symbol: row.symbol,
    name: row.stock.name,
    market: row.stock.market as 'US' | 'EU',
    price: Math.round(row.close * 100) / 100,
    change: Math.round((row.changePct ?? 0) * 100) / 100,
    score: row.score,
    rsi: row.rsi14 != null ? Math.round(row.rsi14 * 100) / 100 : null,
    aboveSma50: row.aboveSma50 ?? false,
    aboveSma200: row.aboveSma200 ?? false,
    volume: row.volumeRatio != null ? Math.round(row.volumeRatio * 100) / 100 : null,
  };
}

export const screenerRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/api/screener',
    {
      schema: {
        querystring: screenerQuerySchema,
      },
    },
    async (request, reply) => {
      const filters = request.query;

      try {
        const where = buildWhereFilter(filters);

        // Get latest row per symbol using distinct
        // Prisma distinct + orderBy: date desc = latest row per symbol
        const allRows = await prisma.stockData.findMany({
          distinct: ['symbol'],
          where,
          orderBy: { date: 'desc' },
          include: { stock: { select: { name: true, market: true } } },
        });

        // Sort in memory (orderBy above is for getting latest row, not user sort)
        const dir = filters.sortOrder === 'asc' ? 1 : -1;
        allRows.sort((a, b) => {
          const va = getSortValue(a, filters.sortBy);
          const vb = getSortValue(b, filters.sortBy);
          // NULLs always last
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (va < vb) return -dir;
          if (va > vb) return dir;
          return 0;
        });

        // Paginate in memory
        const total = allRows.length;
        const paginated = allRows.slice(filters.offset, filters.offset + filters.limit);
        const data = paginated.map(mapRowToResult);

        return reply
          .header('X-Total-Count', String(total))
          .send({
            data,
            meta: {
              total,
              limit: filters.limit,
              offset: filters.offset,
            },
          });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        request.log.error({ error: message }, 'Screener query failed');
        return reply.code(500).send({
          error: {
            code: 'SCREENER_ERROR',
            message: 'Failed to execute screener query',
          },
        });
      }
    },
  );
};
