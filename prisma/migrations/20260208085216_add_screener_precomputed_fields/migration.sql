-- AlterTable
ALTER TABLE "StockData" ADD COLUMN "aboveSma200" BOOLEAN;
ALTER TABLE "StockData" ADD COLUMN "aboveSma50" BOOLEAN;
ALTER TABLE "StockData" ADD COLUMN "changePct" REAL;
ALTER TABLE "StockData" ADD COLUMN "volumeRatio" REAL;
