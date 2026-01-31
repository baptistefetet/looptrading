// ============================================
// LoopTrading - Shared Types
// ============================================

// Market types
export type Market = 'US' | 'EU';

// Strategy types
export type Strategy = 'PULLBACK' | 'BREAKOUT' | 'MACD_CROSS' | 'SCORE_THRESHOLD';

// ============================================
// Stock
// ============================================
export interface Stock {
  symbol: string;
  name: string;
  market: Market;
  sector?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// StockData (OHLCV + Indicators)
// ============================================
export interface StockData {
  id: string;
  symbol: string;
  date: Date;

  // OHLCV
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  // Moving Averages
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema9?: number;
  ema21?: number;

  // Momentum
  rsi14?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;

  // Bollinger Bands
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;

  // Volume
  obv?: number;
  avgVol20?: number;

  // Score
  score?: number;

  updatedAt: Date;
}

// ============================================
// Position (Portfolio)
// ============================================
export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  dateAcquired?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// WatchlistItem
// ============================================
export interface WatchlistItem {
  id: string;
  symbol: string;
  order: number;
  targetPriceHigh?: number;
  targetPriceLow?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// AlertRule
// ============================================
export interface AlertRule {
  id: string;
  strategy: Strategy;
  params: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Alert
// ============================================
export interface Alert {
  id: string;
  symbol: string;
  strategy: string;
  score?: number;
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

// ============================================
// UserSettings
// ============================================
export interface UserSettings {
  id: string;

  // Strategies
  strategyPullback: boolean;
  strategyBreakout: boolean;
  strategyMacdCross: boolean;
  minScoreAlert: number;

  // Notifications
  emailEnabled: boolean;
  emailAddress?: string;
  pushEnabled: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;

  updatedAt: Date;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// Position with P&L (computed)
// ============================================
export interface PositionWithPnL extends Position {
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

// ============================================
// Portfolio Summary
// ============================================
export interface PortfolioSummary {
  positions: PositionWithPnL[];
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
}

// ============================================
// News
// ============================================
export interface NewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string;
  thumbnail?: string;
}

export interface NewsResponse {
  symbol?: string;
  news: NewsItem[];
  fetchedAt: string;
}

// ============================================
// Screener Filters
// ============================================
export interface ScreenerFilters {
  minScore?: number;
  maxScore?: number;
  minRsi?: number;
  maxRsi?: number;
  aboveSma50?: boolean;
  aboveSma200?: boolean;
  minVolume?: number;
  market?: Market | 'ALL';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
