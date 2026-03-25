import { format } from 'date-fns';
import type { CoinHistoryPoint, PredictionResult } from '@/types';

export type ChartTimeframe = '1D' | '7D' | '1M' | '3M' | '1Y';

export interface ChartPoint extends CoinHistoryPoint {
  label: string;
  ma7: number | null;
  ma25: number | null;
  ma99: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  avgVolume: number | null;
  historicalPrice?: number | null;
  isPrediction?: boolean;
  predictedPrice?: number | null;
  bullish?: number | null;
  neutral?: number | null;
  bearish?: number | null;
  confidenceUpper?: number | null;
  confidenceLower?: number | null;
  bearishBase?: number | null;
  bearishRange?: number | null;
  bullishRange?: number | null;
  confidenceBase?: number | null;
  confidenceRange?: number | null;
}

export const TIMEFRAME_OPTIONS: { value: ChartTimeframe; label: string; days: number }[] = [
  { value: '1D', label: '1D', days: 1 },
  { value: '7D', label: '7D', days: 7 },
  { value: '1M', label: '1M', days: 30 },
  { value: '3M', label: '3M', days: 90 },
  { value: '1Y', label: '1Y', days: 365 },
];

function simpleMovingAverage(values: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  let sum = 0;
  for (let current = index - period + 1; current <= index; current += 1) sum += values[current] ?? 0;
  return sum / period;
}

function standardDeviation(values: number[], period: number, index: number, mean: number): number | null {
  if (index < period - 1) return null;
  let variance = 0;
  for (let current = index - period + 1; current <= index; current += 1) {
    const value = values[current] ?? 0;
    variance += (value - mean) ** 2;
  }
  return Math.sqrt(variance / period);
}

function computeEma(values: number[], period: number): Array<number | null> {
  const multiplier = 2 / (period + 1);
  const ema: Array<number | null> = new Array(values.length).fill(null);
  if (values.length < period) return ema;

  let seed = 0;
  for (let index = 0; index < period; index += 1) seed += values[index] ?? 0;
  ema[period - 1] = seed / period;

  for (let index = period; index < values.length; index += 1) {
    const previous = ema[index - 1] ?? values[index - 1] ?? 0;
    ema[index] = ((values[index] ?? 0) - previous) * multiplier + previous;
  }

  return ema;
}

