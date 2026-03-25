// Core type definitions for PredX backend

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  image: string;
  last_updated: string;
  sparkline_in_7d?: { price: number[] };
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  rsi_signal: 'oversold' | 'neutral' | 'overbought';
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    position: 'above_upper' | 'upper_zone' | 'middle_zone' | 'lower_zone' | 'below_lower';
    bandwidth: number;
  };
  moving_averages: {
    ma7: number;
    ma25: number;
    ma99: number;
    ema12: number;
    ema26: number;
    trend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  };
  volume_trend: 'increasing' | 'decreasing' | 'neutral';
  support_levels: number[];
  resistance_levels: number[];
}

export interface SentimentData {
  fear_greed_index: number;
  fear_greed_label: string;
  news_sentiment_score: number; // -1 to 1
  social_sentiment_score: number; // -1 to 1
  overall_sentiment: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
  sentiment_summary: string;
}

export interface PredictionScenario {
  price_target: number;
  percentage_change: number;
  confidence: number;
  key_factors: string[];
}

export interface PriceRange {
  low: number;
  expected: number;
  high: number;
  low_pct: number;
  expected_pct: number;
  high_pct: number;
}

export interface PredictionResult {
  coin_id: string;
  coin_symbol: string;
  coin_name: string;
  current_price: number;
  prediction_horizon: '24h' | '7d' | '30d' | '90d';
  generated_at: string;
  expires_at: string;
  overall_signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence_score: number;
  signal_explanation: string;
  signal_agreement?: {
    bullish_count: number;
    bearish_count: number;
    total: number;
    direction: 'bullish' | 'bearish' | 'neutral';
  };
  scenarios: {
    bullish: PredictionScenario;
    neutral: PredictionScenario;
    bearish: PredictionScenario;
  };
  price_range: PriceRange;
  technicals: TechnicalIndicators;
  sentiment: SentimentData;
  ai_analysis: string;
  key_risks: string[];
  key_opportunities: string[];
  futures_signal?: FuturesSignal;
}

export interface FuturesSignal {
  direction: 'long' | 'short' | 'neutral';
  leverage: number;           // 1–10x
  confidence: number;         // 0–100
  entry_zone: { low: number; high: number };
  stop_loss: number;
  take_profit: number;
  risk_reward: number;        // e.g. 2.4 means 2.4:1 reward:risk
  position_size_pct: number;  // recommended % of capital (5–50)
  max_drawdown_estimate: number; // % loss if stop hit (with leverage)
  signal_strength: 'weak' | 'moderate' | 'strong';
  rationale: string;
}

export interface InvestmentAdvice {
  input_amount: number;
  currency: 'GHS' | 'USD';
  coin_id: string;
  coin_symbol: string;
  current_price: number;
  price_in_currency: number;
  recommended_allocation: number; // percentage 0-100
  allocation_rationale: string;
  scenarios: {
    bullish: {
      price_target: number;
      portfolio_value: number;
      profit_loss: number;
      profit_loss_pct: number;
    };
    neutral: {
      price_target: number;
      portfolio_value: number;
      profit_loss: number;
      profit_loss_pct: number;
    };
    bearish: {
      price_target: number;
      portfolio_value: number;
      profit_loss: number;
      profit_loss_pct: number;
    };
  };
  risk_level: 'low' | 'medium' | 'high' | 'very_high';
  time_horizon: string;
  ai_reasoning: string;
  stop_loss: number;
  take_profit: number;
}

export interface AlertConfig {
  id: string;
  user_id: string;
  coin_id: string;
  coin_symbol: string;
  condition: 'above' | 'below' | 'change_pct';
  threshold: number;
  is_active: boolean;
  created_at: string;
  triggered_at?: string;
}

export interface UserSubscription {
  tier: 'free' | 'pro';
  is_active: boolean;
  expires_at?: string;
}
