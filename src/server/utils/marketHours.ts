export interface MarketStatus {
  us: boolean;
  eu: boolean;
}

/**
 * Check if stock markets are currently open.
 * US (NYSE/NASDAQ): 9:30-16:00 EST = 14:30-21:00 UTC
 * EU (Euronext): 9:00-17:30 CET = 8:00-16:30 UTC
 * Closed on weekends (Saturday/Sunday).
 */
export function isMarketOpen(now: Date = new Date()): MarketStatus {
  const day = now.getUTCDay();

  // Skip weekends
  if (day === 0 || day === 6) return { us: false, eu: false };

  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // US: 14:30-21:00 UTC (9:30-16:00 EST)
  const usOpen = utcMinutes >= 14 * 60 + 30 && utcMinutes < 21 * 60;

  // EU: 8:00-16:30 UTC (9:00-17:30 CET)
  const euOpen = utcMinutes >= 8 * 60 && utcMinutes < 16 * 60 + 30;

  return { us: usOpen, eu: euOpen };
}
