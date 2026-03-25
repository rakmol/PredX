import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type AreaData,
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
import type { PredictionResult } from '@/types';
import type { ChartTimeframe } from './chartUtils';
import {
  DEFAULT_OVERLAYS,
  TIMEFRAME_CONFIG,
  applyLivePriceToCandles,
  buildCandlestickData,
  buildLineData,
  buildVolumeData,
  enrichCandles,
  formatCrosshairDate,
  formatVolume,
  getTimeframeDays,
  type ChartOverlayState,
  type EnrichedCandle,
} from './PriceChart';

interface PredictionChartProps {
  coinId: string;
  prediction: PredictionResult;
  ghsRate?: number;
  timeframe?: ChartTimeframe;
  onTimeframeChange?: (timeframe: ChartTimeframe) => void;
  height?: number;
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

interface PredictionSeriesRefs {
  candle: ISeriesApi<'Candlestick', Time> | null;
  volume: ISeriesApi<'Histogram', Time> | null;
  ma7: ISeriesApi<'Line', Time> | null;
  ma25: ISeriesApi<'Line', Time> | null;
  ma99: ISeriesApi<'Line', Time> | null;
  bbUpper: ISeriesApi<'Line', Time> | null;
  bbMiddle: ISeriesApi<'Line', Time> | null;
  bbLower: ISeriesApi<'Line', Time> | null;
  bullishBand: ISeriesApi<'Area', Time> | null;
  bearishBand: ISeriesApi<'Area', Time> | null;
  confidenceUpper: ISeriesApi<'Line', Time> | null;
  confidenceLower: ISeriesApi<'Line', Time> | null;
  neutralPrediction: ISeriesApi<'Line', Time> | null;
  bullishPrediction: ISeriesApi<'Line', Time> | null;
  bearishPrediction: ISeriesApi<'Line', Time> | null;
}

function createEmptySeriesRefs(): PredictionSeriesRefs {
  return {
    candle: null,
    volume: null,
    ma7: null,
    ma25: null,
    ma99: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    bullishBand: null,
    bearishBand: null,
    confidenceUpper: null,
    confidenceLower: null,
    neutralPrediction: null,
    bullishPrediction: null,
    bearishPrediction: null,
  };
}

const OVERLAY_OPTIONS = [
  { key: 'ma7', label: 'MA7', color: '#3B82F6' },
  { key: 'ma25', label: 'MA25', color: '#F59E0B' },
  { key: 'ma99', label: 'MA99', color: '#8B5CF6' },
  { key: 'bollinger', label: 'Bollinger', color: '#94A3B8' },
] as const;

function toUtcTimestamp(timestamp: number) {
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function buildPredictionPath(candles: EnrichedCandle[], prediction: PredictionResult) {
  const lastCandle = candles[candles.length - 1];
  if (!lastCandle) {
    return {
      neutralLine: [] as LineData[],
      bullishLine: [] as LineData[],
      bearishLine: [] as LineData[],
      bullishBand: [] as AreaData[],
      bearishBand: [] as AreaData[],
      confidenceUpper: [] as LineData[],
      confidenceLower: [] as LineData[],
    };
  }

  const targetDays =
    prediction.prediction_horizon === '24h'
      ? 1
      : prediction.prediction_horizon === '7d'
        ? 7
        : prediction.prediction_horizon === '30d'
          ? 30
          : 90;

  const targetStepCount = Math.max(8, targetDays === 1 ? 12 : 10);
  const stepMs = (targetDays * 24 * 60 * 60 * 1000) / targetStepCount;

  const neutralTarget = prediction.scenarios.neutral.price_target ?? lastCandle.close;
  const bullishTarget = prediction.scenarios.bullish.price_target ?? neutralTarget;
  const bearishTarget = prediction.scenarios.bearish.price_target ?? neutralTarget;

  const neutralLine: LineData[] = [];
  const bullishLine: LineData[] = [];
  const bearishLine: LineData[] = [];
  const bullishBand: AreaData[] = [];
  const bearishBand: AreaData[] = [];
  const confidenceUpper: LineData[] = [];
  const confidenceLower: LineData[] = [];

  for (let step = 1; step <= targetStepCount; step += 1) {
    const progress = step / targetStepCount;
    const time = toUtcTimestamp(lastCandle.timestamp + stepMs * step);
    const neutral = lastCandle.close + (neutralTarget - lastCandle.close) * progress;
    const bullish = lastCandle.close + (bullishTarget - lastCandle.close) * progress;
    const bearish = lastCandle.close + (bearishTarget - lastCandle.close) * progress;
    const confidenceSpread = Math.max(Math.abs(bullish - bearish) * 0.18, neutral * 0.015);

    neutralLine.push({ time, value: neutral });
    bullishLine.push({ time, value: bullish });
    bearishLine.push({ time, value: bearish });
    bullishBand.push({ time, value: bullish });
    bearishBand.push({ time, value: bearish });
    confidenceUpper.push({ time, value: neutral + confidenceSpread });
    confidenceLower.push({ time, value: neutral - confidenceSpread });
  }

  return { neutralLine, bullishLine, bearishLine, bullishBand, bearishBand, confidenceUpper, confidenceLower };
}

function syncOverlayVisibility(seriesRefs: PredictionSeriesRefs, overlays: ChartOverlayState) {
  seriesRefs.ma7?.applyOptions({ visible: overlays.ma7 });
  seriesRefs.ma25?.applyOptions({ visible: overlays.ma25 });
  seriesRefs.ma99?.applyOptions({ visible: overlays.ma99 });
  seriesRefs.bbUpper?.applyOptions({ visible: overlays.bollinger });
  seriesRefs.bbMiddle?.applyOptions({ visible: overlays.bollinger });
  seriesRefs.bbLower?.applyOptions({ visible: overlays.bollinger });
}

function syncTechnicalData(seriesRefs: PredictionSeriesRefs, candles: EnrichedCandle[]) {
  seriesRefs.ma7?.setData(buildLineData(candles, 'ma7'));
  seriesRefs.ma25?.setData(buildLineData(candles, 'ma25'));
  seriesRefs.ma99?.setData(buildLineData(candles, 'ma99'));
  seriesRefs.bbUpper?.setData(buildLineData(candles, 'bbUpper'));
  seriesRefs.bbMiddle?.setData(buildLineData(candles, 'bbMiddle'));
  seriesRefs.bbLower?.setData(buildLineData(candles, 'bbLower'));
}

function syncPredictionData(
  seriesRefs: PredictionSeriesRefs,
  candles: EnrichedCandle[],
  prediction: PredictionResult,
) {
  const path = buildPredictionPath(candles, prediction);
  seriesRefs.bullishBand?.setData(path.bullishBand);
  seriesRefs.bearishBand?.setData(path.bearishBand);
  seriesRefs.confidenceUpper?.setData(path.confidenceUpper);
  seriesRefs.confidenceLower?.setData(path.confidenceLower);
  seriesRefs.neutralPrediction?.setData(path.neutralLine);
  seriesRefs.bullishPrediction?.setData(path.bullishLine);
  seriesRefs.bearishPrediction?.setData(path.bearishLine);
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

export default memo(function PredictionChart({
  coinId,
  prediction,
  ghsRate = 15.5,
  timeframe,
  onTimeframeChange,
  height = 460,
}: PredictionChartProps) {
  const [internalTimeframe, setInternalTimeframe] = useState<ChartTimeframe>('3M');
  const [overlays, setOverlays] = useState<ChartOverlayState>(DEFAULT_OVERLAYS);
  const [hover, setHover] = useState<HoverSnapshot | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [liveCandles, setLiveCandles] = useState<EnrichedCandle[]>([]);
  const [priceFlash, setPriceFlash] = useState<PriceFlashState>({ direction: null });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<PredictionSeriesRefs>(createEmptySeriesRefs());
  const latestCandlesRef = useRef<EnrichedCandle[]>([]);
  const previousLivePriceRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const seededHistoryKeyRef = useRef<string | null>(null);

  const activeTimeframe = timeframe ?? internalTimeframe;
  const setTimeframe = onTimeframeChange ?? setInternalTimeframe;
  const days = useMemo(() => getTimeframeDays(activeTimeframe), [activeTimeframe]);
  const { data: ohlcv = [], isLoading, isFetching } = useOHLCV(coinId, days);
  const realtime = useRealtimePrice({ coinId, timeframe: activeTimeframe });

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

    seriesRefs.current.bullishBand = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(34,197,94,0.75)',
      topColor: 'rgba(34,197,94,0.16)',
      bottomColor: 'rgba(34,197,94,0.02)',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    seriesRefs.current.bearishBand = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(239,68,68,0.75)',
      topColor: 'rgba(239,68,68,0.14)',
      bottomColor: 'rgba(239,68,68,0.02)',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    seriesRefs.current.confidenceUpper = chart.addSeries(LineSeries, {
      color: 'rgba(203,213,225,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.confidenceLower = chart.addSeries(LineSeries, {
      color: 'rgba(203,213,225,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.neutralPrediction = chart.addSeries(LineSeries, {
      color: prediction.is_blurred ? 'rgba(226,232,240,0.35)' : '#E2E8F0',
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: true,
    });
    seriesRefs.current.bullishPrediction = chart.addSeries(LineSeries, {
      color: 'rgba(34,197,94,0.9)',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRefs.current.bearishPrediction = chart.addSeries(LineSeries, {
      color: 'rgba(239,68,68,0.9)',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const panes = chart.panes();
    if (panes[1]) panes[1].setHeight(Math.max(90, Math.round(height * 0.2)));

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
  }, [days, height, liveCandles.length, prediction.is_blurred]);

  useEffect(() => {
    if (!chartRef.current || liveCandles.length === 0 || !seriesRefs.current.candle || !seriesRefs.current.volume) {
      return;
    }

    const historyKey = `${coinId}:${days}:${liveCandles[0]?.timestamp ?? 0}:${liveCandles[liveCandles.length - 1]?.timestamp ?? 0}`;
    seriesRefs.current.candle.setData(buildCandlestickData(liveCandles));
    seriesRefs.current.volume.setData(buildVolumeData(liveCandles));
    syncTechnicalData(seriesRefs.current, liveCandles);
    syncPredictionData(seriesRefs.current, liveCandles, prediction);
    syncOverlayVisibility(seriesRefs.current, overlays);

    if (seededHistoryKeyRef.current !== historyKey) {
      chartRef.current.timeScale().fitContent();
      seededHistoryKeyRef.current = historyKey;
    }
  }, [coinId, days, liveCandles, overlays, prediction]);

  useEffect(() => {
    syncOverlayVisibility(seriesRefs.current, overlays);
    seriesRefs.current.neutralPrediction?.applyOptions({
      color: prediction.is_blurred ? 'rgba(226,232,240,0.35)' : '#E2E8F0',
    });
  }, [overlays, prediction.is_blurred]);

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
    syncTechnicalData(seriesRefs.current, nextCandles);
    syncPredictionData(seriesRefs.current, nextCandles, prediction);
    syncOverlayVisibility(seriesRefs.current, overlays);
  }, [
    overlays,
    prediction,
    realtime.currentPrice,
    realtime.lastTradeVolumeUsd,
    realtime.lastUpdated,
  ]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  return (
    <div className="relative rounded-2xl border border-[#1E3050] bg-[#0A0A0F] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-100">
            <Sparkles size={16} className="text-cyan-300" />
            <h3 className="text-sm font-semibold">Candles + AI Projection</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Live candlesticks with AI projection bands, confidence bounds, and real-time price updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[#223556] bg-[#11131A] px-3 py-2 text-xs ${connectionState.text}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${connectionState.dot}`} />
            {connectionState.label}
          </div>

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

          <div className="flex flex-wrap gap-2">
            {OVERLAY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setOverlays((current) => ({ ...current, [option.key]: !current[option.key] }))}
                className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 py-2 text-xs transition ${
                  overlays[option.key]
                    ? 'border-white/15 bg-white/10 text-slate-100'
                    : 'border-[#223556] bg-[#11131A] text-slate-400'
                }`}
              >
                <Sparkles size={12} style={{ color: option.color }} />
                {option.label}
              </button>
            ))}
          </div>

          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#223556] bg-[#11131A] px-3 py-2 text-xs text-slate-300">
            {prediction.is_blurred ? <Lock size={12} className="text-amber-300" /> : <Sparkles size={12} className="text-emerald-300" />}
            Prediction
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
              (realtime.priceChange24h ?? 0) >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
            }`}>
              {(realtime.priceChange24h ?? 0) >= 0 ? '+' : ''}
              {(realtime.priceChange24h ?? 0).toFixed(2)}% 24h
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
        {(isLoading || isFetching || !chartReady) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0A0F]/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full border border-[#223556] bg-[#0D1118] px-4 py-2 text-sm text-slate-300">
              <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" />
              Loading candles...
            </div>
          </div>
        )}

        <div ref={containerRef} style={{ height }} />

        {prediction.is_blurred && (
          <div className="pointer-events-none absolute inset-y-6 right-4 flex w-[34%] min-w-[220px] items-center justify-center rounded-2xl bg-[#0A0A0F]/58 backdrop-blur-sm">
            <div className="rounded-2xl border border-white/10 bg-[#0D1118]/92 px-4 py-3 text-center shadow-xl">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15">
                <Lock size={16} className="text-amber-300" />
              </div>
              <p className="text-sm font-semibold text-slate-100">Prediction</p>
              <p className="mt-1 text-xs text-slate-400">Upgrade to reveal the full AI path</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <p>Last updated: {realtime.lastUpdated ? `${realtime.secondsSinceUpdate} seconds ago` : 'waiting for feed'}</p>
        <p>{realtime.isWebsocket ? 'Binance WebSocket' : realtime.isPolling ? 'CoinGecko polling' : 'No live feed'}</p>
      </div>
    </div>
  );
});
