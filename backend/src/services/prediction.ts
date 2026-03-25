// AI Prediction Engine
// Uses technical indicators + sentiment + Claude to generate price predictions

import Anthropic from '@anthropic-ai/sdk';
import { TechnicalIndicators, SentimentData, PredictionResult, PriceRange, CoinData, FuturesSignal } from '../types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const predictionCache = new Map<string, { data: PredictionResult; expires: number }>();

const HORIZON_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 168,
  '30d': 720,
  '90d': 2160,
};

const HORIZON_CACHE_MS: Record<'24h' | '7d' | '30d' | '90d', number> = {
  '24h': 15 * 60_000,
  '7d': 60 * 60_000,
  '30d': 3 * 60 * 60_000,
  '90d': 6 * 60 * 60_000,
};

type ParsedPredictionPayload = Pick<
  PredictionResult,
  'overall_signal' | 'confidence_score' | 'signal_explanation' | 'scenarios' | 'ai_analysis' | 'key_risks' | 'key_opportunities'
>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPrice(value: number) {
  if (value >= 1000) return Number(value.toFixed(0));
  if (value >= 100) return Number(value.toFixed(2));
  if (value >= 1) return Number(value.toFixed(3));
  return Number(value.toFixed(6));
}

function parseJsonObject(text: string) {
  const normalized = text.replace(/```json|```/gi, '').trim();
  const jsonMatch = normalized.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI prediction response');
  }
  return JSON.parse(jsonMatch[0]);
}

function scoreTrend(trend: TechnicalIndicators['moving_averages']['trend']) {
  switch (trend) {
    case 'strong_bullish':
      return 2;
    case 'bullish':
      return 1;
    case 'bearish':
      return -1;
    case 'strong_bearish':
      return -2;
    default:
      return 0;
  }
}

