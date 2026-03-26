import { useQuery } from '@tanstack/react-query';
import {
  searchCoins,
  getCoinPrice,
  getCoinData,
  getCoinOHLCV,
  getPriceHistory,
  getTopCoins,
  getTrendingCoins,
  getGHSRate,
  getGlobalData,
} from '@/lib/coingecko';
import { marketApi } from '@/lib/api';

// Cache times
const PRICE_STALE   = 60_000;         // 1 min  — live price
const DETAIL_STALE  = 2 * 60_000;     // 2 min  — full coin data
const HISTORY_STALE = 5 * 60_000;     // 5 min  — chart history
const SEARCH_STALE  = 30_000;         // 30 sec — search results
const TREND_STALE   = 5 * 60_000;     // 5 min  — trending
const GHS_STALE     = 60 * 60_000;    // 1 hour — exchange rate

// ─── GHS Rate ─────────────────────────────────────────────────────────────────

export function useGHSRate() {
  return useQuery({
    queryKey: ['ghs-rate'],
    queryFn: getGHSRate,
    staleTime: GHS_STALE,
    refetchInterval: GHS_STALE,
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function useSearchCoins(query: string) {
  const trimmed = query.trim();
  // Enable for normal text (>= 2 chars) OR for a full EVM contract address (42 chars: 0x + 40 hex)
  const enabled = trimmed.length >= 2 || /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  return useQuery({
    queryKey: ['search', trimmed],
    queryFn: () => searchCoins(trimmed),
    enabled,
    staleTime: SEARCH_STALE,
    placeholderData: [],
  });
}

// ─── Top Coins ────────────────────────────────────────────────────────────────

export function useTopCoins(limit = 50) {
  return useQuery({
    queryKey: ['top-coins', limit],
    queryFn: () => marketApi.getTopCoins(limit).catch(() => getTopCoins(limit)),
    staleTime: PRICE_STALE,
    refetchInterval: PRICE_STALE,
    placeholderData: (prev) => prev,
    gcTime: 5 * 60_000,
  });
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export function useTrendingCoins() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: getTrendingCoins,
    staleTime: TREND_STALE,
    refetchInterval: TREND_STALE,
  });
}

// ─── Single Coin Price (lightweight) ─────────────────────────────────────────

export function useCoinPrice(coinId: string) {
  return useQuery({
    queryKey: ['coin-price', coinId],
    queryFn: () => getCoinPrice(coinId),
    enabled: !!coinId,
    staleTime: PRICE_STALE,
    refetchInterval: PRICE_STALE,
  });
}

// ─── Full Coin Detail ─────────────────────────────────────────────────────────

export function useCoinData(coinId: string) {
  return useQuery({
    queryKey: ['coin-data', coinId],
    queryFn: () => getCoinData(coinId),
    enabled: !!coinId,
    staleTime: DETAIL_STALE,
    refetchInterval: DETAIL_STALE,
    retry: 2,
  });
}

// ─── Global Market Data ───────────────────────────────────────────────────────

export function useGlobalMarket() {
  return useQuery({
    queryKey: ['global-market'],
    queryFn: getGlobalData,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ─── Price History (line chart) ───────────────────────────────────────────────

export function usePriceHistory(coinId: string, days: number) {
  return useQuery({
    queryKey: ['price-history', coinId, days],
    queryFn: () => getPriceHistory(coinId, days),
    enabled: !!coinId && days > 0,
    staleTime: HISTORY_STALE,
    // Don't auto-refetch charts — user explicitly picks timeframe
    refetchOnWindowFocus: false,
  });
}

// ─── OHLCV / Candlestick ─────────────────────────────────────────────────────
// Routed through the backend so server-side caching + timeouts apply.
// This eliminates the slow double-fetch (OHLC + market_chart) that was going
// direct to CoinGecko from the browser.

export function useOHLCV(coinId: string, days: number) {
  return useQuery({
    queryKey: ['ohlcv', coinId, days],
    queryFn: async () => {
      try {
        return await marketApi.getOHLCV(coinId, days);
      } catch {
        return getCoinOHLCV(coinId, days);
      }
    },
    enabled: !!coinId && days > 0,
    staleTime: HISTORY_STALE,
    gcTime: 10 * 60_000,   // keep cached data 10 min so timeframe switches are instant
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

// ─── Fear & Greed (kept for backward compat — now proxied via backend) ────────

export { useFearGreed } from './useFearGreed';
