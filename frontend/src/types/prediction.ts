export type Horizon = '24h' | '7d' | '30d' | '90d';
export type OverallSignal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
export type SentimentLabel = 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';

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
    position: string;
    bandwidth: number;
  };
  moving_averages: {
    ma7: number;
    ma25: number;
    ma99: number;
    ema12: number;
    ema26: number;
    trend: string;
  };
  volume_trend: 'increasing' | 'decreasing' | 'neutral';
  support_levels: number[];
  resistance_levels: number[];
}

export interface SentimentData {
  fear_greed_index: number;
  fear_greed_label: string;
  news_sentiment_score: number;
  social_sentiment_score: number;
  overall_sentiment: SentimentLabel;
  sentiment_summary: string;
}

export interface PredictionScenario {
  price_target: number | null;
  percentage_change: number | null;
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
  prediction_horizon: Horizon;
  generated_at: string;
  expires_at: string;
  overall_signal: OverallSignal;
  confidence_score: number;
  signal_explanation: string;
  signal_agreement?: {
    bullish_count: number;
    bearish_count: number;
    total: number;
    direction: 'bullish' | 'bearish' | 'neutral';
  };
  is_blurred: boolean;
  scenarios: {
    bullish: PredictionScenario;
    neutral: PredictionScenario;
    bearish: PredictionScenario;
  };
  price_range: PriceRange;
  technicals: TechnicalIndicators;
  sentiment: SentimentData;
  ai_analysis: string | null;
  key_risks: string[];
  key_opportunities: string[];
  futures_signal?: FuturesSignal;
}

export interface FuturesSignal {
  direction: 'long' | 'short' | 'neutral';
  leverage: number;
  confidence: number;
  entry_zone: { low: number; high: number };
  stop_loss: number;
  take_profit: number;
  risk_reward: number;
  position_size_pct: number;
  max_drawdown_estimate: number;
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
  recommended_allocation: number;
  allocation_rationale: string;
  scenarios: {
    bullish: { price_target: number; portfolio_value: number; profit_loss: number; profit_loss_pct: number };
    neutral: { price_target: number; portfolio_value: number; profit_loss: number; profit_loss_pct: number };
    bearish: { price_target: number; portfolio_value: number; profit_loss: number; profit_loss_pct: number };
  };
  risk_level: 'low' | 'medium' | 'high' | 'very_high';
  time_horizon: string;
  ai_reasoning: string;
  stop_loss: number;
  take_profit: number;
}
