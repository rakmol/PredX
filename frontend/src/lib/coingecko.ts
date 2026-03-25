// Direct CoinGecko API client (frontend → CoinGecko)
// Used for all market data until the backend proxy is live.
// Rate limit: 30 req/min on free tier — hooks enforce stale times accordingly.

const CG_BASE = import.meta.env.VITE_COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
const XR_BASE = 'https://api.exchangerate-api.com/v4/latest/USD';

// ─── In-memory GHS rate cache (avoids hammering exchangerate-api) ─────────────
let _ghsRate: number | null = null;
let _ghsRateFetchedAt = 0;
const GHS_CACHE_MS = 60 * 60_000; // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  market_cap_rank: number | null;
}

export interface CoinPrice {
  usd: number;
  ghs: number;
  usd_24h_change: number;
  last_updated: string;
}

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price_usd: number;
  current_price_ghs: number;
  market_cap_usd: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume_usd: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  price_change_percentage_30d: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath_usd: number;
  ath_change_percentage: number;
  ath_date: string;
  atl_usd: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_7d: number[];
}

export interface OHLCVPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  market_cap_rank: number;
  price_btc: number;
  score: number;
}

export interface AdvisorCoinPrice {
  id: string;
  symbol: string;
  name: string;
  image: string;
  priceUSD: number;
  priceGHS: number;
  minInvestmentGHS: number;
  marketCap: number;
  volume24h: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cgFetch<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(`${CG_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limit hit. Please wait a moment and try again.');
    throw new Error(`CoinGecko error ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ─── 1. GHS Exchange Rate ─────────────────────────────────────────────────────

/** Fetch current USD → GHS rate. Cached in-memory for 1 hour. */
export async function getGHSRate(): Promise<number> {
  const now = Date.now();
  if (_ghsRate && now - _ghsRateFetchedAt < GHS_CACHE_MS) return _ghsRate;

  try {
    const res = await fetch(XR_BASE);
    const data = await res.json() as { rates: Record<string, number> };
    _ghsRate = data.rates['GHS'] ?? 15.5;
    _ghsRateFetchedAt = now;
    return _ghsRate;
  } catch {
    // Fallback rate if exchange rate API is down
    return _ghsRate ?? 15.5;
  }
}

// ─── 2. Search Coins ──────────────────────────────────────────────────────────

/** Returns true if the query looks like an EVM contract address (0x + 40 hex chars). */
function isContractAddress(query: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(query.trim());
}

/**
 * Look up a coin by EVM contract address.
 * Tries the most common chains in popularity order; returns the first match.
 */
export async function searchByContract(address: string): Promise<CoinSearchResult[]> {
  const PLATFORMS = [
    'ethereum',
    'binance-smart-chain',
    'polygon-pos',
    'arbitrum-one',
    'base',
    'optimistic-ethereum',
    'avalanche',
  ];

  for (const platform of PLATFORMS) {
    try {
      const data = await cgFetch<{
        id: string;
        symbol: string;
        name: string;
        image: { thumb: string; small: string };
        market_cap_rank: number | null;
      }>(`/coins/${platform}/contract/${address.toLowerCase()}`);

      return [{
        id: data.id,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        thumb: data.image?.thumb ?? data.image?.small ?? '',
        market_cap_rank: data.market_cap_rank,
      }];
    } catch {
      // Not on this platform — try next
    }
  }

  return []; // Not found on any supported chain
}

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Contract address path — skip the text search
  if (isContractAddress(trimmed)) {
    return searchByContract(trimmed);
  }

  const data = await cgFetch<{ coins: Array<{
    id: string; symbol: string; name: string;
    thumb: string; market_cap_rank: number | null;
  }> }>('/search', { query: trimmed });

  return data.coins.slice(0, 20).map((c) => ({
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    thumb: c.thumb,
    market_cap_rank: c.market_cap_rank,
  }));
}

// ─── 3. Coin Price (USD + GHS) ────────────────────────────────────────────────

export async function getCoinPrice(coinId: string): Promise<CoinPrice> {
  const [priceData, ghsRate] = await Promise.all([
    cgFetch<Record<string, { usd: number; usd_24h_change: number; last_updated_at: number }>>(
      '/simple/price',
      { ids: coinId, vs_currencies: 'usd', include_24hr_change: true, include_last_updated_at: true },
    ),
    getGHSRate(),
  ]);

  const coin = priceData[coinId];
  if (!coin) throw new Error(`Price not found for ${coinId}`);

  return {
    usd: coin.usd,
    ghs: coin.usd * ghsRate,
    usd_24h_change: coin.usd_24h_change,
    last_updated: new Date(coin.last_updated_at * 1000).toISOString(),
  };
}

// ─── 4. Full Coin Data ────────────────────────────────────────────────────────

export async function getCoinData(coinId: string): Promise<CoinDetail> {
  const [raw, ghsRate] = await Promise.all([
    cgFetch<{
      id: string; symbol: string; name: string;
      image: { large: string };
      market_data: {
        current_price: { usd: number };
        market_cap: { usd: number };
        market_cap_rank: number;
        fully_diluted_valuation: { usd: number } | null;
        total_volume: { usd: number };
        high_24h: { usd: number };
        low_24h: { usd: number };
        price_change_24h: number;
        price_change_percentage_24h: number;
        price_change_percentage_7d: number;
        price_change_percentage_30d: number;
        circulating_supply: number;
        total_supply: number | null;
        max_supply: number | null;
        ath: { usd: number };
        ath_change_percentage: { usd: number };
        ath_date: { usd: string };
        atl: { usd: number };
        atl_change_percentage: { usd: number };
        atl_date: { usd: string };
        last_updated: string;
      };
      market_cap_rank: number;
      sparkline_in_7d: { price: number[] };
    }>(`/coins/${coinId}`, {
      localization: false,
      tickers: false,
      community_data: false,
      developer_data: false,
      sparkline: true,
    }),
    getGHSRate(),
  ]);

  const m = raw.market_data;

  return {
    id: raw.id,
    symbol: raw.symbol.toUpperCase(),
    name: raw.name,
    image: raw.image.large,
    current_price_usd: m.current_price.usd,
    current_price_ghs: m.current_price.usd * ghsRate,
    market_cap_usd: m.market_cap.usd,
    market_cap_rank: m.market_cap_rank,
    fully_diluted_valuation: m.fully_diluted_valuation?.usd ?? null,
    total_volume_usd: m.total_volume.usd,
    high_24h: m.high_24h.usd,
    low_24h: m.low_24h.usd,
    price_change_24h: m.price_change_24h,
    price_change_percentage_24h: m.price_change_percentage_24h,
    price_change_percentage_7d: m.price_change_percentage_7d,
    price_change_percentage_30d: m.price_change_percentage_30d,
    circulating_supply: m.circulating_supply,
    total_supply: m.total_supply,
    max_supply: m.max_supply,
    ath_usd: m.ath.usd,
    ath_change_percentage: m.ath_change_percentage.usd,
    ath_date: m.ath_date.usd,
    atl_usd: m.atl.usd,
    atl_change_percentage: m.atl_change_percentage.usd,
    atl_date: m.atl_date.usd,
    last_updated: m.last_updated,
    sparkline_7d: raw.sparkline_in_7d?.price ?? [],
  };
}

// ─── 5. Price History (for line charts) ──────────────────────────────────────

export async function getPriceHistory(coinId: string, days: number): Promise<PricePoint[]> {
  // CoinGecko returns hourly data for ≤90 days, daily for >90 days
  const data = await cgFetch<{
    prices: [number, number][];
    total_volumes: [number, number][];
  }>(`/coins/${coinId}/market_chart`, {
    vs_currency: 'usd',
    days,
    precision: 'full',
  });

  return data.prices.map(([timestamp, price], i) => ({
    timestamp,
    price,
    volume: data.total_volumes[i]?.[1] ?? 0,
  }));
}

// ─── 6. OHLCV (for candlestick charts) ───────────────────────────────────────

export async function getCoinOHLCV(coinId: string, days: number): Promise<OHLCVPoint[]> {
  const [ohlcData, marketChart] = await Promise.all([
    cgFetch<[number, number, number, number, number][]>(
      `/coins/${coinId}/ohlc`,
      { vs_currency: 'usd', days },
    ),
    cgFetch<{
      total_volumes: [number, number][];
    }>(`/coins/${coinId}/market_chart`, {
      vs_currency: 'usd',
      days,
      precision: 'full',
    }),
  ]);

  const volumePoints = marketChart.total_volumes ?? [];

  const findNearestVolume = (timestamp: number) => {
    if (!volumePoints.length) return 0;

    let nearest = volumePoints[0]?.[1] ?? 0;
    let smallestDelta = Number.POSITIVE_INFINITY;

    for (const [volumeTimestamp, volume] of volumePoints) {
      const delta = Math.abs(volumeTimestamp - timestamp);
      if (delta < smallestDelta) {
        smallestDelta = delta;
        nearest = volume;
      }
    }

    return nearest;
  };

  return ohlcData.map(([timestamp, open, high, low, close]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume: findNearestVolume(timestamp),
  }));
}

