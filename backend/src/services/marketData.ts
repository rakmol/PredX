// Market Data Service
// Fetches price data from CoinGecko API (free tier)

import axios from 'axios';
import { CoinData, OHLCVData } from '../types';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const FEAR_GREED_URL = 'https://api.alternative.me/fng/';

// Default 20 s timeout — prevents hanging requests from causing 502s
const DEFAULT_TIMEOUT_MS = 20_000;

// Simple in-memory cache to avoid rate limiting
const cache = new Map<string, { data: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

/** Retries an axios GET up to `maxAttempts` times, backing off on 429. */
async function cgGet<T>(url: string, params: Record<string, unknown> = {}, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data } = await axios.get<T>(url, { params, timeout: DEFAULT_TIMEOUT_MS });
      return data;
    } catch (err: unknown) {
      lastErr = err;
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429 && attempt < maxAttempts) {
          // Back off before retry: 2 s, then 5 s
          await new Promise((r) => setTimeout(r, attempt === 1 ? 2000 : 5000));
          continue;
        }
        // 4xx errors (except 429) are not retryable
        if (err.response && err.response.status >= 400 && err.response.status < 500) {
          throw err;
        }
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastErr;
}

export async function getTopCoins(limit = 50, currency = 'usd'): Promise<CoinData[]> {
  const key = `top_coins_${limit}_${currency}`;
  const cached = getCached<CoinData[]>(key);
  if (cached) return cached;

  const data = await cgGet<CoinData[]>(`${COINGECKO_BASE}/coins/markets`, {
    vs_currency: currency,
    order: 'market_cap_desc',
    per_page: limit,
    page: 1,
    sparkline: true,
    price_change_percentage: '7d',
  });
  setCache(key, data, 2 * 60_000); // 2 min cache
  return data;
}

export async function getCoinDetails(coinId: string, currency = 'usd'): Promise<CoinData> {
  const key = `coin_${coinId}_${currency}`;
  const cached = getCached<CoinData>(key);
  if (cached) return cached;

  const data = await cgGet<CoinData[]>(`${COINGECKO_BASE}/coins/markets`, {
    vs_currency: currency,
    ids: coinId,
    sparkline: true,
    price_change_percentage: '7d',
  });

  const coin = data[0];
  if (!coin) throw new Error(`Coin not found: ${coinId}`);
  setCache(key, coin, 60_000);
  return coin;
}

export async function getOHLCV(coinId: string, days: number, currency = 'usd'): Promise<OHLCVData[]> {
  const key = `ohlcv_${coinId}_${days}_${currency}`;
  const cached = getCached<OHLCVData[]>(key);
  if (cached) return cached;

  // Fetch OHLC and volume concurrently
  const [ohlcRaw, volumeRes] = await Promise.all([
    cgGet<number[][]>(`${COINGECKO_BASE}/coins/${coinId}/ohlc`, {
      vs_currency: currency,
      days,
    }),
    cgGet<{ total_volumes: [number, number][] }>(`${COINGECKO_BASE}/coins/${coinId}/market_chart`, {
      vs_currency: currency,
      days,
      interval: days <= 1 ? 'hourly' : 'daily',
    }),
  ]);

  const volumes: [number, number][] = volumeRes.total_volumes;
  const volMap = new Map(volumes.map(([ts, v]) => [Math.round(ts / 3600000), v]));

  const ohlcv: OHLCVData[] = ohlcRaw.map(([ts, o, h, l, c]) => ({
    timestamp: ts,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: volMap.get(Math.round(ts / 3600000)) ?? 0,
  }));

  const ttl = days <= 1 ? 300_000 : 1_800_000; // 5 min or 30 min
  setCache(key, ohlcv, ttl);
  return ohlcv;
}

export async function getFearGreedIndex(): Promise<{ value: number; label: string }> {
  const key = 'fear_greed';
  const cached = getCached<{ value: number; label: string }>(key);
  if (cached) return cached;

  const data = await cgGet<{ data: Array<{ value: string; value_classification: string }> }>(
    FEAR_GREED_URL,
    { limit: 1 }
  );
  const result = {
    value: parseInt(data.data[0].value),
    label: data.data[0].value_classification,
  };
  setCache(key, result, 3_600_000); // 1 hr cache
  return result;
}

export async function getCoinPriceHistory(
  coinId: string,
  days: number,
  currency = 'usd'
): Promise<Array<{ timestamp: number; price: number; volume: number }>> {
  const key = `history_${coinId}_${days}_${currency}`;
  const cached = getCached<Array<{ timestamp: number; price: number; volume: number }>>(key);
  if (cached) return cached;

  const data = await cgGet<{
    prices: [number, number][];
    total_volumes: [number, number][];
  }>(`${COINGECKO_BASE}/coins/${coinId}/market_chart`, {
    vs_currency: currency,
    days,
  });

  const prices = data.prices;
  const volumes = data.total_volumes ?? [];
  const volumeMap = new Map(volumes.map(([timestamp, volume]) => [timestamp, volume]));
  const history = prices.map(([timestamp, price]) => ({
    timestamp,
    price,
    volume: volumeMap.get(timestamp) ?? 0,
  }));
  const ttl = days <= 1 ? 300_000 : 1_800_000;
  setCache(key, history, ttl);
  return history;
}

export async function searchCoins(
  query: string
): Promise<{ id: string; symbol: string; name: string; thumb: string }[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Detect EVM contract address (0x + 40 hex chars)
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return searchByContractAddress(trimmed);
  }

  const key = `search_${trimmed.toLowerCase()}`;
  const cached = getCached<{ id: string; symbol: string; name: string; thumb: string }[]>(key);
  if (cached) return cached;

  const data = await cgGet<{ coins: Array<{ id: string; symbol: string; name: string; thumb: string }> }>(
    `${COINGECKO_BASE}/search`,
    { query: trimmed }
  );

  const results = data.coins.slice(0, 10).map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    thumb: c.thumb,
  }));
  setCache(key, results, 300_000);
  return results;
}

/** Look up a coin by EVM contract address across the most common chains. */
export async function searchByContractAddress(
  address: string
): Promise<{ id: string; symbol: string; name: string; thumb: string }[]> {
  const key = `contract_${address.toLowerCase()}`;
  const cached = getCached<{ id: string; symbol: string; name: string; thumb: string }[]>(key);
  if (cached) return cached;

  // Try the most common EVM-compatible platforms in order of popularity
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
      const data = await cgGet<{
        id: string;
        symbol: string;
        name: string;
        image: { thumb: string; small: string };
        market_cap_rank: number | null;
      }>(`${COINGECKO_BASE}/coins/${platform}/contract/${address.toLowerCase()}`);

      const result = [{
        id: data.id,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        thumb: data.image?.thumb ?? data.image?.small ?? '',
      }];
      setCache(key, result, 600_000); // 10 min cache for contract lookups
      return result;
    } catch {
      // Not on this platform — try the next one
    }
  }

  // Not found on any platform
  setCache(key, [], 60_000);
  return [];
}

export async function getGHSRate(): Promise<number> {
  const key = 'ghs_rate';
  const cached = getCached<number>(key);
  if (cached) return cached;

  try {
    const data = await cgGet<Record<string, { usd: number; ghs?: number }>>(
      `${COINGECKO_BASE}/simple/price`,
      { ids: 'tether', vs_currencies: 'usd,ghs' }
    );
    const rate = data?.tether?.ghs ?? 15.5;
    setCache(key, rate, 3_600_000);
    return rate;
  } catch {
    return 15.5; // Fallback rate
  }
}
