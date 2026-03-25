/**
 * PredX Technical Analysis Engine
 *
 * Pure TypeScript — no external libraries. All math explained inline.
 * Input: arrays of closing prices (and volumes where needed).
 * Output: typed result objects consumed by the AI prediction pipeline
 *         and rendered directly in UI components.
 */

// ─── Input type ───────────────────────────────────────────────────────────────

export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface RSIResult {
  value: number;
  signal: 'overbought' | 'neutral' | 'oversold';
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface MovingAveragesResult {
  ma7: number;
  ma25: number;
  ma99: number;
  ema12: number;
  ema26: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  golden_cross: boolean;  // ma7 crosses above ma99 — strong buy
  death_cross: boolean;   // ma7 crosses below ma99 — strong sell
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;       // (upper - lower) / middle — measures volatility
  percent_b: number;       // where price sits within the bands (0=lower, 1=upper)
  position: 'above_upper' | 'near_upper' | 'inside' | 'near_lower' | 'below_lower';
}

export interface VolumeResult {
  current: number;
  average: number;
  ratio: number;           // current / average
  signal: 'high' | 'normal' | 'low';
}

export interface TechnicalScore {
  score: number;           // 0–100
  label: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  breakdown: {
    rsi_points: number;
    macd_points: number;
    ma_points: number;
    bollinger_points: number;
    volume_points: number;
  };
}

export interface FullTechnicalAnalysis {
  rsi: RSIResult;
  macd: MACDResult;
  moving_averages: MovingAveragesResult;
  bollinger: BollingerResult;
  volume: VolumeResult;
  score: TechnicalScore;
  support_levels: number[];
  resistance_levels: number[];
}

// ─── Math primitives ──────────────────────────────────────────────────────────

/** Simple moving average over the last `period` values of `data`. */
function sma(data: number[], period: number): number {
  if (data.length < period) return data.reduce((a, b) => a + b, 0) / data.length;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Exponential moving average.
 *
 * EMA gives more weight to recent prices via a smoothing multiplier k.
 *   k = 2 / (period + 1)
 *   EMA_today = price * k + EMA_yesterday * (1 - k)
 *
 * We seed the first EMA value with the SMA of the first `period` candles,
 * then apply the formula forward.
 */
function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];

  // Seed with first SMA
  const seed = data.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, data.length);
  result.push(seed);

  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** Standard deviation of an array. */
function stddev(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / data.length;
  return Math.sqrt(variance);
}

/** Round to N decimal places. */
function round(n: number, dp = 2): number {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

// ─── 1. RSI ───────────────────────────────────────────────────────────────────

/**
 * Relative Strength Index (14-period by default).
 *
 * RSI measures the speed and magnitude of price changes.
 * Formula:
 *   RS = average gain over N periods / average loss over N periods
 *   RSI = 100 - (100 / (1 + RS))
 *
 * Wilder's smoothing: after the initial average, each subsequent
 * average = (prev_avg * (N-1) + current) / N  (not a simple rolling avg).
 *
 * Thresholds:
 *   >70 → overbought (price likely to pull back)
 *   <30 → oversold (price likely to bounce)
 *   30–70 → neutral
 */
export function calculateRSI(closes: number[], period = 14): RSIResult {
  if (closes.length < period + 1) {
    return { value: 50, signal: 'neutral' };
  }

  // Step 1: compute per-candle gains and losses
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));

  // Step 2: seed with simple average of first `period` values
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Step 3: Wilder's smoothing for remaining candles
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const value = round(100 - 100 / (1 + rs));

  return {
    value,
    signal: value >= 70 ? 'overbought' : value <= 30 ? 'oversold' : 'neutral',
  };
}

// ─── 2. MACD ──────────────────────────────────────────────────────────────────

/**
 * Moving Average Convergence Divergence.
 *
 * MACD line     = EMA(12) - EMA(26)
 * Signal line   = EMA(9) of the MACD line
 * Histogram     = MACD - Signal
 *
 * Bullish signal: MACD crosses above Signal (histogram goes positive)
 * Bearish signal: MACD crosses below Signal (histogram goes negative)
 *
 * We use the full EMA series and take the last value for each.
 */
