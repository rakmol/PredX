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

export interface CoinHistoryPoint {
  timestamp: number;
  price: number;
  volume: number;
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
}
