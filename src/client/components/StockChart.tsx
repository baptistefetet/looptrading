import { useEffect, useMemo, useRef } from 'react';
import {
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
} from 'lightweight-charts';
import type { OHLCVBar } from '@shared/types';
import { buildChartSeries } from '../lib/chartIndicators';

export interface OverlayVisibility {
  sma: boolean;
  ema: boolean;
  bollinger: boolean;
}

interface StockChartProps {
  symbol: string;
  bars: OHLCVBar[];
  overlayVisibility: OverlayVisibility;
}

const MAIN_HEIGHT = 420;
const RSI_HEIGHT = 140;
const MACD_HEIGHT = 160;
const VOLUME_HEIGHT = 140;

function normalizeTimeKey(time: Time): string {
  if (typeof time === 'string') return time;
  if (typeof time === 'number') return String(time);

  const month = String(time.month).padStart(2, '0');
  const day = String(time.day).padStart(2, '0');
  return `${time.year}-${month}-${day}`;
}

function createNeonChart(container: HTMLElement, width: number, height: number): IChartApi {
  return createChart(container, {
    width,
    height,
    layout: {
      background: { color: '#0d1117' },
      textColor: '#c9d1d9',
    },
    rightPriceScale: {
      borderColor: '#30363d',
    },
    timeScale: {
      borderColor: '#30363d',
      timeVisible: true,
      rightOffset: 6,
      fixLeftEdge: false,
      fixRightEdge: false,
    },
    grid: {
      vertLines: { color: 'rgba(48,54,61,0.35)' },
      horzLines: { color: 'rgba(48,54,61,0.35)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: 'rgba(0,212,255,0.7)',
        width: 1,
      },
      horzLine: {
        color: 'rgba(0,212,255,0.55)',
        width: 1,
      },
    },
    handleScale: true,
    handleScroll: true,
  });
}

type CrosshairSyncTarget = {
  chart: IChartApi;
  series: ISeriesApi<SeriesType, Time>;
  valuesByTime: Map<string, number>;
};

