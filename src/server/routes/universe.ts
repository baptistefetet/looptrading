import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';
import { marketDataService } from '../services/MarketDataService.js';
import { quoteService } from '../services/QuoteService.js';

const MAX_ACTIVE_STOCKS = 500;

// ============================================
// Zod Schemas
// ============================================

const addStockSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
  market: z.enum(['US', 'EU']).optional(),
  sector: z.string().max(100).optional(),
});

const deleteStockParams = z.object({
  symbol: z.string().min(1).max(20),
});

const listQuerySchema = z.object({
  market: z.enum(['US', 'EU', 'ALL']).default('ALL'),
  active: z.enum(['true', 'false', 'all']).default('true'),
  search: z.string().max(50).optional(),
  sortBy: z.enum(['symbol', 'name', 'market', 'sector', 'createdAt']).default('symbol'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================
// Routes
// ============================================

export const universeRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/stocks - List universe
  app.get(
    '/api/stocks',
    {
      schema: {
        querystring: listQuerySchema,
      },
    },
    async (request, reply) => {
      const { market, active, search, sortBy, sortOrder, limit, offset } =
        request.query;

      // Build where clause
      const where: Record<string, unknown> = {};

      if (market !== 'ALL') {
        where.market = market;
      }
      if (active !== 'all') {
        where.active = active === 'true';
      }
      if (search) {
        where.OR = [
          { symbol: { contains: search.toUpperCase() } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [stocks, total] = await Promise.all([
        prisma.stock.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
        }),
        prisma.stock.count({ where }),
      ]);

      return reply.send({
        data: stocks,
        meta: { total, limit, offset },
      });
    }
  );

  // POST /api/stocks - Add a stock to universe
  app.post(
    '/api/stocks',
    {
      schema: {
        body: addStockSchema,
      },
    },
    async (request, reply) => {
      const { symbol, market, sector } = request.body;

      // Check if stock already exists
      const existing = await prisma.stock.findUnique({
        where: { symbol },
      });

      if (existing) {
        // If it exists but is inactive, reactivate it
        if (!existing.active) {
          const reactivated = await prisma.stock.update({
            where: { symbol },
            data: { active: true },
          });
          return reply.send({ data: reactivated });
        }
        return reply.code(409).send({
          error: {
            code: 'ALREADY_EXISTS',
            message: `Stock "${symbol}" already exists in the universe`,
          },
        });
      }

      // Check 500-stock limit
      const activeCount = await prisma.stock.count({
        where: { active: true },
      });
      if (activeCount >= MAX_ACTIVE_STOCKS) {
        return reply.code(400).send({
          error: {
            code: 'LIMIT_REACHED',
            message: `Cannot add more stocks. Active limit is ${MAX_ACTIVE_STOCKS} (currently ${activeCount})`,
          },
        });
      }

      // Auto-detect market if not provided
      const detectedMarket = market ?? marketDataService.detectMarket(symbol);

      // Try to fetch name and sector from Yahoo Finance
      let name = symbol;
      let fetchedSector = sector;
      try {
        const quote = await marketDataService.getQuote(symbol);
        name = quote.name || symbol;
      } catch {
        // Symbol might not exist on Yahoo Finance
        const isValid = await quoteService.validateSymbol(symbol);
        if (!isValid) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_SYMBOL',
              message: `Symbol "${symbol}" not found on Yahoo Finance`,
            },
          });
        }
      }

      const stock = await prisma.stock.create({
        data: {
          symbol,
          name,
          market: detectedMarket,
          sector: fetchedSector ?? null,
          active: true,
        },
      });

      return reply.code(201).send({ data: stock });
    }
  );

  // DELETE /api/stocks/:symbol - Remove stock from universe (soft delete)
  app.delete(
    '/api/stocks/:symbol',
    {
      schema: {
        params: deleteStockParams,
      },
    },
    async (request, reply) => {
      const symbol = request.params.symbol.toUpperCase();

      const existing = await prisma.stock.findUnique({
        where: { symbol },
      });

      if (!existing) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Stock "${symbol}" not found`,
          },
        });
      }

      // Soft delete: set active = false
      await prisma.stock.update({
        where: { symbol },
        data: { active: false },
      });

      return reply.code(204).send();
    }
  );
};
