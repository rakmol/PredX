import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Layers3 } from 'lucide-react';
import RefreshSelector, {
  getStoredRefreshInterval,
  setStoredRefreshInterval,
} from './RefreshSelector';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useOHLCV } from '@/hooks/useCoins';
import { useRealtimePrice, type RealtimeConnectionStatus } from '@/hooks/useRealtimePrice';
import { formatGHS, formatPrice } from '@/lib/utils';
import type { OHLCVPoint } from '@/lib/coingecko';
import type { ChartTimeframe } from './chartUtils';

interface PriceChartProps {
  coinId: string;
  ghsRate?: number;
  timeframe?: ChartTimeframe;
  onTimeframeChange?: (timeframe: ChartTimeframe) => void;
  height?: number;
}

export interface ChartOverlayState {
  ma7: boolean;
  ma25: boolean;
  ma99: boolean;
  bollinger: boolean;
}

export interface EnrichedCandle extends OHLCVPoint {
  time: UTCTimestamp;
  ma7: number | null;
  ma25: number | null;
  ma99: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
}

interface HoverSnapshot {
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceFlashState {
  direction: 'up' | 'down' | null;
}

interface PriceSeriesRefs {
  candle: ISeriesApi<'Candlestick', Time> | null;
  volume: ISeriesApi<'Histogram', Time> | null;
  ma7: ISeriesApi<'Line', Time> | null;
  ma25: ISeriesApi<'Line', Time> | null;
  ma99: ISeriesApi<'Line', Time> | null;
  bbUpper: ISeriesApi<'Line', Time> | null;
  bbMiddle: ISeriesApi<'Line', Time> | null;
  bbLower: ISeriesApi<'Line', Time> | null;
}

export const TIMEFRAME_CONFIG: Array<{ value: ChartTimeframe; label: string; days: number }> = [
  { value: '1D', label: '1D', days: 1 },
  { value: '7D', label: '7D', days: 7 },
  { value: '1M', label: '1M', days: 30 },
  { value: '3M', label: '3M', days: 90 },
];

const OVERLAY_OPTIONS = [
  { key: 'ma7', label: 'MA7', color: '#3B82F6' },
  { key: 'ma25', label: 'MA25', color: '#F59E0B' },
  { key: 'ma99', label: 'MA99', color: '#8B5CF6' },
  { key: 'bollinger', label: 'Bollinger', color: '#94A3B8' },
] as const;

export const DEFAULT_OVERLAYS: ChartOverlayState = {
  ma7: true,
  ma25: true,
  ma99: false,
  bollinger: true,
};

function createEmptySeriesRefs(): PriceSeriesRefs {
  return {
    candle: null,
    volume: null,
    ma7: null,
    ma25: null,
    ma99: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
  };
}

export function getTimeframeDays(timeframe: ChartTimeframe) {
  return TIMEFRAME_CONFIG.find((option) => option.value === timeframe)?.days ?? 30;
}

function toUtcTimestamp(timestamp: number) {
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function movingAverage(values: number[], period: number, index: number) {
  if (index < period - 1) return null;
  let total = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    total += values[cursor] ?? 0;
  }
  return total / period;
}

function standardDeviation(values: number[], period: number, index: number, mean: number) {
  if (index < period - 1) return null;
  let variance = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const value = values[cursor] ?? 0;
    variance += (value - mean) ** 2;
  }
  return Math.sqrt(variance / period);
}

export function enrichCandles(candles: OHLCVPoint[]): EnrichedCandle[] {
  const sorted = [...candles].sort((left, right) => left.timestamp - right.timestamp);
  const closes = sorted.map((candle) => candle.close);

  return sorted.map((candle, index) => {
    const ma7 = movingAverage(closes, 7, index);
    const ma25 = movingAverage(closes, 25, index);
    const ma99 = movingAverage(closes, 99, index);
    const bbMiddle = movingAverage(closes, 20, index);
    const deviation = bbMiddle === null ? null : standardDeviation(closes, 20, index, bbMiddle);

    return {
      ...candle,
      time: toUtcTimestamp(candle.timestamp),
      ma7,
      ma25,
      ma99,
      bbUpper: bbMiddle !== null && deviation !== null ? bbMiddle + deviation * 2 : null,
      bbMiddle,
      bbLower: bbMiddle !== null && deviation !== null ? bbMiddle - deviation * 2 : null,
    };
  });
}