export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  if (closes.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' };
  }

  const ema12 = ema(closes, fastPeriod);
  const ema26 = ema(closes, slowPeriod);

  // Align: both series start at index 0 but ema26 is seeded differently.
  // We compute the MACD line for each position where both are defined.
  const macdLine = ema12.map((v, i) => v - ema26[i]);

  // Signal = EMA(9) of the MACD line
  const signalLine = ema(macdLine, signalPeriod);

  const macdVal  = macdLine[macdLine.length - 1];
  const sigVal   = signalLine[signalLine.length - 1];
  const histVal  = macdVal - sigVal;

  // Previous histogram to detect fresh crossovers
  const prevHist = (macdLine[macdLine.length - 2] ?? macdVal) -
                   (signalLine[signalLine.length - 2] ?? sigVal);

  let trend: MACDResult['trend'] = 'neutral';
  if (histVal > 0 && prevHist <= 0) trend = 'bullish'; // fresh bullish crossover
  else if (histVal < 0 && prevHist >= 0) trend = 'bearish'; // fresh bearish crossover
  else if (histVal > 0) trend = 'bullish';
  else if (histVal < 0) trend = 'bearish';

  return {
    macd:      round(macdVal, 4),
    signal:    round(sigVal, 4),
    histogram: round(histVal, 4),
    trend,
  };
}

// ─── 3. Moving Averages ───────────────────────────────────────────────────────

/**
 * Simple and exponential moving averages for trend detection.
 *
 * Golden cross: short MA (7) crosses above long MA (99) → strong bullish
 * Death cross:  short MA (7) crosses below long MA (99) → strong bearish
 *
 * Trend determination:
 *   price > MA7 > MA25 > MA99 → bullish alignment
 *   price < MA7 < MA25 < MA99 → bearish alignment
 */
export function calculateMovingAverages(closes: number[]): MovingAveragesResult {
  const price = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2] ?? price;

  const ma7  = round(sma(closes, 7));
  const ma25 = round(sma(closes, 25));
  const ma99 = round(sma(closes, Math.min(99, closes.length)));

  const ema12Series = ema(closes, 12);
  const ema26Series = ema(closes, 26);
  const ema12val = round(ema12Series[ema12Series.length - 1], 4);
  const ema26val = round(ema26Series[ema26Series.length - 1], 4);

  // Previous MA7 and MA99 for cross detection
  const prevMa7  = closes.length >= 8  ? sma(closes.slice(0, -1), 7)  : ma7;
  const prevMa99 = closes.length >= 100 ? sma(closes.slice(0, -1), 99) : ma99;

  const golden_cross = prevMa7 <= prevMa99 && ma7 > ma99;
  const death_cross  = prevMa7 >= prevMa99 && ma7 < ma99;

  // Bullish: price above all MAs in ascending order
  const bullishAlignment = price > ma7 && ma7 > ma25 && ma25 > ma99;
  // Bearish: price below all MAs in descending order
  const bearishAlignment = price < ma7 && ma7 < ma25 && ma25 < ma99;

  let trend: MovingAveragesResult['trend'] = 'neutral';
  if (golden_cross || bullishAlignment) trend = 'bullish';
  else if (death_cross || bearishAlignment) trend = 'bearish';
  else if (price > ma99 && prevPrice > ma99) trend = 'bullish';
  else if (price < ma99 && prevPrice < ma99) trend = 'bearish';

  return { ma7, ma25, ma99, ema12: ema12val, ema26: ema26val, trend, golden_cross, death_cross };
}

// ─── 4. Bollinger Bands ───────────────────────────────────────────────────────

/**
 * Bollinger Bands (20-period, ±2 standard deviations).
 *
 * Middle band = SMA(20)
 * Upper band  = SMA(20) + 2σ
 * Lower band  = SMA(20) - 2σ
 *
 * %B tells us exactly where price sits within the bands:
 *   %B = (price - lower) / (upper - lower)
 *   %B = 1 → at upper band
 *   %B = 0 → at lower band
 *   %B > 1 → above upper (strong overbought signal)
 *   %B < 0 → below lower (strong oversold signal)
 *
 * Bandwidth = (upper - lower) / middle — low bandwidth = squeeze (breakout imminent)
 */
export function calculateBollinger(closes: number[], period = 20, multiplier = 2): BollingerResult {
  if (closes.length < period) {
    const price = closes[closes.length - 1];
    return {
      upper: price * 1.02,
      middle: price,
      lower: price * 0.98,
      bandwidth: 0.04,
      percent_b: 0.5,
      position: 'inside',
    };
  }

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const sd = stddev(slice);

  const upper = round(middle + multiplier * sd);
  const lower = round(middle - multiplier * sd);
  const midRounded = round(middle);
  const bandwidth = round((upper - lower) / midRounded, 4);

  const price = closes[closes.length - 1];
  const percent_b = upper === lower ? 0.5 : round((price - lower) / (upper - lower), 4);

  let position: BollingerResult['position'];
  if (percent_b > 1)        position = 'above_upper';
  else if (percent_b > 0.8) position = 'near_upper';
  else if (percent_b < 0)   position = 'below_lower';
  else if (percent_b < 0.2) position = 'near_lower';
  else                      position = 'inside';

  return { upper, middle: midRounded, lower, bandwidth, percent_b, position };
}