function buildFallbackPrediction(
  coin: CoinData,
  technicals: TechnicalIndicators,
  sentiment: SentimentData,
  horizon: '24h' | '7d' | '30d' | '90d'
): ParsedPredictionPayload {
  const currentPrice = coin.current_price;
  const rsiScore =
    technicals.rsi <= 30 ? 1.2 :
    technicals.rsi >= 70 ? -1.2 :
    technicals.rsi < 45 ? 0.3 :
    technicals.rsi > 55 ? -0.3 : 0;
  const macdScore =
    technicals.macd.trend === 'bullish' ? 1.2 :
    technicals.macd.trend === 'bearish' ? -1.2 : 0;
  const maScore = scoreTrend(technicals.moving_averages.trend) * 0.9;
  const bollingerScore =
    technicals.bollinger.position === 'below_lower' || technicals.bollinger.position === 'lower_zone' ? 0.8 :
    technicals.bollinger.position === 'above_upper' || technicals.bollinger.position === 'upper_zone' ? -0.8 : 0;
  const volumeScore =
    technicals.volume_trend === 'increasing' ? 0.45 :
    technicals.volume_trend === 'decreasing' ? -0.45 : 0;
  const fearGreedScore = (sentiment.fear_greed_index - 50) / 25;
  const sentimentScore = (sentiment.news_sentiment_score + sentiment.social_sentiment_score) * 0.9;

  const rawScore = rsiScore + macdScore + maScore + bollingerScore + volumeScore + fearGreedScore + sentimentScore;
  const normalizedScore = clamp(rawScore / 6, -1, 1);

  const signal: PredictionResult['overall_signal'] =
    normalizedScore >= 0.65 ? 'strong_buy' :
    normalizedScore >= 0.2 ? 'buy' :
    normalizedScore <= -0.65 ? 'strong_sell' :
    normalizedScore <= -0.2 ? 'sell' : 'hold';

  const confidenceScore = Math.round(clamp(65 + Math.abs(normalizedScore) * 23 + Math.abs(technicals.macd.histogram) * 4, 65, 88));
  const horizonBaseMove: Record<'24h' | '7d' | '30d' | '90d', number> = {
    '24h': 0.03,
    '7d': 0.08,
    '30d': 0.18,
    '90d': 0.32,
  };
  const volatilityBoost = clamp(technicals.bollinger.bandwidth / 100, 0.02, 0.22);
  const trendMove = normalizedScore * (horizonBaseMove[horizon] + volatilityBoost * 0.35);

  const bullishPct = clamp((Math.abs(trendMove) + horizonBaseMove[horizon] * 0.9) * (normalizedScore >= 0 ? 1.4 : 0.85), 0.01, 0.65);
  const bearishPct = clamp((Math.abs(trendMove) + horizonBaseMove[horizon] * 0.75) * (normalizedScore <= 0 ? 1.4 : 0.85), 0.01, 0.55);
  const neutralPct = clamp(trendMove, -0.28, 0.32);

  const support = technicals.support_levels[0];
  const resistance = technicals.resistance_levels[0];
  const bullishTarget = resistance ? Math.max(currentPrice * (1 + bullishPct), resistance) : currentPrice * (1 + bullishPct);
  const bearishTarget = support ? Math.min(currentPrice * (1 - bearishPct), support) : currentPrice * (1 - bearishPct);
  const neutralTarget = currentPrice * (1 + neutralPct);

  const opportunities = [
    technicals.macd.trend === 'bullish' ? 'MACD momentum is leaning bullish and supports follow-through if volume confirms.' : null,
    technicals.moving_averages.trend.includes('bull') ? 'Short and medium-term moving averages remain aligned to the upside.' : null,
    sentiment.fear_greed_index >= 55 ? `Broader market sentiment is supportive with Fear & Greed at ${sentiment.fear_greed_index}.` : null,
    sentiment.news_sentiment_score > 0.2 ? 'News and social sentiment are adding modest upside support.' : null,
    technicals.volume_trend === 'increasing' ? 'Rising volume suggests traders are actively supporting the current move.' : null,
  ].filter(Boolean) as string[];

  const risks = [
    technicals.macd.trend === 'bearish' ? 'MACD remains soft, so rallies could stall without stronger confirmation.' : null,
    technicals.moving_averages.trend.includes('bear') ? 'Moving-average structure still leaves room for trend weakness.' : null,
    sentiment.fear_greed_index <= 45 ? `Market sentiment remains cautious with Fear & Greed at ${sentiment.fear_greed_index}.` : null,
    technicals.rsi >= 68 ? 'RSI is near overbought levels, increasing short-term pullback risk.' : null,
    technicals.volume_trend === 'decreasing' ? 'Cooling volume could weaken breakout attempts.' : null,
  ].filter(Boolean) as string[];

  const fallbackOpportunities = opportunities.length
    ? opportunities
    : ['Price is holding within a tradable range, leaving room for a measured upside move if sentiment improves.'];
  const fallbackRisks = risks.length
    ? risks
    : ['Crypto volatility remains elevated, so downside swings can accelerate quickly if the market weakens.'];

  const factorFrom = (items: string[], fallback: string) => items.slice(0, 3).map((item) => item.replace(/\.$/, ''));

  const signalExplanations: Record<typeof signal, string> = {
    strong_buy: `${coin.name} shows ${technicals.moving_averages.trend.replace(/_/g, ' ')} moving averages, ${technicals.macd.trend} MACD, and a Fear & Greed of ${sentiment.fear_greed_index} — multiple indicators align strongly to the upside.`,
    buy: `Technical indicators lean positive for ${coin.name} with supporting momentum and sentiment, though not all signals are in full agreement yet.`,
    hold: `${coin.name}'s signals are mixed — some indicators lean bullish while others are bearish, suggesting a wait-and-watch stance is prudent.`,
    sell: `Momentum and trend indicators for ${coin.name} point to near-term weakness, with bearish signals currently outweighing bullish ones.`,
    strong_sell: `${coin.name} shows broad-based bearish signals across momentum, trend, and sentiment — conditions broadly favour the downside.`,
  };

  return {
    overall_signal: signal,
    confidence_score: confidenceScore,
    signal_explanation: signalExplanations[signal],
    scenarios: {
      bullish: {
        price_target: roundPrice(bullishTarget),
        percentage_change: Number((((bullishTarget - currentPrice) / currentPrice) * 100).toFixed(2)),
        confidence: clamp(Math.round(confidenceScore + 6), 1, 95),
        key_factors: factorFrom(fallbackOpportunities, 'Upside catalysts remain intact'),
      },
      neutral: {
        price_target: roundPrice(neutralTarget),
        percentage_change: Number((((neutralTarget - currentPrice) / currentPrice) * 100).toFixed(2)),
        confidence: clamp(Math.round(confidenceScore - 2), 1, 90),
        key_factors: [
          'Price is likely to stay anchored between nearby support and resistance',
          'Mixed technical signals suggest consolidation rather than a sharp breakout',
          'Sentiment is supportive enough to limit panic selling but not strong enough for a major surge',
        ],
      },
      bearish: {
        price_target: roundPrice(bearishTarget),
        percentage_change: Number((((bearishTarget - currentPrice) / currentPrice) * 100).toFixed(2)),
        confidence: clamp(Math.round(confidenceScore + 2), 1, 92),
        key_factors: factorFrom(fallbackRisks, 'Downside pressure could return quickly'),
      },
    },
    ai_analysis: `${coin.name} is currently showing a ${signal.replace('_', ' ')} setup based on trend, momentum, and sentiment inputs. The fallback model sees ${technicals.moving_averages.trend.replace('_', ' ')} moving-average structure, ${technicals.macd.trend} MACD momentum, and a Fear & Greed reading of ${sentiment.fear_greed_index}. That combination suggests the most likely path is a measured move toward ${roundPrice(neutralTarget).toLocaleString()} over the ${horizon} horizon, while keeping room for volatility around key support and resistance levels. Confidence is moderate because crypto conditions can shift quickly, but the setup still provides actionable bullish, neutral, and bearish scenarios.`,
    key_risks: fallbackRisks.slice(0, 4),
    key_opportunities: fallbackOpportunities.slice(0, 4),
  };
}