export function buildCandlestickData(candles: EnrichedCandle[]): CandlestickData[] {
  return candles.map((candle) => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

export function buildVolumeData(candles: EnrichedCandle[]): HistogramData[] {
  return candles.map((candle) => ({
    time: candle.time,
    value: candle.volume,
    color: candle.close >= candle.open ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)',
  }));
}

export function buildLineData(
  candles: EnrichedCandle[],
  key: 'ma7' | 'ma25' | 'ma99' | 'bbUpper' | 'bbMiddle' | 'bbLower',
): LineData[] {
  return candles
    .filter((candle) => candle[key] !== null)
    .map((candle) => ({
      time: candle.time,
      value: candle[key] as number,
    }));
}

export function formatVolume(volume: number) {
  if (volume >= 1e12) return `${(volume / 1e12).toFixed(2)}T`;
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
  return volume.toFixed(0);
}

export function formatCrosshairDate(time: Time | undefined) {
  if (!time) return '';
  const value = typeof time === 'string' ? new Date(time) : new Date((time as number) * 1000);
  return value.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getCandleIntervalMs(candles: OHLCVPoint[]) {
  if (candles.length >= 2) {
    return Math.max(60_000, candles[candles.length - 1]!.timestamp - candles[candles.length - 2]!.timestamp);
  }
  return 60 * 60_000;
}

export function applyLivePriceToCandles(
  candles: EnrichedCandle[],
  price: number,
  eventTimestamp: number,
  volumeDelta = 0,
) {
  if (!candles.length) return candles;

  const rawCandles: OHLCVPoint[] = candles.map((candle) => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));

  const intervalMs = getCandleIntervalMs(rawCandles);
  const lastCandle = rawCandles[rawCandles.length - 1]!;
  const bucketTimestamp = Math.floor(eventTimestamp / intervalMs) * intervalMs;

  if (bucketTimestamp <= lastCandle.timestamp) {
    const nextLastCandle: OHLCVPoint = {
      ...lastCandle,
      high: Math.max(lastCandle.high, price),
      low: Math.min(lastCandle.low, price),
      close: price,
      volume: Math.max(0, lastCandle.volume + volumeDelta),
    };
    rawCandles[rawCandles.length - 1] = nextLastCandle;
  } else {
    rawCandles.push({
      timestamp: bucketTimestamp,
      open: lastCandle.close,
      high: Math.max(lastCandle.close, price),
      low: Math.min(lastCandle.close, price),
      close: price,
      volume: Math.max(0, volumeDelta),
    });
  }

  return enrichCandles(rawCandles.slice(-600));
}

function syncOverlayVisibility(seriesRefs: PriceSeriesRefs, overlays: ChartOverlayState) {
  seriesRefs.ma7?.applyOptions({ visible: overlays.ma7 });
  seriesRefs.ma25?.applyOptions({ visible: overlays.ma25 });
  seriesRefs.ma99?.applyOptions({ visible: overlays.ma99 });
  seriesRefs.bbUpper?.applyOptions({ visible: overlays.bollinger });
  seriesRefs.bbMiddle?.applyOptions({ visible: overlays.bollinger });
  seriesRefs.bbLower?.applyOptions({ visible: overlays.bollinger });
}

function syncOverlayData(seriesRefs: PriceSeriesRefs, candles: EnrichedCandle[]) {
  seriesRefs.ma7?.setData(buildLineData(candles, 'ma7'));
  seriesRefs.ma25?.setData(buildLineData(candles, 'ma25'));
  seriesRefs.ma99?.setData(buildLineData(candles, 'ma99'));
  seriesRefs.bbUpper?.setData(buildLineData(candles, 'bbUpper'));
  seriesRefs.bbMiddle?.setData(buildLineData(candles, 'bbMiddle'));
  seriesRefs.bbLower?.setData(buildLineData(candles, 'bbLower'));
}

function connectionClasses(status: RealtimeConnectionStatus) {
  if (status === 'live') {
    return {
      dot: 'bg-emerald-400 animate-pulse',
      text: 'text-emerald-300',
      label: 'Live',
    };
  }

  if (status === 'delayed') {
    return {
      dot: 'bg-amber-300',
      text: 'text-amber-200',
      label: 'Delayed 15s',
    };
  }

  return {
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    label: 'Offline',
  };
}

export default memo(function PriceChart({
  coinId,
  ghsRate = 15.5,
  timeframe,
  onTimeframeChange,
  height = 420,
}: PriceChartProps) {
  const [internalTimeframe, setInternalTimeframe] = useState<ChartTimeframe>('1M');
  const [overlays, setOverlays] = useState<ChartOverlayState>(DEFAULT_OVERLAYS);
  const [hover, setHover] = useState<HoverSnapshot | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [liveCandles, setLiveCandles] = useState<EnrichedCandle[]>([]);
  const [priceFlash, setPriceFlash] = useState<PriceFlashState>({ direction: null });
  const [pollIntervalMs, setPollIntervalMs] = useState<number | null>(getStoredRefreshInterval);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<PriceSeriesRefs>(createEmptySeriesRefs());
  const latestCandlesRef = useRef<EnrichedCandle[]>([]);
  const previousLivePriceRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const seededHistoryKeyRef = useRef<string | null>(null);

  const activeTimeframe = timeframe ?? internalTimeframe;
  const setTimeframe = onTimeframeChange ?? setInternalTimeframe;
  const days = useMemo(() => getTimeframeDays(activeTimeframe), [activeTimeframe]);
  const { data: ohlcv = [], isLoading, isFetching, error: ohlcvError } = useOHLCV(coinId, days);
  const realtime = useRealtimePrice({ coinId, timeframe: activeTimeframe, pollIntervalMs });

  const enrichedCandles = useMemo(() => enrichCandles(ohlcv), [ohlcv]);

  const displayedCandle = useMemo(
    () =>
      hover ??
      (liveCandles.length
        ? {
            timeLabel: formatCrosshairDate(liveCandles[liveCandles.length - 1]?.time),
            open: liveCandles[liveCandles.length - 1]?.open ?? 0,
            high: liveCandles[liveCandles.length - 1]?.high ?? 0,
            low: liveCandles[liveCandles.length - 1]?.low ?? 0,
            close: liveCandles[liveCandles.length - 1]?.close ?? 0,
            volume: liveCandles[liveCandles.length - 1]?.volume ?? 0,
          }
        : null),
    [hover, liveCandles],
  );

  const tickerPrice = realtime.currentPrice ?? displayedCandle?.close ?? null;
  const priceChange24h = realtime.priceChange24h ?? null;
  const connectionState = connectionClasses(realtime.connectionStatus);

  useEffect(() => {
    latestCandlesRef.current = liveCandles;
  }, [liveCandles]);

  useEffect(() => {
    setLiveCandles(enrichedCandles);
    previousLivePriceRef.current = enrichedCandles[enrichedCandles.length - 1]?.close ?? null;
  }, [enrichedCandles]);

  useEffect(() => {
    if (!containerRef.current || chartRef.current || liveCandles.length === 0) return;

    const container = containerRef.current;
    const chart = createChart(container, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0A0A0F' },
        textColor: '#94A3B8',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.08)' },
        horzLines: { color: 'rgba(148,163,184,0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: { color: 'rgba(148,163,184,0.35)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(148,163,184,0.35)', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.16)',
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.16)',
        timeVisible: days <= 7,
        secondsVisible: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    seriesRefs.current.candle = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
      lastValueVisible: true,
      priceLineVisible: true,
    });

    seriesRefs.current.volume = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
      },
      1,
    );

    seriesRefs.current.volume.priceScale().applyOptions({
      scaleMargins: {
        top: 0.12,
        bottom: 0,
      },
    });

    seriesRefs.current.ma7 = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.ma25 = chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.ma99 = chart.addSeries(LineSeries, {
      color: '#8B5CF6',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.bbUpper = chart.addSeries(LineSeries, {
      color: '#94A3B8',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.bbMiddle = chart.addSeries(LineSeries, {
      color: 'rgba(148,163,184,0.55)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.bbLower = chart.addSeries(LineSeries, {
      color: '#94A3B8',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const panes = chart.panes();
    if (panes[1]) panes[1].setHeight(Math.max(90, Math.round(height * 0.22)));

    const crosshairHandler = (param: MouseEventParams<Time>) => {
      if (!param.time || !seriesRefs.current.candle || !seriesRefs.current.volume) {
        setHover(null);
        return;
      }

      const candleData = param.seriesData.get(
        seriesRefs.current.candle as ISeriesApi<'Candlestick', Time>,
      ) as CandlestickData | undefined;
      const volumeData = param.seriesData.get(
        seriesRefs.current.volume as ISeriesApi<'Histogram', Time>,
      ) as HistogramData | undefined;

      if (!candleData) {
        setHover(null);
        return;
      }

      setHover({
        timeLabel: formatCrosshairDate(param.time),
        open: candleData.open,
        high: candleData.high,
        low: candleData.low,
        close: candleData.close,
        volume: Number(volumeData?.value ?? 0),
      });
    };

    chart.subscribeCrosshairMove(crosshairHandler);

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height });
    });
    resizeObserver.observe(container);

    setChartReady(true);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(crosshairHandler);
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = createEmptySeriesRefs();
      setChartReady(false);
    };
  }, [days, height, liveCandles.length]);

  useEffect(() => {
    if (!chartRef.current || liveCandles.length === 0 || !seriesRefs.current.candle || !seriesRefs.current.volume) {
      return;
    }

    const historyKey = `${coinId}:${days}:${liveCandles[0]?.timestamp ?? 0}:${liveCandles[liveCandles.length - 1]?.timestamp ?? 0}`;
    seriesRefs.current.candle.setData(buildCandlestickData(liveCandles));
    seriesRefs.current.volume.setData(buildVolumeData(liveCandles));
    syncOverlayData(seriesRefs.current, liveCandles);
    syncOverlayVisibility(seriesRefs.current, overlays);

    if (seededHistoryKeyRef.current !== historyKey) {
      chartRef.current.timeScale().fitContent();
      seededHistoryKeyRef.current = historyKey;
    }
  }, [coinId, days, liveCandles, overlays]);

  useEffect(() => {
    syncOverlayVisibility(seriesRefs.current, overlays);
  }, [overlays]);

  useEffect(() => {
    if (!realtime.currentPrice || !realtime.lastUpdated || !seriesRefs.current.candle || !seriesRefs.current.volume) {
      return;
    }

    const currentCandles = latestCandlesRef.current;
    if (!currentCandles.length) return;

    const nextCandles = applyLivePriceToCandles(
      currentCandles,
      realtime.currentPrice,
      realtime.lastUpdated,
      realtime.lastTradeVolumeUsd,
    );
    const nextLastCandle = nextCandles[nextCandles.length - 1];
    if (!nextLastCandle) return;

    latestCandlesRef.current = nextCandles;
    setLiveCandles(nextCandles);

    const previousPrice = previousLivePriceRef.current;
    if (previousPrice !== null && previousPrice !== realtime.currentPrice) {
      setPriceFlash({ direction: realtime.currentPrice > previousPrice ? 'up' : 'down' });
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = window.setTimeout(() => {
        setPriceFlash({ direction: null });
      }, 700);
    }
    previousLivePriceRef.current = realtime.currentPrice;

    seriesRefs.current.candle.update({
      time: nextLastCandle.time,
      open: nextLastCandle.open,
      high: nextLastCandle.high,
      low: nextLastCandle.low,
      close: nextLastCandle.close,
    });
    seriesRefs.current.volume.update({
      time: nextLastCandle.time,
      value: nextLastCandle.volume,
      color: nextLastCandle.close >= nextLastCandle.open ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)',
    });
    syncOverlayData(seriesRefs.current, nextCandles);
    syncOverlayVisibility(seriesRefs.current, overlays);
  }, [overlays, realtime.currentPrice, realtime.lastTradeVolumeUsd, realtime.lastUpdated]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-[#1E3050] bg-[#0A0A0F] p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-100">
            <Activity size={16} className="text-cyan-300" />
            <h3 className="text-sm font-semibold">Candlestick Price Chart</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Live OHLC candles with volume, crosshair hover data, and technical overlays.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Connection status pill (shown only when NOT websocket, since RefreshSelector shows the WS badge) */}
          {!realtime.isWebsocket && (
            <div className={`inline-flex min-h-9 items-center gap-2 rounded-full border border-[#223556] bg-[#11131A] px-3 py-2 text-xs ${connectionState.text}`}>
              <span className={`h-2 w-2 rounded-full ${connectionState.dot}`} />
              {connectionState.label}
            </div>
          )}

          {/* Timeframe selector */}
          <div className="flex rounded-xl border border-[#223556] bg-[#11131A] p-1">
            {TIMEFRAME_CONFIG.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeframe(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTimeframe === option.value
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Refresh interval selector */}
          <RefreshSelector
            intervalMs={pollIntervalMs}
            onChange={(ms) => {
              setPollIntervalMs(ms);
              setStoredRefreshInterval(ms);
            }}
            isWebSocket={realtime.isWebsocket}
            lastRefreshedAt={realtime.lastUpdated}
          />

          {/* Overlay toggles */}
          <div className="flex flex-wrap gap-2">
            {OVERLAY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setOverlays((current) => ({ ...current, [option.key]: !current[option.key] }))}
                className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-2 text-xs transition ${
                  overlays[option.key]
                    ? 'border-white/15 bg-white/10 text-slate-100'
                    : 'border-[#223556] bg-[#11131A] text-slate-400'
                }`}
              >
                <Layers3 size={12} style={{ color: option.color }} />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`mb-3 rounded-2xl border p-4 transition-colors duration-500 ${
          priceFlash.direction === 'up'
            ? 'border-emerald-400/30 bg-emerald-400/10'
            : priceFlash.direction === 'down'
              ? 'border-rose-400/30 bg-rose-400/10'
              : 'border-[#1A1D27] bg-[#0D1118]'
        }`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live Price</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-2xl font-semibold text-slate-50 md:text-3xl">
                {tickerPrice ? formatPrice(tickerPrice, 'USD') : '-'}
              </p>
              <p className="text-sm text-slate-400">
                {tickerPrice ? formatGHS(tickerPrice * ghsRate) : '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className={`rounded-full px-3 py-1 text-sm font-medium ${
              (priceChange24h ?? 0) >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
            }`}>
              {(priceChange24h ?? 0) >= 0 ? '+' : ''}
              {(priceChange24h ?? 0).toFixed(2)}% 24h
            </div>
            <p className="text-xs text-slate-400">
              Last updated: {realtime.lastUpdated ? `${realtime.secondsSinceUpdate}s ago` : 'waiting for feed'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-3 grid gap-2 rounded-2xl border border-[#1A1D27] bg-[#0D1118] p-3 text-xs text-slate-300 md:grid-cols-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Date</p>
          <p className="mt-1 truncate text-slate-100">{displayedCandle?.timeLabel ?? '-'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Open</p>
          <p className="mt-1 text-slate-100">{displayedCandle ? formatPrice(displayedCandle.open, 'USD') : '-'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">High</p>
          <p className="mt-1 text-slate-100">{displayedCandle ? formatPrice(displayedCandle.high, 'USD') : '-'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Low</p>
          <p className="mt-1 text-slate-100">{displayedCandle ? formatPrice(displayedCandle.low, 'USD') : '-'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Close</p>
          <p className="mt-1 text-slate-100">
            {displayedCandle ? `${formatPrice(displayedCandle.close, 'USD')} / ${formatGHS(displayedCandle.close * ghsRate)}` : '-'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Volume</p>
          <p className="mt-1 text-slate-100">{displayedCandle ? formatVolume(displayedCandle.volume) : '-'}</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#1A1D27] bg-[#0A0A0F]">
        {ohlcvError && !liveCandles.length && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0A0A0F]/90 px-6 text-center">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              Failed to load candlestick data. Please refresh the page.
            </div>
          </div>
        )}
        {/* Full loading overlay only when there is no data yet */}
        {((isLoading && !liveCandles.length) || (!chartReady && !ohlcvError)) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0A0F]/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full border border-[#223556] bg-[#0D1118] px-4 py-2 text-sm text-slate-300">
              <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" />
              Loading candles...
            </div>
          </div>
        )}
        {/* Subtle corner indicator during background refetches */}
        {isFetching && liveCandles.length > 0 && (
          <div className="absolute right-3 top-3 z-10">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 block" />
          </div>
        )}
        <div ref={containerRef} style={{ height }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <p>Last updated: {realtime.lastUpdated ? `${realtime.secondsSinceUpdate} seconds ago` : 'waiting for feed'}</p>
        <p>
          {realtime.isWebsocket
            ? '⚡ Binance WebSocket'
            : realtime.isPolling
            ? `CoinGecko polling · refresh every ${pollIntervalMs ? `${pollIntervalMs / 1000 >= 60 ? `${pollIntervalMs / 60_000}m` : `${pollIntervalMs / 1000}s`}` : '—'}`
            : 'No live feed'}
        </p>
      </div>
    </div>
  );
});
