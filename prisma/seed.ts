import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample stocks (US market)
  const usStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', sector: 'Consumer Cyclical' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US', sector: 'Technology' },
    { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', sector: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', sector: 'Consumer Cyclical' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US', sector: 'Financial Services' },
    { symbol: 'V', name: 'Visa Inc.', market: 'US', sector: 'Financial Services' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'US', sector: 'Healthcare' },
  ];

  // Create sample stocks (EU market)
  const euStocks = [
    { symbol: 'MC.PA', name: 'LVMH Moët Hennessy', market: 'EU', sector: 'Consumer Cyclical' },
    { symbol: 'OR.PA', name: "L'Oréal S.A.", market: 'EU', sector: 'Consumer Defensive' },
    { symbol: 'SAP.DE', name: 'SAP SE', market: 'EU', sector: 'Technology' },
    { symbol: 'ASML.AS', name: 'ASML Holding N.V.', market: 'EU', sector: 'Technology' },
    { symbol: 'SAN.PA', name: 'Sanofi S.A.', market: 'EU', sector: 'Healthcare' },
  ];

  // Upsert all stocks
  for (const stock of [...usStocks, ...euStocks]) {
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {},
      create: stock,
    });
  }

  console.log(`Created ${usStocks.length + euStocks.length} stocks`);

  // Create sample watchlist items
  const watchlistItems = [
    { symbol: 'AAPL', order: 0, targetPriceHigh: 200, targetPriceLow: 170, notes: 'Core holding' },
    { symbol: 'NVDA', order: 1, targetPriceHigh: 150, targetPriceLow: 100, notes: 'AI play' },
    { symbol: 'MC.PA', order: 2, targetPriceHigh: 900, targetPriceLow: 750, notes: 'Luxury sector' },
  ];

  for (const item of watchlistItems) {
    await prisma.watchlistItem.upsert({
      where: { symbol: item.symbol },
      update: {},
      create: item,
    });
  }

  console.log(`Created ${watchlistItems.length} watchlist items`);

  // Create default alert rules
  const alertRules = [
    {
      strategy: 'PULLBACK',
      params: JSON.stringify({ rsiThreshold: 35, smaDistance: 0.02 }),
      enabled: true,
    },
    {
      strategy: 'BREAKOUT',
      params: JSON.stringify({ volumeMultiplier: 1.5, priceChange: 0.03 }),
      enabled: true,
    },
    {
      strategy: 'MACD_CROSS',
      params: JSON.stringify({ signalType: 'bullish' }),
      enabled: true,
    },
    {
      strategy: 'SCORE_THRESHOLD',
      params: JSON.stringify({ minScore: 80 }),
      enabled: true,
    },
  ];

  for (const rule of alertRules) {
    await prisma.alertRule.upsert({
      where: { strategy: rule.strategy },
      update: {},
      create: rule,
    });
  }

  console.log(`Created ${alertRules.length} alert rules`);

  // Create default user settings
  await prisma.userSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      strategyPullback: true,
      strategyBreakout: true,
      strategyMacdCross: true,
      minScoreAlert: 75,
      pushEnabled: true,
      quietHoursEnabled: false,
    },
  });

  console.log('Created default user settings');

  console.log('Database seeded successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
