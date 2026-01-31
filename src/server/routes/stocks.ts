import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { marketDataService } from '../services/MarketDataService.js';
import type { HistoryPeriod } from '../services/MarketDataService.js';

const symbolParams = z.object({
  symbol: z.string().min(1).max(20),
});

const historyQuerySchema = z.object({
  period: z.enum(['1d', '1w', '1m', '3m', '1y']).default('3m'),
});

export const stocksRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/stocks/:symbol/quote
  app.get(
    '/api/stocks/:symbol/quote',
    {
      schema: {
        params: symbolParams,
      },
    },
    async (request, reply) => {
      const { symbol } = request.params;

      try {
        const quote = await marketDataService.getQuote(symbol);
        return reply.send({ data: quote });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        request.log.error({ symbol, error: message }, 'Failed to fetch quote');
        return reply.code(502).send({
          error: {
            code: 'MARKET_DATA_ERROR',
            message: `Failed to fetch quote for ${symbol.toUpperCase()}`,
          },
        });
      }
    }
  );

  // GET /api/stocks/:symbol/history
  app.get(
    '/api/stocks/:symbol/history',
    {
      schema: {
        params: symbolParams,
        querystring: historyQuerySchema,
      },
    },
    async (request, reply) => {
      const { symbol } = request.params;
      const { period } = request.query;

      try {
        const history = await marketDataService.getHistory(symbol, period as HistoryPeriod);
        return reply.send({ data: history });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        request.log.error({ symbol, period, error: message }, 'Failed to fetch history');
        return reply.code(502).send({
          error: {
            code: 'MARKET_DATA_ERROR',
            message: `Failed to fetch history for ${symbol.toUpperCase()}`,
          },
        });
      }
    }
  );
};