export function StockChart({ symbol, bars, overlayVisibility }: StockChartProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const macdRef = useRef<HTMLDivElement | null>(null);
  const volumeRef = useRef<HTMLDivElement | null>(null);
  const chartsRef = useRef<IChartApi[]>([]);

  const seriesData = useMemo(() => buildChartSeries(bars), [bars]);

  useEffect(() => {
    if (!rootRef.current || !mainRef.current || !rsiRef.current || !macdRef.current || !volumeRef.current) {
      return undefined;
    }

    if (seriesData.candlesticks.length === 0) {
      chartsRef.current = [];
      return undefined;
    }

    const width = Math.max(rootRef.current.clientWidth, 320);

    const mainChart = createNeonChart(mainRef.current, width, MAIN_HEIGHT);
    const rsiChart = createNeonChart(rsiRef.current, width, RSI_HEIGHT);
    const macdChart = createNeonChart(macdRef.current, width, MACD_HEIGHT);
    const volumeChart = createNeonChart(volumeRef.current, width, VOLUME_HEIGHT);

    chartsRef.current = [mainChart, rsiChart, macdChart, volumeChart];

    const candlestickSeries = mainChart.addCandlestickSeries({
      upColor: '#00ff41',
      downColor: '#ff4d4f',
      borderVisible: false,
      wickUpColor: '#00ff41',
      wickDownColor: '#ff4d4f',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    candlestickSeries.setData(seriesData.candlesticks);

    const sma20Series = mainChart.addLineSeries({
      color: '#00d4ff',
      lineWidth: 1.5,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const sma50Series = mainChart.addLineSeries({
      color: '#f0e68c',
      lineWidth: 1.5,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const sma200Series = mainChart.addLineSeries({
      color: '#ff00ff',
      lineWidth: 1.8,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    sma20Series.setData(overlayVisibility.sma ? seriesData.sma20 : []);
    sma50Series.setData(overlayVisibility.sma ? seriesData.sma50 : []);
    sma200Series.setData(overlayVisibility.sma ? seriesData.sma200 : []);

    const ema9Series = mainChart.addLineSeries({
      color: '#6ee7ff',
      lineWidth: 1.4,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const ema21Series = mainChart.addLineSeries({
      color: '#ff8ef6',
      lineWidth: 1.4,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    ema9Series.setData(overlayVisibility.ema ? seriesData.ema9 : []);
    ema21Series.setData(overlayVisibility.ema ? seriesData.ema21 : []);

    const bbUpperSeries = mainChart.addLineSeries({
      color: 'rgba(0,212,255,0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const bbMiddleSeries = mainChart.addLineSeries({
      color: 'rgba(0,212,255,0.8)',
      lineWidth: 1.2,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const bbLowerSeries = mainChart.addLineSeries({
      color: 'rgba(0,212,255,0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    bbUpperSeries.setData(overlayVisibility.bollinger ? seriesData.bbUpper : []);
    bbMiddleSeries.setData(overlayVisibility.bollinger ? seriesData.bbMiddle : []);
    bbLowerSeries.setData(overlayVisibility.bollinger ? seriesData.bbLower : []);

    const rsiSeries = rsiChart.addLineSeries({
      color: '#00d4ff',
      lineWidth: 1.8,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    rsiSeries.setData(seriesData.rsi14);
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(255,0,255,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '70',
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(0,255,65,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '30',
    });
    rsiChart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.1 },
    });

    const macdLineSeries = macdChart.addLineSeries({
      color: '#00d4ff',
      lineWidth: 1.4,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const macdSignalSeries = macdChart.addLineSeries({
      color: '#ff00ff',
      lineWidth: 1.4,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const macdHistogramSeries = macdChart.addHistogramSeries({
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001,
      },
      lastValueVisible: false,
      priceLineVisible: false,
    });

    macdLineSeries.setData(seriesData.macdLine);
    macdSignalSeries.setData(seriesData.macdSignal);
    macdHistogramSeries.setData(seriesData.macdHist);

    const volumeSeries = volumeChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.setData(seriesData.volume);
    volumeChart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.12, bottom: 0 },
    });

    const allCharts = [mainChart, rsiChart, macdChart, volumeChart];
    const unsubscribeCallbacks: Array<() => void> = [];

    let isSyncingRange = false;
    allCharts.forEach((chart, index) => {
      const handler = (range: { from: number; to: number } | null) => {
        if (isSyncingRange || range == null) return;
        isSyncingRange = true;
        allCharts.forEach((targetChart, targetIndex) => {
          if (targetIndex === index) return;
          targetChart.timeScale().setVisibleLogicalRange(range);
        });
        isSyncingRange = false;
      };

      chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
      unsubscribeCallbacks.push(() => {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      });
    });

    const closeByTime = new Map(
      seriesData.candlesticks.map((entry) => [entry.time, entry.close]),
    );
    const rsiByTime = new Map(seriesData.rsi14.map((entry) => [entry.time, entry.value]));
    const macdByTime = new Map(seriesData.macdLine.map((entry) => [entry.time, entry.value]));
    const volumeByTime = new Map(seriesData.volume.map((entry) => [entry.time, entry.value]));

    let isSyncingCrosshair = false;

    const bindCrosshairSync = (source: IChartApi, targets: CrosshairSyncTarget[]) => {
      const handler = (param: MouseEventParams<Time>) => {
        if (isSyncingCrosshair) return;
        isSyncingCrosshair = true;

        if (param.time == null) {
          targets.forEach((target) => target.chart.clearCrosshairPosition());
          isSyncingCrosshair = false;
          return;
        }

        const key = normalizeTimeKey(param.time);

        targets.forEach((target) => {
          const price = target.valuesByTime.get(key);
          if (price == null) {
            target.chart.clearCrosshairPosition();
            return;
          }

          target.chart.setCrosshairPosition(price, param.time!, target.series);
        });

        isSyncingCrosshair = false;
      };

      source.subscribeCrosshairMove(handler);
      unsubscribeCallbacks.push(() => source.unsubscribeCrosshairMove(handler));
    };

    bindCrosshairSync(mainChart, [
      { chart: rsiChart, series: rsiSeries, valuesByTime: rsiByTime },
      { chart: macdChart, series: macdLineSeries, valuesByTime: macdByTime },
      { chart: volumeChart, series: volumeSeries, valuesByTime: volumeByTime },
    ]);
    bindCrosshairSync(rsiChart, [
      { chart: mainChart, series: candlestickSeries, valuesByTime: closeByTime },
      { chart: macdChart, series: macdLineSeries, valuesByTime: macdByTime },
      { chart: volumeChart, series: volumeSeries, valuesByTime: volumeByTime },
    ]);
    bindCrosshairSync(macdChart, [
      { chart: mainChart, series: candlestickSeries, valuesByTime: closeByTime },
      { chart: rsiChart, series: rsiSeries, valuesByTime: rsiByTime },
      { chart: volumeChart, series: volumeSeries, valuesByTime: volumeByTime },
    ]);
    bindCrosshairSync(volumeChart, [
      { chart: mainChart, series: candlestickSeries, valuesByTime: closeByTime },
      { chart: rsiChart, series: rsiSeries, valuesByTime: rsiByTime },
      { chart: macdChart, series: macdLineSeries, valuesByTime: macdByTime },
    ]);

    mainChart.timeScale().fitContent();
    const initialRange = mainChart.timeScale().getVisibleLogicalRange();
    if (initialRange) {
      rsiChart.timeScale().setVisibleLogicalRange(initialRange);
      macdChart.timeScale().setVisibleLogicalRange(initialRange);
      volumeChart.timeScale().setVisibleLogicalRange(initialRange);
    }

    const resize = () => {
      const containerWidth = Math.max(rootRef.current?.clientWidth ?? 0, 320);
      allCharts.forEach((chart) => chart.applyOptions({ width: containerWidth }));
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(rootRef.current);

    return () => {
      unsubscribeCallbacks.forEach((callback) => callback());
      resizeObserver.disconnect();
      allCharts.forEach((chart) => chart.remove());
      chartsRef.current = [];
    };
  }, [overlayVisibility.bollinger, overlayVisibility.ema, overlayVisibility.sma, seriesData]);

  const hasData = seriesData.candlesticks.length > 0;

  return (
    <div className="rounded-lg border border-neon-cyan/40 bg-dark-900/70 p-4 shadow-[0_0_25px_rgba(0,212,255,0.12)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neon-cyan">
            {symbol} Chart
          </h2>
          <p className="text-xs text-gray-500">Candles + SMA/EMA/Bollinger + RSI/MACD/Volume</p>
        </div>
        <button
          type="button"
          onClick={() => chartsRef.current.forEach((chart) => chart.timeScale().fitContent())}
          disabled={!hasData}
          className="rounded border border-neon-cyan/50 px-3 py-1.5 text-xs font-medium text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset zoom
        </button>
      </div>

      {!hasData && (
        <div className="rounded border border-dark-600 bg-dark-800/60 px-4 py-8 text-center text-sm text-gray-500">
          No OHLCV data available for this symbol and timeframe.
        </div>
      )}

      <div ref={rootRef} className={hasData ? 'space-y-3' : 'hidden'}>
        <div ref={mainRef} className="w-full" />
        <div className="grid gap-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-gray-500">RSI 14</p>
            <div ref={rsiRef} className="w-full" />
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-gray-500">MACD 12-26-9</p>
            <div ref={macdRef} className="w-full" />
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-gray-500">Volume</p>
            <div ref={volumeRef} className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