function computeSignalAgreement(
  technicals: TechnicalIndicators,
  sentiment: SentimentData
): PredictionResult['signal_agreement'] {
  const signals = [
    technicals.rsi_signal === 'oversold' ? 'bullish' : technicals.rsi_signal === 'overbought' ? 'bearish' : 'neutral',
    technicals.macd.trend === 'bullish' ? 'bullish' : technicals.macd.trend === 'bearish' ? 'bearish' : 'neutral',
    technicals.moving_averages.trend.includes('bull') ? 'bullish' : technicals.moving_averages.trend.includes('bear') ? 'bearish' : 'neutral',
    technicals.volume_trend === 'increasing' ? 'bullish' : technicals.volume_trend === 'decreasing' ? 'bearish' : 'neutral',
    sentiment.overall_sentiment === 'bullish' || sentiment.overall_sentiment === 'very_bullish' ? 'bullish'
      : sentiment.overall_sentiment === 'bearish' || sentiment.overall_sentiment === 'very_bearish' ? 'bearish'
      : 'neutral',
  ] as const;

  const bullish_count = signals.filter(s => s === 'bullish').length;
  const bearish_count = signals.filter(s => s === 'bearish').length;
  const direction: 'bullish' | 'bearish' | 'neutral' =
    bullish_count > bearish_count ? 'bullish' : bearish_count > bullish_count ? 'bearish' : 'neutral';

  return { bullish_count, bearish_count, total: signals.length, direction };
}

// Hard deadline so the route always resolves before a gateway (502) times out.
// If both models exceed this, the caller falls back to buildFallbackPrediction.
const AI_DEADLINE_MS = 24_000;

async function callPredictionModel(prompt: string) {
  const models = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
  let lastError: unknown;

  // Each model gets half the budget; if it times out we try the next.
  const perModelMs = AI_DEADLINE_MS / models.length;

  for (const model of models) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), perModelMs);

      try {
        const response = await anthropic.messages.create(
          { model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] },
          { signal: ac.signal },
        );
        clearTimeout(timer);
        const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
        return parseJsonObject(text);
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Prediction model request failed');
}