// ─── 5. Volume Analysis ───────────────────────────────────────────────────────

/**
 * Volume analysis — is buying/selling pressure increasing?
 *
 * High volume confirms a price move; low volume suggests weak conviction.
 * We compare current volume against the 20-period average.
 *
 * ratio > 1.5 → high (strong conviction move)
 * ratio < 0.5 → low (weak move, may reverse)
 */
export function calculateVolume(volumes: number[], period = 20): VolumeResult {
  if (volumes.length === 0) {
    return { current: 0, average: 0, ratio: 1, signal: 'normal' };
  }

  const current = volumes[volumes.length - 1];
  const slice = volumes.slice(-period);
  const average = slice.reduce((a, b) => a + b, 0) / slice.length;
  const ratio = round(average > 0 ? current / average : 1, 3);

  return {
    current: round(current),
    average: round(average),
    ratio,
    signal: ratio >= 1.5 ? 'high' : ratio <= 0.5 ? 'low' : 'normal',
  };
}

// ─── 6. Support & Resistance Levels ──────────────────────────────────────────

/**
 * Identifies local support and resistance levels from recent price history.
 *
 * Method: pivot point detection — a price is a local high/low if it's
 * greater/less than the N candles on either side of it.
 *
 * Returns the 3 strongest support and resistance levels closest to current price.
 */
export function calculateSupportResistance(
  candles: OHLCVCandle[],
  lookback = 5,
): { support: number[]; resistance: number[] } {
  if (candles.length < lookback * 2 + 1) {
    const price = candles[candles.length - 1]?.close ?? 0;
    return {
      support: [round(price * 0.95), round(price * 0.90)],
      resistance: [round(price * 1.05), round(price * 1.10)],
    };
  }

  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const candle = candles[i];

    // Pivot high: this candle's high > all surrounding highs
    const isHigh = candles
      .slice(i - lookback, i + lookback + 1)
      .every((c, idx) => idx === lookback || c.high <= candle.high);
    if (isHigh) pivotHighs.push(candle.high);

    // Pivot low: this candle's low < all surrounding lows
    const isLow = candles
      .slice(i - lookback, i + lookback + 1)
      .every((c, idx) => idx === lookback || c.low >= candle.low);
    if (isLow) pivotLows.push(candle.low);
  }

  const currentPrice = candles[candles.length - 1].close;

  // Support = pivot lows BELOW current price, sorted desc (closest first)
  const support = pivotLows
    .filter((p) => p < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .map((p) => round(p));

  // Resistance = pivot highs ABOVE current price, sorted asc (closest first)
  const resistance = pivotHighs
    .filter((p) => p > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 3)
    .map((p) => round(p));

  return { support, resistance };
}

// ─── 7. Overall Technical Score ───────────────────────────────────────────────

/**
 * Composite technical score combining all indicators into a 0–100 value.
 *
 * Scoring weights:
 *   RSI        → 25 points
 *   MACD       → 25 points
 *   Moving Avg → 25 points
 *   Bollinger  → 15 points
 *   Volume     → 10 points
 *
 * 0–20   → Strong Sell
 * 21–40  → Sell
 * 41–60  → Neutral
 * 61–80  → Buy
 * 81–100 → Strong Buy
 */
