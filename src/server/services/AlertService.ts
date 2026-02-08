import { prisma } from '../lib/prisma.js';
import { scoringService } from './ScoringService.js';
import { getOrCreateUserSettings } from './UserSettingsService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

type Logger = {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export interface EvaluateAlertsResult {
  evaluatedStocks: number;
  evaluatedRules: number;
  createdAlerts: number;
  skippedDuplicates: number;
  skippedBySettings: number;
}

interface RuleParamsMap {
  PULLBACK: {
    pullbackPercent?: number;
    rsiMin?: number;
    rsiMax?: number;
  };
  BREAKOUT: {
    volumeThreshold?: number;
    breakoutLookbackBars?: number;
    breakoutConfirmBars?: number;
  };
  MACD_CROSS: {
    requireUptrend?: boolean;
    minHistogram?: number;
  };
  SCORE_THRESHOLD: {
    minScore?: number;
  };
}

export interface AlertStockRow {
  date: Date;
  close: number;
  high: number;
  volume: number;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  avgVol20: number | null;
  score: number | null;
}

type Strategy = keyof RuleParamsMap;

function parseRuleParams<S extends Strategy>(strategy: S, rawParams: string): RuleParamsMap[S] {
  try {
    const parsed = JSON.parse(rawParams);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {} as RuleParamsMap[S];
    }
    return parsed as RuleParamsMap[S];
  } catch {
    return {} as RuleParamsMap[S];
  }
}

function isStrategyEnabledBySettings(strategy: string, settings: {
  strategyPullback: boolean;
  strategyBreakout: boolean;
  strategyMacdCross: boolean;
}): boolean {
  if (strategy === 'PULLBACK') return settings.strategyPullback;
  if (strategy === 'BREAKOUT') return settings.strategyBreakout;
  if (strategy === 'MACD_CROSS') return settings.strategyMacdCross;
  return true;
}

export function evaluatePullback(
  rows: AlertStockRow[],
  params: RuleParamsMap['PULLBACK'] = {},
): boolean {
  if (rows.length < 2) return false;
  const latest = rows[0];
  const previous = rows[1];

  const pullbackPercent = (params.pullbackPercent ?? 2) / 100;
  const rsiMin = params.rsiMin ?? 40;
  const rsiMax = params.rsiMax ?? 50;

  if (latest.sma200 == null || latest.sma50 == null || latest.rsi14 == null || latest.avgVol20 == null) {
    return false;
  }

  const uptrend = latest.close > latest.sma200;
  const distanceToSma50 = Math.abs((latest.close - latest.sma50) / latest.sma50);
  const nearSma50 = distanceToSma50 <= pullbackPercent;
  const rsiInRange = latest.rsi14 >= rsiMin && latest.rsi14 <= rsiMax;
  const restingVolume = latest.volume < latest.avgVol20 && latest.volume < previous.volume;

  return uptrend && nearSma50 && rsiInRange && restingVolume;
}

export function evaluateBreakout(
  rows: AlertStockRow[],
  params: RuleParamsMap['BREAKOUT'] = {},
): boolean {
  const latest = rows[0];
  if (!latest || latest.avgVol20 == null) return false;

  const volumeThreshold = params.volumeThreshold ?? 1.5;
  const lookbackBars = params.breakoutLookbackBars ?? 20;
  const confirmBars = Math.max(1, params.breakoutConfirmBars ?? 1);

  const confirmSlice = rows.slice(0, confirmBars);
  const resistanceSlice = rows.slice(confirmBars, confirmBars + lookbackBars);

  if (confirmSlice.length < confirmBars || resistanceSlice.length < lookbackBars) {
    return false;
  }

  const resistance = resistanceSlice.reduce((max, row) => Math.max(max, row.high), Number.NEGATIVE_INFINITY);
  const closesAboveResistance = confirmSlice.every((row) => row.close > resistance);
  const volumeConfirmed = latest.volume >= latest.avgVol20 * volumeThreshold;

  return closesAboveResistance && volumeConfirmed;
}

export function evaluateMacdCross(
  rows: AlertStockRow[],
  params: RuleParamsMap['MACD_CROSS'] = {},
): boolean {
  if (rows.length < 2) return false;

  const latest = rows[0];
  const previous = rows[1];

  const requireUptrend = params.requireUptrend ?? true;
  const minHistogram = params.minHistogram ?? 0;

  if (
    latest.macdLine == null ||
    latest.macdSignal == null ||
    latest.macdHist == null ||
    previous.macdLine == null ||
    previous.macdSignal == null ||
    previous.macdHist == null
  ) {
    return false;
  }

  const lineCross = latest.macdLine > latest.macdSignal && previous.macdLine <= previous.macdSignal;
  const histogramCross = latest.macdHist >= minHistogram && previous.macdHist <= 0;
  const trendConfirmed = !requireUptrend || (latest.sma50 != null && latest.close > latest.sma50);

  return lineCross && histogramCross && trendConfirmed;
}