export function generateFuturesSignal(
  coin: CoinData,
  technicals: TechnicalIndicators,
  sentiment: SentimentData,
  prediction: Pick<PredictionResult, 'overall_signal' | 'confidence_score' | 'scenarios'>
): FuturesSignal {
  const price = coin.current_price;
  const { rsi, bollinger, macd, moving_averages, volume_trend, support_levels, resistance_levels } = technicals;
  const signal = prediction.overall_signal;

  // Direction and base leverage from signal
  let direction: FuturesSignal['direction'];
  let baseLeverage: number;
  if (signal === 'strong_buy' || signal === 'buy') {
    direction = 'long';
    baseLeverage = signal === 'strong_buy' ? 4 : 2;
  } else if (signal === 'strong_sell' || signal === 'sell') {
    direction = 'short';
    baseLeverage = signal === 'strong_sell' ? 4 : 2;
  } else {
    direction = 'neutral';
    baseLeverage = 1;
  }

  // Volatility: Bollinger bandwidth reduces leverage
  const bwNorm = clamp(bollinger.bandwidth / 100, 0, 1);
  if (bwNorm > 0.6) baseLeverage -= 2;
  else if (bwNorm > 0.4) baseLeverage -= 1;

  // Extreme sentiment reduces leverage
  if (sentiment.fear_greed_index < 20 || sentiment.fear_greed_index > 80) baseLeverage -= 1;

  // Rising volume boosts leverage by 1
  if (volume_trend === 'increasing' && direction !== 'neutral') baseLeverage += 1;

  // RSI extremes in wrong direction reduce leverage
  if (direction === 'long' && rsi > 75) baseLeverage -= 1;
  if (direction === 'short' && rsi < 25) baseLeverage -= 1;

  const leverage = clamp(Math.round(baseLeverage), 1, 10);

  // Entry zone: tight ±0.2% around current price
  const entry_zone = {
    low: roundPrice(price * 0.998),
    high: roundPrice(price * 1.002),
  };

  // Stop loss
  let stop_loss: number;
  if (direction === 'long') {
    const support = support_levels[0];
    const techStop = support ? Math.min(support * 0.99, price * 0.93) : price * 0.94;
    stop_loss = roundPrice(Math.max(price * 0.90, techStop));
  } else if (direction === 'short') {
    const resistance = resistance_levels[0];
    const techStop = resistance ? Math.max(resistance * 1.01, price * 1.07) : price * 1.06;
    stop_loss = roundPrice(Math.min(price * 1.10, techStop));
  } else {
    stop_loss = roundPrice(price * 0.95);
  }

  // Take profit from scenarios
  const take_profit = roundPrice(
    direction === 'long' ? prediction.scenarios.bullish.price_target ?? price * 1.08
    : direction === 'short' ? prediction.scenarios.bearish.price_target ?? price * 0.92
    : prediction.scenarios.neutral.price_target ?? price
  );

  // Risk / reward ratio
  const reward = Math.abs(take_profit - price);
  const risk = Math.abs(price - stop_loss);
  const risk_reward = risk > 0 ? Number((reward / risk).toFixed(2)) : 1;

  // Position size: risk 2% of capital, size = 2% / stop_distance%
  const stopDistancePct = Math.abs((stop_loss - price) / price) * 100;
  const position_size_pct = clamp(Math.round((2 / stopDistancePct) * 100 / Math.max(leverage, 1)), 5, 50);

  // Max drawdown if stop hit with leverage
  const max_drawdown_estimate = Number((stopDistancePct * leverage).toFixed(1));

  // Signal strength: count indicators agreeing with direction
  const indicators = [
    macd.trend === 'bullish' ? 'long' : macd.trend === 'bearish' ? 'short' : 'neutral',
    moving_averages.trend.includes('bull') ? 'long' : moving_averages.trend.includes('bear') ? 'short' : 'neutral',
    volume_trend === 'increasing' ? direction : 'neutral',
    rsi < 35 ? 'long' : rsi > 65 ? 'short' : 'neutral',
  ];
  const aligned = indicators.filter((d) => d === direction).length;
  const signal_strength: FuturesSignal['signal_strength'] =
    aligned >= 3 ? 'strong' : aligned >= 2 ? 'moderate' : 'weak';

  const confidence = clamp(
    direction === 'neutral' ? 40 : Math.round(prediction.confidence_score * 0.9),
    40, 92
  );

  const dirLabel = direction === 'long' ? 'Long' : direction === 'short' ? 'Short' : 'Neutral';
  const rationale = direction === 'neutral'
    ? `Mixed signals — RSI ${rsi.toFixed(0)} and ${macd.trend} MACD give no clear directional edge. Spot positions only.`
    : `${dirLabel} ${leverage}x: RSI ${rsi.toFixed(0)} (${technicals.rsi_signal}), ${macd.trend} MACD, ${moving_averages.trend.replace(/_/g, ' ')} trend. ${signal_strength === 'strong' ? 'High indicator agreement — reasonable conviction.' : signal_strength === 'moderate' ? 'Moderate conviction — use tight stops.' : 'Low conviction — reduce size or wait for confirmation.'}`;

  return {
    direction,
    leverage,
    confidence,
    entry_zone,
    stop_loss,
    take_profit,
    risk_reward,
    position_size_pct,
    max_drawdown_estimate,
    signal_strength,
    rationale,
  };
}

