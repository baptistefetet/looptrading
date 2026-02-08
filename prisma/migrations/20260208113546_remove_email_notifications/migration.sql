-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "strategyPullback" BOOLEAN NOT NULL DEFAULT true,
    "strategyBreakout" BOOLEAN NOT NULL DEFAULT true,
    "strategyMacdCross" BOOLEAN NOT NULL DEFAULT true,
    "minScoreAlert" INTEGER NOT NULL DEFAULT 75,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserSettings" ("id", "strategyPullback", "strategyBreakout", "strategyMacdCross", "minScoreAlert", "pushEnabled", "quietHoursEnabled", "quietHoursStart", "quietHoursEnd", "updatedAt") SELECT "id", "strategyPullback", "strategyBreakout", "strategyMacdCross", "minScoreAlert", "pushEnabled", "quietHoursEnabled", "quietHoursStart", "quietHoursEnd", "updatedAt" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