export function evaluateScoreThreshold(
  rows: AlertStockRow[],
  params: RuleParamsMap['SCORE_THRESHOLD'] = {},
): boolean {
  const latest = rows[0];
  if (!latest || latest.score == null) return false;
  return latest.score >= (params.minScore ?? 80);
}

function buildAlertMessage(strategy: string, symbol: string, score: number | null): string {
  const scoreSuffix = score == null ? '' : ` (score ${score})`;
  if (strategy === 'PULLBACK') return `Pullback detecte sur ${symbol}${scoreSuffix}`;
  if (strategy === 'BREAKOUT') return `Breakout confirme sur ${symbol}${scoreSuffix}`;
  if (strategy === 'MACD_CROSS') return `Croisement MACD haussier sur ${symbol}${scoreSuffix}`;
  if (strategy === 'SCORE_THRESHOLD') return `Score eleve detecte sur ${symbol}${scoreSuffix}`;
  return `Alerte ${strategy} sur ${symbol}${scoreSuffix}`;
}

function strategyTriggered(strategy: string, rows: AlertStockRow[], ruleParams: string): boolean {
  if (strategy === 'PULLBACK') {
    return evaluatePullback(rows, parseRuleParams('PULLBACK', ruleParams));
  }
  if (strategy === 'BREAKOUT') {
    return evaluateBreakout(rows, parseRuleParams('BREAKOUT', ruleParams));
  }
  if (strategy === 'MACD_CROSS') {
    return evaluateMacdCross(rows, parseRuleParams('MACD_CROSS', ruleParams));
  }
  if (strategy === 'SCORE_THRESHOLD') {
    return evaluateScoreThreshold(rows, parseRuleParams('SCORE_THRESHOLD', ruleParams));
  }
  return false;
}

async function resolveScore(symbol: string, fallbackScore: number | null): Promise<number | null> {
  if (fallbackScore != null) return fallbackScore;
  try {
    const computed = await scoringService.calculateScore(symbol);
    return computed?.score ?? null;
  } catch {
    return null;
  }
}

export async function evaluateAlerts(logger: Logger): Promise<EvaluateAlertsResult> {
  const settings = await getOrCreateUserSettings();
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
    orderBy: { strategy: 'asc' },
  });
  const stocks = await prisma.stock.findMany({
    where: { active: true },
    select: { symbol: true },
  });

  const result: EvaluateAlertsResult = {
    evaluatedStocks: stocks.length,
    evaluatedRules: rules.length,
    createdAlerts: 0,
    skippedDuplicates: 0,
    skippedBySettings: 0,
  };

  if (stocks.length === 0 || rules.length === 0) {
    logger.info('[evaluateAlerts] Skipped - no active stocks or enabled rules');
    return result;
  }

  const dedupFrom = new Date(Date.now() - DAY_MS);

  for (const stock of stocks) {
    const rows = await prisma.stockData.findMany({
      where: { symbol: stock.symbol },
      orderBy: { date: 'desc' },
      take: 250,
      select: {
        date: true,
        close: true,
        high: true,
        volume: true,
        sma50: true,
        sma200: true,
        rsi14: true,
        macdLine: true,
        macdSignal: true,
        macdHist: true,
        avgVol20: true,
        score: true,
      },
    });

    if (rows.length < 2) continue;

    let cachedScore: number | null | undefined;

    for (const rule of rules) {
      if (!isStrategyEnabledBySettings(rule.strategy, settings)) {
        result.skippedBySettings++;
        continue;
      }

      const alreadySent = await prisma.alert.findFirst({
        where: {
          symbol: stock.symbol,
          strategy: rule.strategy,
          triggeredAt: { gte: dedupFrom },
        },
        select: { id: true },
      });

      if (alreadySent) {
        result.skippedDuplicates++;
        continue;
      }

      const triggered = strategyTriggered(rule.strategy, rows, rule.params);
      if (!triggered) continue;

      if (cachedScore === undefined) {
        cachedScore = await resolveScore(stock.symbol, rows[0].score);
      }

      if (cachedScore != null && cachedScore < settings.minScoreAlert) {
        result.skippedBySettings++;
        continue;
      }

      await prisma.alert.create({
        data: {
          symbol: stock.symbol,
          strategy: rule.strategy,
          score: cachedScore ?? undefined,
          message: buildAlertMessage(rule.strategy, stock.symbol, cachedScore ?? null),
        },
      });

      result.createdAlerts++;
    }
  }

  logger.info(
    `[evaluateAlerts] Done: ${result.createdAlerts} alerts created, ${result.skippedDuplicates} duplicates skipped, ${result.skippedBySettings} skipped by settings`,
  );

  return result;
}