export function calculateTechnicalScore(
  rsi: RSIResult,
  macd: MACDResult,
  ma: MovingAveragesResult,
  bb: BollingerResult,
  vol: VolumeResult,
): TechnicalScore {

  // ── RSI score (0–25) ──────────────────────────────────────────────────────
  // Oversold → bullish (score 20–25), overbought → bearish (0–5)
  let rsi_points: number;
  if (rsi.signal === 'oversold')        rsi_points = 22;
  else if (rsi.value < 40)              rsi_points = 18;
  else if (rsi.value <= 60)             rsi_points = 12; // neutral zone
  else if (rsi.value < 70)              rsi_points = 7;
  else                                  rsi_points = 3;  // overbought

  // ── MACD score (0–25) ────────────────────────────────────────────────────
  let macd_points: number;
  if (macd.trend === 'bullish' && macd.histogram > 0)       macd_points = 22;
  else if (macd.trend === 'bullish')                          macd_points = 16;
  else if (macd.trend === 'neutral')                          macd_points = 12;
  else if (macd.trend === 'bearish' && macd.histogram < 0)   macd_points = 3;
  else                                                        macd_points = 8;

  // ── MA score (0–25) ──────────────────────────────────────────────────────
  let ma_points: number;
  if (ma.golden_cross)                  ma_points = 25;
  else if (ma.death_cross)              ma_points = 0;
  else if (ma.trend === 'bullish')      ma_points = 20;
  else if (ma.trend === 'bearish')      ma_points = 5;
  else                                  ma_points = 12;

  // ── Bollinger score (0–15) ───────────────────────────────────────────────
  // Price near lower band → oversold → bullish
  // Price near upper band → overbought → bearish
  let bollinger_points: number;
  switch (bb.position) {
    case 'below_lower': bollinger_points = 14; break;
    case 'near_lower':  bollinger_points = 11; break;
    case 'inside':      bollinger_points = 8;  break;
    case 'near_upper':  bollinger_points = 4;  break;
    case 'above_upper': bollinger_points = 1;  break;
    default:            bollinger_points = 7;
  }

  // ── Volume score (0–10) ──────────────────────────────────────────────────
  // High volume confirms the trend → amplifies bullish/bearish bias
  // We use neutral volume here and let the sign come from other indicators
  let volume_points: number;
  if (vol.signal === 'high')        volume_points = 8;
  else if (vol.signal === 'normal') volume_points = 5;
  else                              volume_points = 2;

  const score = Math.min(
    100,
    Math.max(0, rsi_points + macd_points + ma_points + bollinger_points + volume_points),
  );

  let label: TechnicalScore['label'];
  let signal: TechnicalScore['signal'];
  if (score >= 81)      { label = 'Strong Buy';  signal = 'strong_buy'; }
  else if (score >= 61) { label = 'Buy';          signal = 'buy'; }
  else if (score >= 41) { label = 'Neutral';      signal = 'neutral'; }
  else if (score >= 21) { label = 'Sell';         signal = 'sell'; }
  else                  { label = 'Strong Sell';  signal = 'strong_sell'; }

  return {
    score,
    label,
    signal,
    breakdown: { rsi_points, macd_points, ma_points, bollinger_points, volume_points },
  };
}

// ─── Master function: run all indicators at once ──────────────────────────────

/**
 * Run the complete technical analysis suite on a candle array.
 *
 * @param candles - OHLCV candles from CoinGecko (at least 99 recommended)
 * @returns FullTechnicalAnalysis — all indicators + composite score
 */
export function analyzeCandles(candles: OHLCVCandle[]): FullTechnicalAnalysis {
  const closes  = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume ?? 0);

  const rsi  = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const ma   = calculateMovingAverages(closes);
  const bb   = calculateBollinger(closes);
  const vol  = calculateVolume(volumes);
  const score = calculateTechnicalScore(rsi, macd, ma, bb, vol);
  const { support, resistance } = calculateSupportResistance(candles);

  return { rsi, macd, moving_averages: ma, bollinger: bb, volume: vol, score, support_levels: support, resistance_levels: resistance };
}

/**
 * Convenience: run analysis directly from a price+volume history array
 * (as returned by CoinGecko's getPriceHistory / getOHLCV).
 */
export function analyzeFromHistory(
  points: { timestamp: number; price: number; volume?: number }[],
): FullTechnicalAnalysis {
  const candles: OHLCVCandle[] = points.map((p) => ({
    timestamp: p.timestamp,
    open: p.price,
    high: p.price,
    low: p.price,
    close: p.price,
    volume: p.volume,
  }));
  return analyzeCandles(candles);
}

// ─── Display helpers (kept from original file) ────────────────────────────────

export function rsiLabel(rsi: number): string {
  if (rsi >= 70) return 'Overbought';
  if (rsi <= 30) return 'Oversold';
  return 'Neutral';
}

export function rsiColor(rsi: number): string {
  if (rsi >= 70) return 'text-red-400';
  if (rsi <= 30) return 'text-green-400';
  return 'text-yellow-400';
}

export function macdTrendColor(trend: string): string {
  if (trend === 'bullish') return 'text-green-400';
  if (trend === 'bearish') return 'text-red-400';
  return 'text-yellow-400';
}

export function bollingerPositionLabel(position: string): string {
  const map: Record<string, string> = {
    above_upper: 'Above Upper Band — overbought',
    near_upper:  'Near Upper Band',
    inside:      'Within Bands',
    near_lower:  'Near Lower Band',
    below_lower: 'Below Lower Band — oversold',
  };
  return map[position] ?? position;
}

export function volumeSignalLabel(signal: string): string {
  const map: Record<string, string> = { high: 'High Volume', normal: 'Normal Volume', low: 'Low Volume' };
  return map[signal] ?? signal;
}
