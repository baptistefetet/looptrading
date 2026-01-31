import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';
import { newsService } from '../services/NewsService.js';
import type { NewsResponse } from '../../shared/types.js';

const symbolParams = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
});

const newsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const newsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/news - News for all watchlist symbols (or portfolio if no watchlist)
  app.get(
    '/api/news',
    {
      schema: {
        querystring: newsQuerySchema,
      },
    },
    async (request, reply) => {
      const { limit } = request.query;

      // Get symbols from watchlist, fallback to portfolio positions
      let symbols: string[] = [];

      const watchlist = await prisma.watchlistItem.findMany({
        select: { symbol: true },
      });
      if (watchlist.length > 0) {
        symbols = watchlist.map((w) => w.symbol);
      } else {
        const positions = await prisma.position.findMany({
          select: { symbol: true },
        });
        symbols = positions.map((p) => p.symbol);
      }

      if (symbols.length === 0) {
        const response: NewsResponse = {
          news: [],
          fetchedAt: new Date().toISOString(),
        };
        return reply.send({ data: response });
      }

      const news = await newsService.getNewsForSymbols(symbols, limit);
      const response: NewsResponse = {
        news,
        fetchedAt: new Date().toISOString(),
      };
      return reply.send({ data: response });
    }
  );

  // GET /api/news/:symbol - News for a specific symbol
  app.get(
    '/api/news/:symbol',
    {
      schema: {
        params: symbolParams,
        querystring: newsQuerySchema,
      },
    },
    async (request, reply) => {
      const { symbol } = request.params;
      const { limit } = request.query;

      const news = await newsService.getNewsBySymbol(symbol, limit);
      const response: NewsResponse = {
        symbol,
        news,
        fetchedAt: new Date().toISOString(),
      };
      return reply.send({ data: response });
    }
  );
};