function computeRsi(values: number[], period = 14): Array<number | null> {
  const rsi: Array<number | null> = new Array(values.length).fill(null);
  if (values.length <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;

  for (let index = 1; index <= period; index += 1) {
    const delta = (values[index] ?? 0) - (values[index - 1] ?? 0);
    if (delta >= 0) gainSum += delta;
    else lossSum += Math.abs(delta);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = (values[index] ?? 0) - (values[index - 1] ?? 0);
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

function formatLabel(timestamp: number, days: number): string {
  const date = new Date(timestamp);
  if (days <= 1) return format(date, 'HH:mm');
  if (days <= 7) return format(date, 'EEE HH:mm');
  if (days <= 30) return format(date, 'MMM d');
  return format(date, 'MMM d');
}

export function formatTooltipDate(timestamp: number, timeframe: ChartTimeframe): string {
  const date = new Date(timestamp);
  if (timeframe === '1D') return format(date, 'MMM d, HH:mm');
  if (timeframe === '7D') return format(date, 'EEE, MMM d, HH:mm');
  return format(date, 'MMM d, yyyy');
}

export function filterHistoryByTimeframe(history: CoinHistoryPoint[], timeframe: ChartTimeframe): CoinHistoryPoint[] {
  const sorted = [...history].sort((left, right) => left.timestamp - right.timestamp);
  if (!sorted.length) return [];
  const days = TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.days ?? 30;
  const latest = sorted[sorted.length - 1]?.timestamp ?? Date.now();
  const cutoff = latest - days * 24 * 60 * 60 * 1000;
  return sorted.filter((point) => point.timestamp >= cutoff);
}

export function buildChartSeries(history: CoinHistoryPoint[], timeframe: ChartTimeframe): ChartPoint[] {
  const sorted = [...history].sort((left, right) => left.timestamp - right.timestamp);
  const filtered = filterHistoryByTimeframe(sorted, timeframe);
  const prices = filtered.map((point) => point.price);
  const volumes = filtered.map((point) => point.volume);
  const ema12 = computeEma(prices, 12);
  const ema26 = computeEma(prices, 26);
  const macdLine = prices.map((_, index) =>
    ema12[index] !== null && ema26[index] !== null ? (ema12[index] as number) - (ema26[index] as number) : null
  );
  const signalLine = computeEma(macdLine.map((value) => value ?? 0), 9);
  const rsi = computeRsi(prices, 14);
  const days = TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.days ?? 30;

  return filtered.map((point, index) => {
    const ma7 = simpleMovingAverage(prices, 7, index);
    const ma25 = simpleMovingAverage(prices, 25, index);
    const ma99 = simpleMovingAverage(prices, 99, index);
    const bbMiddle = simpleMovingAverage(prices, 20, index);
    const stdDev = bbMiddle !== null ? standardDeviation(prices, 20, index, bbMiddle) : null;
    const macd = macdLine[index];
    const macdSignal = signalLine[index] !== null && index >= 25 ? signalLine[index] : null;

    return {
      ...point,
      label: formatLabel(point.timestamp, days),
      ma7,
      ma25,
      ma99,
      bbUpper: bbMiddle !== null && stdDev !== null ? bbMiddle + stdDev * 2 : null,
      bbMiddle,
      bbLower: bbMiddle !== null && stdDev !== null ? bbMiddle - stdDev * 2 : null,
      rsi: rsi[index],
      macd,
      macdSignal,
      macdHistogram: macd !== null && macdSignal !== null ? macd - macdSignal : null,
      avgVolume: simpleMovingAverage(volumes, 20, index),
      historicalPrice: point.price,
    };
  });
}

export function buildPredictionSeries(
  history: CoinHistoryPoint[],
  timeframe: ChartTimeframe,
  prediction: PredictionResult
): ChartPoint[] {
  const baseSeries = buildChartSeries(history, timeframe);
  if (!baseSeries.length) return [];

  const lastPoint = baseSeries[baseSeries.length - 1];
  const horizonDays = prediction.prediction_horizon === '24h'
    ? 1
    : prediction.prediction_horizon === '7d'
      ? 7
      : prediction.prediction_horizon === '30d'
        ? 30
        : 90;

  const steps = Math.max(6, Math.min(12, horizonDays === 1 ? 8 : horizonDays));
  const interval = (horizonDays * 24 * 60 * 60 * 1000) / steps;
  const futurePoints: ChartPoint[] = [];
  const bullishTarget = prediction.scenarios.bullish.price_target ?? lastPoint.price;
  const neutralTarget = prediction.scenarios.neutral.price_target ?? lastPoint.price;
  const bearishTarget = prediction.scenarios.bearish.price_target ?? lastPoint.price;

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const timestamp = lastPoint.timestamp + interval * step;
    const neutral = lastPoint.price + (neutralTarget - lastPoint.price) * progress;
    const bullish = lastPoint.price + (bullishTarget - lastPoint.price) * progress;
    const bearish = lastPoint.price + (bearishTarget - lastPoint.price) * progress;
    const spread = Math.max(Math.abs(bullish - bearish) * 0.18, Math.abs(neutral) * 0.02);

    futurePoints.push({
      timestamp,
      price: neutral,
      volume: 0,
      label: formatLabel(timestamp, horizonDays),
      ma7: null,
      ma25: null,
      ma99: null,
      bbUpper: null,
      bbMiddle: null,
      bbLower: null,
      rsi: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      avgVolume: null,
      historicalPrice: null,
      isPrediction: true,
      predictedPrice: neutral,
      bullish,
      neutral,
      bearish,
      confidenceUpper: neutral + spread,
      confidenceLower: neutral - spread,
      bearishBase: bearish,
      bearishRange: neutral - bearish,
      bullishRange: bullish - neutral,
      confidenceBase: neutral - spread,
      confidenceRange: spread * 2,
    });
  }

  return [
    ...baseSeries.map((point) => ({
      ...point,
      bullish: null,
      neutral: null,
      bearish: null,
      confidenceUpper: null,
      confidenceLower: null,
      bearishBase: null,
      bearishRange: null,
      bullishRange: null,
      confidenceBase: null,
      confidenceRange: null,
      historicalPrice: point.price,
      predictedPrice: null,
      isPrediction: false,
    })),
    ...futurePoints,
  ];
}

export function formatCompactVolume(volume: number): string {
  if (volume >= 1e12) return `${(volume / 1e12).toFixed(2)}T`;
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
  return volume.toFixed(0);
}
