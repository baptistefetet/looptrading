import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
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

// Column mappings for ORDER BY (hardcoded, not user-controlled)
const SORT_COLUMN_MAP: Record<string, string> = {
  score: 'sd.score',
  symbol: 'sd.symbol',
  rsi: 'sd.rsi14',
  volume: 'vol_ratio',
  price: 'sd.close',
  change: 'change_pct',
};

interface RawScreenerRow {
  symbol: string;
  name: string;
  market: string;
  close: number;
  prev_close: number | null;
  score: number | null;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  volume: number;
  avgVol20: number | null;
  vol_ratio: number | null;
  change_pct: number | null;
}

function buildWhereClause(
  filters: z.infer<typeof screenerQuerySchema>,
): { clause: string; params: unknown[] } {
  const conditions: string[] = ['s.active = 1'];
  const params: unknown[] = [];

  if (filters.market !== 'ALL') {
    conditions.push('s.market = ?');
    params.push(filters.market);
  }

  if (filters.minScore !== undefined) {
    conditions.push('sd.score >= ?');
    params.push(filters.minScore);
  }
  if (filters.maxScore !== undefined) {
    conditions.push('sd.score <= ?');
    params.push(filters.maxScore);
  }

  if (filters.minRsi !== undefined) {
    conditions.push('sd.rsi14 >= ?');
    params.push(filters.minRsi);
  }
  if (filters.maxRsi !== undefined) {
    conditions.push('sd.rsi14 <= ?');
    params.push(filters.maxRsi);
  }

  if (filters.aboveSma50 === 'true') {
    conditions.push('sd.sma50 IS NOT NULL AND sd.close > sd.sma50');
  } else if (filters.aboveSma50 === 'false') {
    conditions.push('sd.sma50 IS NOT NULL AND sd.close <= sd.sma50');
  }

  if (filters.aboveSma200 === 'true') {
    conditions.push('sd.sma200 IS NOT NULL AND sd.close > sd.sma200');
  } else if (filters.aboveSma200 === 'false') {
    conditions.push('sd.sma200 IS NOT NULL AND sd.close <= sd.sma200');
  }

  if (filters.minVolume !== undefined) {
    conditions.push(
      'sd.avgVol20 IS NOT NULL AND sd.avgVol20 > 0 AND (sd.volume / sd.avgVol20) >= ?',
    );
    params.push(filters.minVolume);
  }

  return { clause: conditions.join(' AND '), params };
}

const JOINS = `
  FROM StockData sd
  JOIN Stock s ON sd.symbol = s.symbol
  LEFT JOIN StockData prev ON prev.symbol = sd.symbol
    AND prev.date = (
      SELECT MAX(sd3.date) FROM StockData sd3
      WHERE sd3.symbol = sd.symbol AND sd3.date < sd.date
    )
  WHERE sd.date = (SELECT MAX(sd2.date) FROM StockData sd2 WHERE sd2.symbol = sd.symbol)
`;

const JOINS_NO_PREV = `
  FROM StockData sd
  JOIN Stock s ON sd.symbol = s.symbol
  WHERE sd.date = (SELECT MAX(sd2.date) FROM StockData sd2 WHERE sd2.symbol = sd.symbol)
`;

const COMPUTED_COLUMNS = `
  CASE WHEN sd.avgVol20 IS NOT NULL AND sd.avgVol20 > 0
    THEN sd.volume / sd.avgVol20 ELSE NULL END AS vol_ratio,
  CASE
    WHEN prev.close IS NOT NULL AND prev.close > 0
    THEN ((sd.close - prev.close) / prev.close) * 100
    ELSE 0
  END AS change_pct
`;

function mapRowToResult(row: RawScreenerRow): ScreenerResult {
  return {
    symbol: row.symbol,
    name: row.name,
    market: row.market as 'US' | 'EU',
    price: Math.round(row.close * 100) / 100,
    change: Math.round((row.change_pct ?? 0) * 100) / 100,
    score: row.score,
    rsi: row.rsi14 != null ? Math.round(row.rsi14 * 100) / 100 : null,
    aboveSma50: row.sma50 != null && row.close > row.sma50,
    aboveSma200: row.sma200 != null && row.close > row.sma200,
    volume: row.vol_ratio != null ? Math.round(row.vol_ratio * 100) / 100 : null,
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
        const { clause, params } = buildWhereClause(filters);

        const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'sd.score';
        const sortDir = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
        // Push NULLs to end regardless of sort direction
        const nullSort = filters.sortOrder === 'asc'
          ? `CASE WHEN ${sortColumn} IS NULL THEN 1 ELSE 0 END ASC`
          : `CASE WHEN ${sortColumn} IS NULL THEN 1 ELSE 0 END ASC`;

        const dataSql = `
          SELECT
            sd.symbol, s.name, s.market,
            sd.close, prev.close AS prev_close,
            sd.score, sd.rsi14, sd.sma50, sd.sma200,
            sd.volume, sd.avgVol20,
            ${COMPUTED_COLUMNS}
          ${JOINS}
            AND ${clause}
          ORDER BY ${nullSort}, ${sortColumn} ${sortDir}
          LIMIT ? OFFSET ?
        `;

        const countSql = `
          SELECT COUNT(*) AS total
          ${JOINS_NO_PREV}
            AND ${clause}
        `;

        const dataParams = [...params, filters.limit, filters.offset];
        const countParams = [...params];

        const [rows, countResult] = await Promise.all([
          prisma.$queryRawUnsafe<RawScreenerRow[]>(dataSql, ...dataParams),
          prisma.$queryRawUnsafe<{ total: bigint }[]>(countSql, ...countParams),
        ]);

        const total = Number(countResult[0]?.total ?? 0);
        const data = rows.map(mapRowToResult);

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
