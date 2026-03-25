// Technical Analysis Engine
// Computes RSI, MACD, Bollinger Bands, Moving Averages from OHLCV data

import { OHLCVData, TechnicalIndicators } from '../types';

function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < prices.length; i++) {
    const current = prices[i] * k + prev * (1 - k);
    result.push(current);
    prev = current;
  }
  return result;
}

function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  const recent_gains = gains.slice(-period);
  const recent_losses = losses.slice(-period);
  const avg_gain = recent_gains.reduce((a, b) => a + b, 0) / period;
  const avg_loss = recent_losses.reduce((a, b) => a + b, 0) / period;
  if (avg_loss === 0) return 100;
  const rs = avg_gain / avg_loss;
  return 100 - 100 / (1 + rs);
}

function computeMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  if (prices.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const len = Math.min(ema12.length, ema26.length);
  const macd_line: number[] = [];
  for (let i = 0; i < len; i++) {
    macd_line.push(ema12[ema12.length - len + i] - ema26[ema26.length - len + i]);
  }
  const signal_line = ema(macd_line, 9);
  const macd_val = macd_line[macd_line.length - 1];
  const signal_val = signal_line[signal_line.length - 1];
  return {
    macd: macd_val,
    signal: signal_val,
    histogram: macd_val - signal_val,
  };
}

function computeBollinger(prices: number[], period = 20, stdDev = 2) {
  if (prices.length < period) {
    const p = prices[prices.length - 1];
    return { upper: p * 1.05, middle: p, lower: p * 0.95, bandwidth: 0.1 };
  }
  const recent = prices.slice(-period);
  const middle = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((acc, p) => acc + Math.pow(p - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: middle + stdDev * std,
    middle,
    lower: middle - stdDev * std,
    bandwidth: (stdDev * 2 * std) / middle,
  };
}

function findSupportResistance(prices: number[]): { support: number[]; resistance: number[] } {
  if (prices.length < 20) return { support: [], resistance: [] };
  const recent = prices.slice(-60);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const current = recent[recent.length - 1];
  // Simple pivot-based S/R
  const support: number[] = [];
  const resistance: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i] < recent[i - 1] && recent[i] < recent[i - 2] && recent[i] < recent[i + 1] && recent[i] < recent[i + 2]) {
      if (recent[i] < current) support.push(recent[i]);
    }
    if (recent[i] > recent[i - 1] && recent[i] > recent[i - 2] && recent[i] > recent[i + 1] && recent[i] > recent[i + 2]) {
      if (recent[i] > current) resistance.push(recent[i]);
    }
  }
  // Deduplicate close levels (within 1%)
  const dedup = (arr: number[]) => arr.filter((v, i, a) => !a.slice(0, i).some(u => Math.abs(u - v) / v < 0.01));
  return {
    support: dedup(support).sort((a, b) => b - a).slice(0, 3),
    resistance: dedup(resistance).sort((a, b) => a - b).slice(0, 3),
  };
}

export function computeTechnicals(ohlcv: OHLCVData[]): TechnicalIndicators {
  const closes = ohlcv.map(d => d.close);
  const volumes = ohlcv.map(d => d.volume);

  const rsi = computeRSI(closes);
  const rsi_signal = rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral';

  const { macd, signal, histogram } = computeMACD(closes);
  const macd_trend = histogram > 0 && macd > 0 ? 'bullish' : histogram < 0 && macd < 0 ? 'bearish' : 'neutral';

  const boll = computeBollinger(closes);
  const current = closes[closes.length - 1];
  let boll_position: TechnicalIndicators['bollinger']['position'];
  if (current > boll.upper) boll_position = 'above_upper';
  else if (current > boll.middle + (boll.upper - boll.middle) * 0.5) boll_position = 'upper_zone';
  else if (current > boll.middle - (boll.middle - boll.lower) * 0.5) boll_position = 'middle_zone';
  else if (current > boll.lower) boll_position = 'lower_zone';
  else boll_position = 'below_lower';

  const ma7_arr = sma(closes, 7);
  const ma25_arr = sma(closes, 25);
  const ma99_arr = sma(closes, Math.min(99, closes.length));
  const ema12_arr = ema(closes, 12);
  const ema26_arr = ema(closes, 26);

  const ma7 = ma7_arr[ma7_arr.length - 1] ?? current;
  const ma25 = ma25_arr[ma25_arr.length - 1] ?? current;
  const ma99 = ma99_arr[ma99_arr.length - 1] ?? current;
  const ema12_val = ema12_arr[ema12_arr.length - 1] ?? current;
  const ema26_val = ema26_arr[ema26_arr.length - 1] ?? current;

  let ma_trend: TechnicalIndicators['moving_averages']['trend'];
  if (current > ma7 && ma7 > ma25 && ma25 > ma99) ma_trend = 'strong_bullish';
  else if (current > ma25 && ma25 > ma99) ma_trend = 'bullish';
  else if (current < ma7 && ma7 < ma25 && ma25 < ma99) ma_trend = 'strong_bearish';
  else if (current < ma25 && ma25 < ma99) ma_trend = 'bearish';
  else ma_trend = 'neutral';

  const recent_vols = volumes.slice(-14);
  const older_vols = volumes.slice(-28, -14);
  const avg_recent = recent_vols.reduce((a, b) => a + b, 0) / recent_vols.length;
  const avg_older = older_vols.reduce((a, b) => a + b, 0) / older_vols.length;
  const volume_trend = avg_recent > avg_older * 1.1 ? 'increasing' : avg_recent < avg_older * 0.9 ? 'decreasing' : 'neutral';

  const { support, resistance } = findSupportResistance(closes);

  return {
    rsi,
    rsi_signal,
    macd: { macd, signal, histogram, trend: macd_trend },
    bollinger: { upper: boll.upper, middle: boll.middle, lower: boll.lower, position: boll_position, bandwidth: boll.bandwidth },
    moving_averages: { ma7, ma25, ma99, ema12: ema12_val, ema26: ema26_val, trend: ma_trend },
    volume_trend,
    support_levels: support,
    resistance_levels: resistance,
  };
}
