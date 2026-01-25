-- CreateTable
CREATE TABLE "Stock" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "sector" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "sma20" REAL,
    "sma50" REAL,
    "sma200" REAL,
    "ema9" REAL,
    "ema21" REAL,
    "rsi14" REAL,
    "macdLine" REAL,
    "macdSignal" REAL,
    "macdHist" REAL,
    "bbUpper" REAL,
    "bbMiddle" REAL,
    "bbLower" REAL,
    "obv" REAL,
    "avgVol20" REAL,
    "score" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockData_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "avgCost" REAL NOT NULL,
    "dateAcquired" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Position_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "targetPriceHigh" REAL,
    "targetPriceLow" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchlistItem_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategy" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "score" INTEGER,
    "message" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    CONSTRAINT "Alert_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "strategyPullback" BOOLEAN NOT NULL DEFAULT true,
    "strategyBreakout" BOOLEAN NOT NULL DEFAULT true,
    "strategyMacdCross" BOOLEAN NOT NULL DEFAULT true,
    "minScoreAlert" INTEGER NOT NULL DEFAULT 75,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailAddress" TEXT,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Stock_market_active_idx" ON "Stock"("market", "active");

-- CreateIndex
CREATE INDEX "StockData_symbol_date_idx" ON "StockData"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StockData_symbol_date_key" ON "StockData"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_symbol_key" ON "WatchlistItem"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_strategy_key" ON "AlertRule"("strategy");

-- CreateIndex
CREATE INDEX "Alert_symbol_strategy_triggeredAt_idx" ON "Alert"("symbol", "strategy", "triggeredAt");

-- CreateIndex
CREATE INDEX "Alert_acknowledged_idx" ON "Alert"("acknowledged");
