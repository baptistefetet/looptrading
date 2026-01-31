import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SchedulerService } from '../services/SchedulerService.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    stock: {
      findMany: vi.fn(),
    },
    stockData: {
      count: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock MarketDataService
vi.mock('../services/MarketDataService.js', () => ({
  marketDataService: {
    getHistory: vi.fn(),
  },
}));

// Mock IndicatorService
vi.mock('../services/IndicatorService.js', () => ({
  indicatorService: {
    computeIndicators: vi.fn(),
  },
}));

// Mock marketHours
vi.mock('../utils/marketHours.js', () => ({
  isMarketOpen: vi.fn(),
}));

import { prisma } from '../lib/prisma.js';
import { marketDataService } from '../services/MarketDataService.js';
import { indicatorService } from '../services/IndicatorService.js';
import { isMarketOpen } from '../utils/marketHours.js';
import { registerUpdateMarketDataJob } from '../services/jobs/updateMarketData.js';

const mockIsMarketOpen = vi.mocked(isMarketOpen);
const mockFindMany = vi.mocked(prisma.stock.findMany);
const mockCount = vi.mocked(prisma.stockData.count);
const mockStockDataFindMany = vi.mocked(prisma.stockData.findMany);
const mockCreateMany = vi.mocked(prisma.stockData.createMany);
const mockUpsert = vi.mocked(prisma.stockData.upsert);
const mockGetHistory = vi.mocked(marketDataService.getHistory);
const mockComputeIndicators = vi.mocked(indicatorService.computeIndicators);

const silentLogger = {
  info: vi.fn(),
  error: vi.fn(),
};

/** Helper to set up mocks for a successful single-stock update */
function setupSuccessfulStockUpdate(overrides?: {
  count?: number;
  existingDates?: Date[];
}) {
  mockCount.mockResolvedValueOnce(overrides?.count ?? 300);
  mockStockDataFindMany.mockResolvedValueOnce(
    (overrides?.existingDates ?? []).map((d) => ({ date: d })) as any,
  );
  mockCreateMany.mockResolvedValueOnce({ count: 1 });
  mockUpsert.mockResolvedValueOnce({} as any);
  mockComputeIndicators.mockResolvedValueOnce(null);
}

describe('updateMarketData job', () => {
  let jobHandler: () => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture the handler registered with the scheduler
    const mockScheduler = {
      registerJob: vi.fn(),
    } as unknown as SchedulerService;

    registerUpdateMarketDataJob(mockScheduler, silentLogger);

    // Extract the handler passed to registerJob
    const registerCall = (mockScheduler.registerJob as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(registerCall[0]).toBe('updateMarketData');
    expect(registerCall[1]).toBe('*/15 * * * *');
    jobHandler = registerCall[2];
  });

  it('should register job with correct name and cron expression', () => {
    const mockScheduler = {
      registerJob: vi.fn(),
    } as unknown as SchedulerService;

    registerUpdateMarketDataJob(mockScheduler, silentLogger);

    expect(mockScheduler.registerJob).toHaveBeenCalledWith(
      'updateMarketData',
      '*/15 * * * *',
      expect.any(Function),
    );
  });

  it('should skip when markets are closed', async () => {
    mockIsMarketOpen.mockReturnValue({ us: false, eu: false });

    await jobHandler();

    expect(silentLogger.info).toHaveBeenCalledWith(
      '[updateMarketData] Skipped - markets closed',
    );
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('should query only US stocks when only US market is open', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });
    mockFindMany.mockResolvedValue([]);

    await jobHandler();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { active: true, market: { in: ['US'] } },
      select: { symbol: true, market: true },
    });
  });

  it('should query only EU stocks when only EU market is open', async () => {
    mockIsMarketOpen.mockReturnValue({ us: false, eu: true });
    mockFindMany.mockResolvedValue([]);

    await jobHandler();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { active: true, market: { in: ['EU'] } },
      select: { symbol: true, market: true },
    });
  });

  it('should query both US and EU stocks when both markets are open', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: true });
    mockFindMany.mockResolvedValue([]);

    await jobHandler();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { active: true, market: { in: ['US', 'EU'] } },
      select: { symbol: true, market: true },
    });
  });

  it('should log and return when no active stocks found', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });
    mockFindMany.mockResolvedValue([]);

    await jobHandler();

    expect(silentLogger.info).toHaveBeenCalledWith(
      '[updateMarketData] No active stocks to update',
    );
  });

  it('should fetch 1y history for stocks with < 200 existing bars (backfill)', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });
    mockFindMany.mockResolvedValue([
      { symbol: 'AAPL', market: 'US' },
    ] as any);
    mockCount.mockResolvedValue(50); // < 200
    mockGetHistory.mockResolvedValue({
      symbol: 'AAPL',
      period: '1y',
      bars: [
        { date: '2025-12-01', open: 150, high: 152, low: 149, close: 151, volume: 1000 },
      ],
      fetchedAt: new Date().toISOString(),
    });
    mockStockDataFindMany.mockResolvedValue([] as any);
    mockCreateMany.mockResolvedValue({ count: 1 });
    mockUpsert.mockResolvedValue({} as any);
    mockComputeIndicators.mockResolvedValue(null);

    await jobHandler();

    expect(mockGetHistory).toHaveBeenCalledWith('AAPL', '1y');
  });

  it('should fetch 1m history for stocks with >= 200 existing bars', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });
    mockFindMany.mockResolvedValue([
      { symbol: 'AAPL', market: 'US' },
    ] as any);
    mockCount.mockResolvedValue(250); // >= 200
    mockGetHistory.mockResolvedValue({
      symbol: 'AAPL',
      period: '1m',
      bars: [
        { date: '2026-01-15', open: 200, high: 202, low: 199, close: 201, volume: 2000 },
      ],
      fetchedAt: new Date().toISOString(),
    });
    mockStockDataFindMany.mockResolvedValue([] as any);
    mockCreateMany.mockResolvedValue({ count: 0 });
    mockUpsert.mockResolvedValue({} as any);
    mockComputeIndicators.mockResolvedValue(null);

    await jobHandler();

    expect(mockGetHistory).toHaveBeenCalledWith('AAPL', '1m');
  });

  it('should insert only new bars and upsert latest bar', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });
    mockFindMany.mockResolvedValue([
      { symbol: 'AAPL', market: 'US' },
    ] as any);
    mockCount.mockResolvedValue(300);
    mockGetHistory.mockResolvedValue({
      symbol: 'AAPL',
      period: '1m',
      bars: [
        { date: '2026-01-14', open: 198, high: 200, low: 197, close: 199, volume: 1500 },
        { date: '2026-01-15', open: 200, high: 202, low: 199, close: 201, volume: 2000 },
      ],
      fetchedAt: new Date().toISOString(),
    });
    // Simulate 2026-01-14 already exists in DB
    mockStockDataFindMany.mockResolvedValue([
      { date: new Date('2026-01-14') },
    ] as any);
    mockCreateMany.mockResolvedValue({ count: 1 });
    mockUpsert.mockResolvedValue({} as any);
    mockComputeIndicators.mockResolvedValue(null);

    await jobHandler();

    // Should only insert the new bar (2026-01-15)
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ symbol: 'AAPL', close: 201, date: new Date('2026-01-15') }),
      ],
    });

    // Should upsert the latest bar
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { symbol_date: { symbol: 'AAPL', date: new Date('2026-01-15') } },
      }),
    );

    // Should compute indicators
    expect(mockComputeIndicators).toHaveBeenCalledWith('AAPL');
  });

  it('should continue processing other stocks when one fails', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });
    mockFindMany.mockResolvedValue([
      { symbol: 'AAPL', market: 'US' },
      { symbol: 'MSFT', market: 'US' },
      { symbol: 'GOOGL', market: 'US' },
    ] as any);

    // AAPL fails
    mockCount.mockResolvedValueOnce(300);
    mockGetHistory.mockRejectedValueOnce(new Error('Yahoo API timeout'));

    // MSFT succeeds
    mockCount.mockResolvedValueOnce(300);
    mockGetHistory.mockResolvedValueOnce({
      symbol: 'MSFT',
      period: '1m',
      bars: [{ date: '2026-01-15', open: 400, high: 402, low: 399, close: 401, volume: 3000 }],
      fetchedAt: new Date().toISOString(),
    });
    mockStockDataFindMany.mockResolvedValueOnce([] as any);
    mockCreateMany.mockResolvedValueOnce({ count: 1 });
    mockUpsert.mockResolvedValueOnce({} as any);
    mockComputeIndicators.mockResolvedValueOnce(null);

    // GOOGL succeeds
    mockCount.mockResolvedValueOnce(300);
    mockGetHistory.mockResolvedValueOnce({
      symbol: 'GOOGL',
      period: '1m',
      bars: [{ date: '2026-01-15', open: 170, high: 172, low: 169, close: 171, volume: 2500 }],
      fetchedAt: new Date().toISOString(),
    });
    mockStockDataFindMany.mockResolvedValueOnce([] as any);
    mockCreateMany.mockResolvedValueOnce({ count: 1 });
    mockUpsert.mockResolvedValueOnce({} as any);
    mockComputeIndicators.mockResolvedValueOnce(null);

    await jobHandler();

    // Should log the AAPL failure
    expect(silentLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed: AAPL'),
    );

    // Should still process MSFT and GOOGL
    expect(mockComputeIndicators).toHaveBeenCalledWith('MSFT');
    expect(mockComputeIndicators).toHaveBeenCalledWith('GOOGL');

    // Should log final stats: 2 success, 1 failed
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('2 success, 1 failed'),
    );
  });

  it('should log progress milestones', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });

    // Create 10 stocks to hit the 10% milestone at stock 1, 50% at 5, 100% at 10
    const stocks = Array.from({ length: 10 }, (_, i) => ({
      symbol: `STOCK${i}`,
      market: 'US',
    }));
    mockFindMany.mockResolvedValue(stocks as any);

    mockCount.mockResolvedValue(300);
    mockGetHistory.mockResolvedValue({
      symbol: 'STOCK',
      period: '1m',
      bars: [{ date: '2026-01-15', open: 100, high: 102, low: 99, close: 101, volume: 1000 }],
      fetchedAt: new Date().toISOString(),
    });
    mockStockDataFindMany.mockResolvedValue([] as any);
    mockCreateMany.mockResolvedValue({ count: 1 });
    mockUpsert.mockResolvedValue({} as any);
    mockComputeIndicators.mockResolvedValue(null);

    await jobHandler();

    const infoMessages = silentLogger.info.mock.calls.map((c: unknown[]) => c[0]);
    expect(infoMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Progress: 10%'),
        expect.stringContaining('Progress: 50%'),
        expect.stringContaining('Progress: 100%'),
      ]),
    );
  });

  it('should skip stock with empty history bars', async () => {
    mockIsMarketOpen.mockReturnValue({ us: true, eu: false });
    mockFindMany.mockResolvedValue([
      { symbol: 'EMPTY', market: 'US' },
    ] as any);
    mockCount.mockResolvedValue(300);
    mockGetHistory.mockResolvedValue({
      symbol: 'EMPTY',
      period: '1m',
      bars: [],
      fetchedAt: new Date().toISOString(),
    });

    await jobHandler();

    // Should not attempt to insert or compute
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockComputeIndicators).not.toHaveBeenCalled();

    // Should still count as success
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('1 success, 0 failed'),
    );
  });
});
