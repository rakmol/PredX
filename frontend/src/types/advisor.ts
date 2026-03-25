export interface CoinAllocation {
  coin: string;
  symbol: string;
  image: string;
  percentage: number;
  amount_usd: number;
  amount_ghs: number;
  units_purchasable: number;
  is_fractional: boolean;
  affordability_note: string;
  current_price: number;
  target_price: number;
  potential_value_usd: number;
  potential_value_ghs: number;
  reason: string;
}

export interface TopCoinAdvisorData {
  id?: string;
  coin?: string;
  name?: string;
  symbol: string;
  image?: string;
  current_price: number;
  priceUSD?: number;
  priceGHS?: number;
  minInvestmentGHS?: number;
  marketCap?: number;
  volume24h?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap_rank?: number;
  target_price?: number;
  predicted_price?: number;
  bullish_target_price?: number;
  neutral_target_price?: number;
  bearish_target_price?: number;
  confidence_score?: number;
  prediction_horizon?: string;
  reason?: string;
}

export interface PortfolioScenario {
  total_value_usd: number;
  total_value_ghs: number;
  gain_percent: number;
}

export interface PortfolioAdvice {
  recommended_allocation: CoinAllocation[];
  total_invested_usd: number;
  total_invested_ghs: number;
  total_potential_value_usd: number;
  total_potential_value_ghs: number;
  potential_gain_percent: number;
  scenario_bullish: PortfolioScenario;
  scenario_neutral: PortfolioScenario;
  scenario_bearish: PortfolioScenario;
  strategy_summary: string;
  risk_level: string;
  timeframe: string;
  warning: string;
  affordability_warning?: string;
  generated_at: string;
  ghs_rate: number;
}
