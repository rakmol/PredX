export interface Trade {
  id: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  fee: number;
  timestamp: string;
}

export interface PortfolioAsset {
  coin_id: string;
  coin_symbol: string;
  coin_name: string;
  image: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  current_value: number;
  cost_basis: number;
  pnl: number;
  pnl_pct: number;
  allocation_pct: number;
}

export interface PortfolioSummaryData {
  total_value_usd: number;
  total_cost_basis: number;
  total_pnl: number;
  total_pnl_pct: number;
  best_performer: PortfolioAsset | null;
  worst_performer: PortfolioAsset | null;
  assets: PortfolioAsset[];
}

export interface BehaviorInsightData {
  pattern: string;
  description: string;
  severity: 'positive' | 'warning' | 'neutral';
  recommendation: string;
}

export interface ExchangeConnection {
  id: string;
  exchange: 'binance' | 'bybit' | 'kucoin';
  label: string;
  connected_at: string;
  is_active: boolean;
}