export const getOHLCV = getCoinOHLCV;

// ─── 7. Top Coins by Market Cap ───────────────────────────────────────────────

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  current_price_ghs: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  high_24h: number;
  low_24h: number;
  circulating_supply: number;
  sparkline_in_7d: { price: number[] };
  last_updated: string;
}

export async function getTopCoins(limit = 50): Promise<MarketCoin[]> {
  const [coins, ghsRate] = await Promise.all([
    cgFetch<Array<{
      id: string; symbol: string; name: string; image: string;
      current_price: number; market_cap: number; market_cap_rank: number;
      total_volume: number; high_24h: number; low_24h: number;
      price_change_percentage_24h: number;
      price_change_percentage_7d_in_currency: number;
      circulating_supply: number;
      sparkline_in_7d: { price: number[] };
      last_updated: string;
    }>>('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: limit,
      page: 1,
      sparkline: true,
      price_change_percentage: '7d',
    }),
    getGHSRate(),
  ]);

  return coins.map((c) => ({
    ...c,
    symbol: c.symbol.toUpperCase(),
    current_price_ghs: c.current_price * ghsRate,
  }));
}

export async function getCoinPricesForAdvisor(): Promise<AdvisorCoinPrice[]> {
  const [coins, ghsRate] = await Promise.all([
    cgFetch<Array<{
      id: string;
      symbol: string;
      name: string;
      image: string;
      current_price: number;
      market_cap: number;
      market_cap_rank: number;
      total_volume: number;
      price_change_percentage_24h: number;
      price_change_percentage_7d_in_currency: number;
    }>>('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: 50,
      page: 1,
      sparkline: false,
      price_change_percentage: '7d',
    }),
    getGHSRate(),
  ]);

  return coins
    .filter((coin) => Number.isFinite(coin.current_price) && coin.current_price > 0)
    .map((coin) => {
      const priceGHS = coin.current_price * ghsRate;
      return {
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        priceUSD: coin.current_price,
        priceGHS,
        minInvestmentGHS: priceGHS * 0.001,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
        market_cap_rank: coin.market_cap_rank,
        price_change_percentage_24h: coin.price_change_percentage_24h,
        price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
      };
    });
}

