import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';
import yahooFinance from '../lib/yahooFinance.js';
import { marketDataService } from '../services/MarketDataService.js';
import { quoteService } from '../services/QuoteService.js';

const MAX_ACTIVE_STOCKS = 500;
const YAHOO_SEARCH_TIMEOUT_MS = 5000;

type YahooSearchItem = {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
};

type YahooSearchApiResponse = {
  quotes?: Array<{
    symbol?: unknown;
    shortname?: unknown;
    longname?: unknown;
    exchange?: unknown;
    quoteType?: unknown;
  }>;
};

function normalizeYahooQuotes(rawQuotes: YahooSearchApiResponse['quotes']): YahooSearchItem[] {
  return (rawQuotes ?? [])
    .map((quote) => ({
      symbol:
        typeof quote.symbol === 'string'
          ? quote.symbol.toUpperCase().trim()
          : '',
      name:
        typeof quote.shortname === 'string'
          ? quote.shortname
          : typeof quote.longname === 'string'
            ? quote.longname
            : '',
      exchange:
        typeof quote.exchange === 'string'
          ? quote.exchange
          : null,
      type:
        typeof quote.quoteType === 'string'
          ? quote.quoteType
          : null,
    }))
    .filter((quote) => quote.symbol.length > 0);
}

async function searchYahooDirect(query: string, limit: number): Promise<YahooSearchItem[]> {
  const url = new URL('https://query2.finance.yahoo.com/v1/finance/search');
  url.searchParams.set('q', query);
  url.searchParams.set('quotesCount', String(limit));
  url.searchParams.set('newsCount', '0');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    signal: AbortSignal.timeout(YAHOO_SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Yahoo direct search failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as YahooSearchApiResponse;
  return normalizeYahooQuotes(payload.quotes);
}

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

const yahooSearchQuerySchema = z.object({
  q: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

// ============================================
// Routes
// ============================================

export const universeRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/stocks/yahoo-search - Search symbols on Yahoo Finance
  app.get(
    '/api/stocks/yahoo-search',
    {
      schema: {
        querystring: yahooSearchQuerySchema,
      },
    },
    async (request, reply) => {
      const { q, limit } = request.query;
      const query = q.trim();
      const normalizedQuery = query.toUpperCase();

      const buildResultWithUniverseFlags = async (
        items: Array<{
          symbol: string;
          name: string;
          market: 'US' | 'EU';
          exchange: string | null;
          type: string | null;
        }>,
      ) => {
        const symbols = [...new Set(items.map((item) => item.symbol))];
        const existing = symbols.length
          ? await prisma.stock.findMany({
              where: {
                symbol: {
                  in: symbols,
                },
              },
              select: {
                symbol: true,
                active: true,
              },
            })
          : [];

        const existingBySymbol = new Map(
          existing.map((stock) => [stock.symbol, stock] as const),
        );

        return items.map((item) => {
          const current = existingBySymbol.get(item.symbol);
          return {
            symbol: item.symbol,
            name: item.name || item.symbol,
            market: item.market,
            exchange: item.exchange,
            type: item.type,
            inUniverse: Boolean(current),
            active: current?.active ?? null,
          };
        });
      };

      let yahooItems: YahooSearchItem[] = [];

      try {
        const result = await yahooFinance.search(query, {
          quotesCount: limit,
          newsCount: 0,
        });
        yahooItems = normalizeYahooQuotes(result.quotes as YahooSearchApiResponse['quotes']);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        request.log.warn(
          { q: query, error: message },
          'yahoo-finance2 search failed, trying direct Yahoo endpoint',
        );
      }

      if (yahooItems.length === 0) {
        try {
          yahooItems = await searchYahooDirect(query, limit);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          request.log.warn({ q: query, error: message }, 'Yahoo direct search failed, using fallback');
        }
      }

      if (yahooItems.length > 0) {
        const data = await buildResultWithUniverseFlags(
          yahooItems.map((item) => ({
            ...item,
            market: item.symbol.includes('.') ? 'EU' : 'US',
          })),
        );
        return reply.send({ data });
      }

      const localStocks = await prisma.stock.findMany({
        where: {
          OR: [
            { symbol: { contains: normalizedQuery } },
            { name: { contains: query } },
          ],
        },
        orderBy: { symbol: 'asc' },
        take: limit,
        select: {
          symbol: true,
          name: true,
          market: true,
          active: true,
        },
      });

      const fallbackItems: Array<{
        symbol: string;
        name: string;
        market: 'US' | 'EU';
        exchange: string | null;
        type: string | null;
      }> = localStocks.map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market === 'EU' ? 'EU' : 'US',
        exchange: null,
        type: 'EQUITY',
      }));

      const tickerLike = /^[A-Z0-9.\-]{1,20}$/.test(normalizedQuery);
      if (tickerLike) {
        try {
          const quote = await marketDataService.getQuote(normalizedQuery);
          if (!fallbackItems.some((item) => item.symbol === quote.symbol)) {
            fallbackItems.unshift({
              symbol: quote.symbol,
              name: quote.name || quote.symbol,
              market: quote.symbol.includes('.') ? 'EU' : 'US',
              exchange: quote.exchange || null,
              type: 'EQUITY',
            });
          }
        } catch {
          // Ignore direct quote fallback errors
        }
      }

      const data = await buildResultWithUniverseFlags(fallbackItems.slice(0, limit));
      return reply.send({ data });
    },
  );

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
          { name: { contains: search } },
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
