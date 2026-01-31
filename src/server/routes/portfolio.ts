import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';
import { quoteService } from '../services/QuoteService.js';
import type { PositionWithPnL, PortfolioSummary } from '../../shared/types.js';

// ============================================
// Zod Schemas
// ============================================

const createPositionSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  quantity: z.number().positive('Quantity must be greater than 0'),
  avgCost: z.number().positive('Average cost must be greater than 0'),
  dateAcquired: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

const updatePositionSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()).optional(),
  quantity: z.number().positive('Quantity must be greater than 0').optional(),
  avgCost: z.number().positive('Average cost must be greater than 0').optional(),
  dateAcquired: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const positionIdParams = z.object({
  id: z.string().min(1),
});

// ============================================
// Helper: Enrich positions with P&L
// ============================================

async function enrichPositionsWithPnL(
  positions: Array<{
    id: string;
    symbol: string;
    quantity: number;
    avgCost: number;
    dateAcquired: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>
): Promise<PortfolioSummary> {
  if (positions.length === 0) {
    return {
      positions: [],
      totalValue: 0,
      totalCost: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
    };
  }

  const symbols = [...new Set(positions.map((p) => p.symbol))];
  const quotes = await quoteService.getQuotes(symbols);

  let totalValue = 0;
  let totalCost = 0;

  const enriched: PositionWithPnL[] = positions.map((pos) => {
    const quote = quotes.get(pos.symbol);
    const currentPrice = quote?.price ?? 0;
    const marketValue = currentPrice * pos.quantity;
    const cost = pos.avgCost * pos.quantity;
    const unrealizedPnL = marketValue - cost;
    const unrealizedPnLPercent =
      pos.avgCost > 0 ? ((currentPrice - pos.avgCost) / pos.avgCost) * 100 : 0;

    totalValue += marketValue;
    totalCost += cost;

    return {
      id: pos.id,
      symbol: pos.symbol,
      quantity: pos.quantity,
      avgCost: pos.avgCost,
      dateAcquired: pos.dateAcquired ?? undefined,
      notes: pos.notes ?? undefined,
      createdAt: pos.createdAt,
      updatedAt: pos.updatedAt,
      currentPrice,
      marketValue: Math.round(marketValue * 100) / 100,
      unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
      unrealizedPnLPercent: Math.round(unrealizedPnLPercent * 100) / 100,
    };
  });

  const totalPnL = totalValue - totalCost;
  const totalPnLPercent =
    totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  return {
    positions: enriched,
    totalValue: Math.round(totalValue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalPnL: Math.round(totalPnL * 100) / 100,
    totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
  };
}

// ============================================
// Routes
// ============================================

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/portfolio/positions - List all positions with P&L
  app.get(
    '/api/portfolio/positions',
    {},
    async (_request, reply) => {
      const positions = await prisma.position.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const summary = await enrichPositionsWithPnL(positions);
      return reply.send({ data: summary });
    }
  );

  // POST /api/portfolio/positions - Add a position
  app.post(
    '/api/portfolio/positions',
    {
      schema: {
        body: createPositionSchema,
      },
    },
    async (request, reply) => {
      const { symbol, quantity, avgCost, dateAcquired, notes } = request.body;

      // Verify the stock exists in our universe
      const stock = await prisma.stock.findUnique({ where: { symbol } });
      if (!stock) {
        // Validate symbol exists on Yahoo Finance
        const isValid = await quoteService.validateSymbol(symbol);
        if (!isValid) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: `Symbol "${symbol}" not found on Yahoo Finance`,
            },
          });
        }

        // Auto-create the stock in our universe
        await prisma.stock.create({
          data: {
            symbol,
            name: symbol, // Will be enriched later by MarketDataService
            market: symbol.includes('.') ? 'EU' : 'US',
            active: true,
          },
        });
      }

      const position = await prisma.position.create({
        data: {
          symbol,
          quantity,
          avgCost,
          dateAcquired: dateAcquired ? new Date(dateAcquired) : null,
          notes: notes ?? null,
        },
      });

      // Return enriched position with P&L
      const summary = await enrichPositionsWithPnL([position]);
      return reply.code(201).send({ data: summary.positions[0] });
    }
  );

  // PUT /api/portfolio/positions/:id - Update a position
  app.put(
    '/api/portfolio/positions/:id',
    {
      schema: {
        params: positionIdParams,
        body: updatePositionSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      // Check position exists
      const existing = await prisma.position.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Position "${id}" not found`,
          },
        });
      }

      // If symbol is being changed, validate it
      if (updates.symbol && updates.symbol !== existing.symbol) {
        const stock = await prisma.stock.findUnique({
          where: { symbol: updates.symbol },
        });
        if (!stock) {
          const isValid = await quoteService.validateSymbol(updates.symbol);
          if (!isValid) {
            return reply.code(400).send({
              error: {
                code: 'VALIDATION_ERROR',
                message: `Symbol "${updates.symbol}" not found on Yahoo Finance`,
              },
            });
          }
          await prisma.stock.create({
            data: {
              symbol: updates.symbol,
              name: updates.symbol,
              market: updates.symbol.includes('.') ? 'EU' : 'US',
              active: true,
            },
          });
        }
      }

      const position = await prisma.position.update({
        where: { id },
        data: {
          ...(updates.symbol !== undefined && { symbol: updates.symbol }),
          ...(updates.quantity !== undefined && { quantity: updates.quantity }),
          ...(updates.avgCost !== undefined && { avgCost: updates.avgCost }),
          ...(updates.dateAcquired !== undefined && {
            dateAcquired: updates.dateAcquired
              ? new Date(updates.dateAcquired)
              : null,
          }),
          ...(updates.notes !== undefined && { notes: updates.notes }),
        },
      });

      const summary = await enrichPositionsWithPnL([position]);
      return reply.send({ data: summary.positions[0] });
    }
  );

  // DELETE /api/portfolio/positions/:id - Delete a position
  app.delete(
    '/api/portfolio/positions/:id',
    {
      schema: {
        params: positionIdParams,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.position.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Position "${id}" not found`,
          },
        });
      }

      await prisma.position.delete({ where: { id } });
      return reply.code(204).send();
    }
  );
};
