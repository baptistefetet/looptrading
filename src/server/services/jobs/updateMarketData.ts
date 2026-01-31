import { prisma } from '../../lib/prisma.js';
import { marketDataService } from '../MarketDataService.js';
import type { HistoryPeriod } from '../MarketDataService.js';
import { indicatorService } from '../IndicatorService.js';
import { isMarketOpen } from '../../utils/marketHours.js';
import type { SchedulerService } from '../SchedulerService.js';

type Logger = {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const PROGRESS_MILESTONES = [10, 50, 100];
const BACKFILL_THRESHOLD = 200;

/**
 * Register the updateMarketData job in the scheduler.
 * Runs every 15 minutes, only during market hours.
 */
export function registerUpdateMarketDataJob(
  scheduler: SchedulerService,
  logger: Logger,
): void {
  scheduler.registerJob('updateMarketData', '*/15 * * * *', () =>
    updateMarketData(logger),
  );
}

/**
 * Main job: update prices and indicators for all active stocks.
 */
async function updateMarketData(logger: Logger): Promise<void> {
  const markets = isMarketOpen();
  if (!markets.us && !markets.eu) {
    logger.info('[updateMarketData] Skipped - markets closed');
    return;
  }

  // Filter stocks by which markets are currently open
  const openMarkets: string[] = [];
  if (markets.us) openMarkets.push('US');
  if (markets.eu) openMarkets.push('EU');

  const stocks = await prisma.stock.findMany({
    where: { active: true, market: { in: openMarkets } },
    select: { symbol: true, market: true },
  });

  if (stocks.length === 0) {
    logger.info('[updateMarketData] No active stocks to update');
    return;
  }

  const start = Date.now();
  logger.info(
    `[updateMarketData] Starting update for ${stocks.length} stocks (markets: ${openMarkets.join(', ')})`,
  );

  let success = 0;
  let failed = 0;
  let lastMilestone = 0;

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    try {
      await updateSingleStock(stock.symbol);
      success++;
    } catch (error) {
      failed++;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[updateMarketData] Failed: ${stock.symbol} - ${msg}`);
    }

    // Progress logging at milestones
    const pct = Math.round(((i + 1) / stocks.length) * 100);
    for (const milestone of PROGRESS_MILESTONES) {
      if (pct >= milestone && lastMilestone < milestone) {
        logger.info(
          `[updateMarketData] Progress: ${milestone}% (${i + 1}/${stocks.length})`,
        );
        lastMilestone = milestone;
      }
    }
  }

  const duration = Date.now() - start;
  logger.info(
    `[updateMarketData] Done: ${success} success, ${failed} failed, ${duration}ms total`,
  );
}

/**
 * Update a single stock: fetch history, upsert OHLCV bars, recompute indicators.
 */
async function updateSingleStock(symbol: string): Promise<void> {
  const upperSymbol = symbol.toUpperCase();

  // Check if we need a full backfill or just recent data
  const existingCount = await prisma.stockData.count({
    where: { symbol: upperSymbol },
  });
  const period: HistoryPeriod = existingCount < BACKFILL_THRESHOLD ? '1y' : '1m';

  // Fetch OHLCV history from Yahoo Finance
  const history = await marketDataService.getHistory(upperSymbol, period);

  if (history.bars.length === 0) return;

  // Prepare bar data for DB
  const bars = history.bars.map((bar) => ({
    symbol: upperSymbol,
    date: new Date(bar.date),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));

  // Find which dates already exist to avoid duplicates
  const existingDates = await prisma.stockData.findMany({
    where: {
      symbol: upperSymbol,
      date: { in: bars.map((b) => b.date) },
    },
    select: { date: true },
  });

  const existingDateSet = new Set(
    existingDates.map((d) => d.date.toISOString()),
  );

  // Insert only new bars
  const newBars = bars.filter(
    (b) => !existingDateSet.has(b.date.toISOString()),
  );
  if (newBars.length > 0) {
    await prisma.stockData.createMany({ data: newBars });
  }

  // Upsert the latest bar (intraday data may have changed)
  const latestBar = bars[bars.length - 1];
  await prisma.stockData.upsert({
    where: {
      symbol_date: { symbol: upperSymbol, date: latestBar.date },
    },
    create: latestBar,
    update: {
      open: latestBar.open,
      high: latestBar.high,
      low: latestBar.low,
      close: latestBar.close,
      volume: latestBar.volume,
    },
  });

  // Recompute all indicators with updated data
  await indicatorService.computeIndicators(upperSymbol);
}