// ─── 8. Global Market Data ───────────────────────────────────────────────────

export interface GlobalMarketData {
  total_market_cap_usd: number;
  total_volume_usd: number;
  btc_dominance: number;
  market_cap_change_24h: number;
}

export async function getGlobalData(): Promise<GlobalMarketData> {
  const data = await cgFetch<{
    data: {
      total_market_cap: { usd: number };
      total_volume: { usd: number };
      market_cap_percentage: { btc: number };
      market_cap_change_percentage_24h_usd: number;
    };
  }>('/global');

  return {
    total_market_cap_usd: data.data.total_market_cap.usd,
    total_volume_usd: data.data.total_volume.usd,
    btc_dominance: data.data.market_cap_percentage.btc,
    market_cap_change_24h: data.data.market_cap_change_percentage_24h_usd,
  };
}

// ─── 9. Trending Coins ────────────────────────────────────────────────────────

export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const data = await cgFetch<{
    coins: Array<{ item: {
      id: string; symbol: string; name: string;
      thumb: string; market_cap_rank: number;
      price_btc: number; score: number;
    }}>
  }>('/search/trending');

  return data.coins.map(({ item }) => ({
    id: item.id,
    symbol: item.symbol.toUpperCase(),
    name: item.name,
    thumb: item.thumb,
    market_cap_rank: item.market_cap_rank,
    price_btc: item.price_btc,
    score: item.score,
  }));
}