export async function generatePrediction(
  coin: CoinData,
  technicals: TechnicalIndicators,
  sentiment: SentimentData,
  horizon: '24h' | '7d' | '30d' | '90d'
): Promise<PredictionResult> {
  const cacheKey = [
    coin.id,
    horizon,
    roundPrice(coin.current_price),
    technicals.rsi.toFixed(1),
    technicals.macd.histogram.toFixed(4),
    technicals.moving_averages.trend,
    sentiment.overall_sentiment,
    sentiment.fear_greed_index,
  ].join(':');
  const cached = predictionCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const hoursAhead = HORIZON_HOURS[horizon];
  const expiresAt = new Date(Date.now() + hoursAhead * 3_600_000).toISOString();

  const prompt = `You are PredX's senior AI analyst, the most accurate crypto price prediction system in existence. Analyze ${coin.name} (${coin.symbol.toUpperCase()}) and generate a ${horizon} price prediction.

## Current Market Data
- Current Price: $${coin.current_price.toLocaleString()}
- 24h Change: ${coin.price_change_percentage_24h?.toFixed(2)}%
- 24h High: $${coin.high_24h?.toLocaleString()}
- 24h Low: $${coin.low_24h?.toLocaleString()}
- Market Cap Rank: #${coin.market_cap_rank}
- Volume (24h): $${coin.total_volume?.toLocaleString()}

## Technical Indicators
- RSI(14): ${technicals.rsi.toFixed(1)} → ${technicals.rsi_signal}
- MACD: ${technicals.macd.macd.toFixed(4)} | Signal: ${technicals.macd.signal.toFixed(4)} | Histogram: ${technicals.macd.histogram.toFixed(4)} → ${technicals.macd.trend}
- Bollinger Bands: Upper $${technicals.bollinger.upper.toFixed(2)} | Middle $${technicals.bollinger.middle.toFixed(2)} | Lower $${technicals.bollinger.lower.toFixed(2)} | Position: ${technicals.bollinger.position}
- MA7: $${technicals.moving_averages.ma7.toFixed(2)} | MA25: $${technicals.moving_averages.ma25.toFixed(2)} | MA99: $${technicals.moving_averages.ma99.toFixed(2)} | Trend: ${technicals.moving_averages.trend}
- Volume Trend: ${technicals.volume_trend}
- Support Levels: ${technicals.support_levels.map(s => '$' + s.toFixed(2)).join(', ') || 'None identified'}
- Resistance Levels: ${technicals.resistance_levels.map(r => '$' + r.toFixed(2)).join(', ') || 'None identified'}

## Sentiment Data
- Fear & Greed Index: ${sentiment.fear_greed_index}/100 (${sentiment.fear_greed_label})
- News Sentiment: ${(sentiment.news_sentiment_score * 100).toFixed(0)}/100
- Social Sentiment: ${(sentiment.social_sentiment_score * 100).toFixed(0)}/100
- Overall Sentiment: ${sentiment.overall_sentiment}
- Summary: ${sentiment.sentiment_summary}

## Task
Generate a ${horizon} price prediction. Consider ALL signals holistically. A professional analyst would weigh: trend alignment, RSI levels, MACD crossovers, Bollinger squeeze/expansion, volume confirmation, sentiment momentum.

## EXPLANATION FORMAT RULES — CRITICAL

You MUST always show the technical term first, then immediately explain it in plain English on the same point. Format every signal like this:

CORRECT FORMAT:
'RSI is at 72 (overbought) — in simple terms, this coin has been rising very fast recently and may need to take a breather before going higher.'
'MACD is showing a bullish crossover — this means buying pressure is picking up and more people are choosing to buy this coin than sell it right now.'
'Bollinger Bands are tightening — this means the price has been unusually calm lately, which often means a big price move is coming soon in either direction.'

WRONG FORMAT (never do this):
'RSI is overbought at 72.' (no explanation)
'MACD crossover detected.' (no explanation)

Rules:
- Every technical term must be followed by a plain English dash explanation
- Plain explanation must be one sentence maximum
- Write the plain explanation as if talking to a smart person who has never traded before
- The ai_analysis field must follow this structure:
  * Sentence 1: What the technicals are saying (with plain explanation)
  * Sentence 2: What the market sentiment is saying (with plain explanation)
  * Sentence 3: One clear conclusion the user can act on
- key_risks: each item = technical observation + " — " + plain explanation of why it matters
- key_opportunities: same format — technical observation + " — " + plain explanation

## CONFIDENCE SCORING RULES
- Confidence score minimum is 65% — never return below 65% unless signals are completely contradictory
- If 3 or more signals agree (RSI + MACD + sentiment all bullish) → confidence must be 78-92%
- If 2 signals agree → confidence 68-77%
- If signals are mixed → confidence 65-70% with clear explanation of the conflict
- For scenario probabilities, they must always add up to exactly 100%
- Bullish scenario minimum probability: 30%
- Bearish scenario maximum probability: 40% unless there are 3+ strong bearish signals
- Never return a prediction that makes the user feel hopeless — always find the realistic upside even in bearish conditions

Respond with ONLY this JSON structure (no other text):
{
  "overall_signal": <"strong_buy" | "buy" | "hold" | "sell" | "strong_sell">,
  "confidence_score": <integer 1-100>,
  "signal_explanation": "<1-2 plain-English sentences explaining exactly WHY this signal was generated — cite the 2-3 most decisive indicators>",
  "scenarios": {
    "bullish": {
      "price_target": <number>,
      "percentage_change": <number>,
      "confidence": <integer 1-100>,
      "key_factors": [<2-3 specific factors driving this scenario>]
    },
    "neutral": {
      "price_target": <number>,
      "percentage_change": <number>,
      "confidence": <integer 1-100>,
      "key_factors": [<2-3 factors>]
    },
    "bearish": {
      "price_target": <number>,
      "percentage_change": <number>,
      "confidence": <integer 1-100>,
      "key_factors": [<2-3 factors>]
    }
  },
  "ai_analysis": "<4-6 sentence professional analysis explaining the prediction reasoning>",
  "key_risks": [<3-4 specific risks for ${coin.name} in the next ${horizon}>],
  "key_opportunities": [<3-4 specific opportunities>]
}`;

  let parsed: ParsedPredictionPayload;

  try {
    parsed = await callPredictionModel(prompt);
  } catch {
    parsed = buildFallbackPrediction(coin, technicals, sentiment, horizon);
  }

  const price_range: PriceRange = {
    low: parsed.scenarios.bearish.price_target ?? coin.current_price,
    expected: parsed.scenarios.neutral.price_target ?? coin.current_price,
    high: parsed.scenarios.bullish.price_target ?? coin.current_price,
    low_pct: parsed.scenarios.bearish.percentage_change ?? 0,
    expected_pct: parsed.scenarios.neutral.percentage_change ?? 0,
    high_pct: parsed.scenarios.bullish.percentage_change ?? 0,
  };

  const result: PredictionResult = {
    coin_id: coin.id,
    coin_symbol: coin.symbol.toUpperCase(),
    coin_name: coin.name,
    current_price: coin.current_price,
    prediction_horizon: horizon,
    generated_at: new Date().toISOString(),
    expires_at: expiresAt,
    overall_signal: parsed.overall_signal,
    confidence_score: parsed.confidence_score,
    signal_explanation: parsed.signal_explanation,
    signal_agreement: computeSignalAgreement(technicals, sentiment),
    scenarios: parsed.scenarios,
    price_range,
    technicals,
    sentiment,
    ai_analysis: parsed.ai_analysis,
    key_risks: parsed.key_risks,
    key_opportunities: parsed.key_opportunities,
    futures_signal: generateFuturesSignal(coin, technicals, sentiment, parsed),
  };

  predictionCache.set(cacheKey, {
    data: result,
    expires: Date.now() + HORIZON_CACHE_MS[horizon],
  });

  return result;
}

export async function generateInvestmentAdvice(
  coin: CoinData,
  prediction: PredictionResult,
  amount: number,
  currency: 'GHS' | 'USD',
  ghsRate: number
) {
  const usdAmount = currency === 'GHS' ? amount / ghsRate : amount;
  const ghsAmount = currency === 'USD' ? amount * ghsRate : amount;

  const prompt = `You are PredX's AI investment advisor. A user wants to invest ${currency === 'GHS' ? `GHS ${amount.toLocaleString()}` : `$${amount.toLocaleString()}`} (≈ ${currency === 'GHS' ? `$${usdAmount.toFixed(2)}` : `GHS ${ghsAmount.toFixed(2)}`}) in ${coin.name} (${coin.symbol.toUpperCase()}).

## Coin Analysis Context
- Current Price: $${coin.current_price.toLocaleString()}
- 24h Change: ${coin.price_change_percentage_24h?.toFixed(2)}%
- Market Cap Rank: #${coin.market_cap_rank}
- Overall Signal: ${prediction.overall_signal}
- Confidence: ${prediction.confidence_score}%
- Bullish Target: $${prediction.scenarios.bullish.price_target.toLocaleString()} (+${prediction.scenarios.bullish.percentage_change.toFixed(1)}%)
- Neutral Target: $${prediction.scenarios.neutral.price_target.toLocaleString()} (${prediction.scenarios.neutral.percentage_change.toFixed(1)}%)
- Bearish Target: $${prediction.scenarios.bearish.price_target.toLocaleString()} (${prediction.scenarios.bearish.percentage_change.toFixed(1)}%)
- RSI: ${prediction.technicals.rsi.toFixed(1)} (${prediction.technicals.rsi_signal})
- Trend: ${prediction.technicals.moving_averages.trend}
- Sentiment: ${prediction.sentiment.overall_sentiment}
- Key Risks: ${prediction.key_risks.join('; ')}

## Investment Profile
- Amount: $${usdAmount.toFixed(2)} USD (${currency === 'GHS' ? `GHS ${amount.toLocaleString()}` : `$${amount.toLocaleString()}`})
- This represents a retail investor in Ghana/West Africa

## Task
Provide investment advice. Consider: position sizing relative to risk, current market conditions, the specific signals for ${coin.name}, and appropriate risk management.

Respond with ONLY this JSON (no other text):
{
  "recommended_allocation": <integer 0-100, percentage of the input amount to actually invest>,
  "allocation_rationale": "<1-2 sentences explaining why this allocation percentage>",
  "risk_level": <"low" | "medium" | "high" | "very_high">,
  "time_horizon": "<recommended holding period, e.g. '3-7 days' or '2-4 weeks'>",
  "stop_loss_pct": <number, suggested stop loss percentage below entry, e.g. 5.0 for 5%>,
  "take_profit_pct": <number, suggested take profit percentage above entry, e.g. 15.0 for 15%>,
  "ai_reasoning": "<3-4 sentences of professional investment reasoning including specific price levels and risk management>"
}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    response = await anthropic.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 800, messages: [{ role: 'user', content: prompt }] },
      { signal: ac.signal },
    );
  } finally {
    clearTimeout(timer);
  }

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse investment advice response');

  const parsed = JSON.parse(jsonMatch[0]);
  const investedUsd = usdAmount * (parsed.recommended_allocation / 100);
  const coinsAcquired = investedUsd / coin.current_price;

  const buildScenario = (priceTarget: number) => {
    const portfolioUsd = coinsAcquired * priceTarget;
    const profitLossUsd = portfolioUsd - investedUsd;
    return {
      price_target: priceTarget,
      portfolio_value: currency === 'GHS' ? portfolioUsd * ghsRate : portfolioUsd,
      profit_loss: currency === 'GHS' ? profitLossUsd * ghsRate : profitLossUsd,
      profit_loss_pct: (profitLossUsd / investedUsd) * 100,
    };
  };

  return {
    input_amount: amount,
    currency,
    coin_id: coin.id,
    coin_symbol: coin.symbol.toUpperCase(),
    current_price: coin.current_price,
    price_in_currency: currency === 'GHS' ? coin.current_price * ghsRate : coin.current_price,
    recommended_allocation: parsed.recommended_allocation,
    allocation_rationale: parsed.allocation_rationale,
    scenarios: {
      bullish: buildScenario(prediction.scenarios.bullish.price_target),
      neutral: buildScenario(prediction.scenarios.neutral.price_target),
      bearish: buildScenario(prediction.scenarios.bearish.price_target),
    },
    risk_level: parsed.risk_level,
    time_horizon: parsed.time_horizon,
    ai_reasoning: parsed.ai_reasoning,
    stop_loss: coin.current_price * (1 - parsed.stop_loss_pct / 100),
    take_profit: coin.current_price * (1 + parsed.take_profit_pct / 100),
  };
}
