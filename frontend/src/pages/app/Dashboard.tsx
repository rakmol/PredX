// Dashboard — Main authenticated home page at /dashboard

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search, X, Star, Flame,
  Brain, Eye, Clock, Target, TrendingUp, TrendingDown, Minus,
  Link2, Shield, ChevronRight,
} from 'lucide-react';
import {
  useTopCoins,
  useSearchCoins,
  useTrendingCoins,
  useFearGreed,
  useGlobalMarket,
} from '@/hooks/useCoins';
import { getRecentPredictions } from '@/lib/recentPredictions';
import { useAuth } from '@/hooks/useAuth';
import SparklineChart from '@/components/charts/SparklineChart';
import { formatPrice, formatGHS, formatPct, formatLargeNumber, signalBg, signalLabel, timeAgo } from '@/lib/utils';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1A2940] ${className}`} />;
}

function getWatchlistIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('predx_watchlist') ?? '[]');
  } catch { return []; }
}

type MoveWatchItem = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  currentPrice: number;
  targetPrice: number;
  targetPct: number;
  forecastHours: number;
  overallSignal: 'strong_buy' | 'buy' | 'hold';
  confidence: number;
  reason: string;
};

function buildMoveWatch(
  coins: NonNullable<ReturnType<typeof useTopCoins>['data']>,
  hours: 24 | 72,
): MoveWatchItem[] {
  const is24h = hours === 24;
  return [...coins]
    .filter((coin) => coin.current_price > 0)
    .map((coin) => {
      const dayMove = coin.price_change_percentage_24h ?? 0;
      const weekMove = coin.price_change_percentage_7d_in_currency ?? 0;
      const volumeRatio = coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0;
      const rankBoost = Math.max(0, 10 - Math.min(coin.market_cap_rank ?? 10, 10));

      // 24h favours recent intraday momentum; 72h factors in weekly trend more
      const momentumScore = is24h
        ? dayMove * 1.2 + weekMove * 0.2 + Math.min(volumeRatio * 200, 8) + rankBoost * 0.6
        : dayMove * 0.85 + weekMove * 0.5 + Math.min(volumeRatio * 180, 10) + rankBoost;

      // 24h moves are naturally smaller — cap at 8% upside; 72h up to 24%
      const maxPct = is24h ? 8 : 24;
      const minPct = is24h ? 1.5 : 5;
      const targetPct = Number(Math.max(minPct, Math.min(momentumScore * (is24h ? 0.35 : 1), maxPct)).toFixed(1));
      const targetPrice = coin.current_price * (1 + targetPct / 100);
      const confidence = Math.max(68, Math.min(91, Math.round(66 + Math.min(momentumScore, 18))));
      const overallSignal: MoveWatchItem['overallSignal'] =
        targetPct >= (is24h ? 5 : 15) ? 'strong_buy' :
        targetPct >= (is24h ? 3 : 8) ? 'buy' :
        'hold';

      return {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        image: coin.image,
        currentPrice: coin.current_price,
        targetPrice,
        targetPct,
        forecastHours: hours,
        overallSignal,
        confidence,
        reason: `${formatPct(dayMove)} in 24h, ${formatPct(weekMove)} over 7d, and rising turnover suggest this coin could outperform over the next ${hours} hours.`,
      };
    })
    .sort((a, b) => b.targetPct - a.targetPct)
    .slice(0, 5);
}

/* ─── Dashboard Futures Signals ────────────────────────────────────────────── */

type DashFutures = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  direction: 'long' | 'short' | 'neutral';
  leverage: number;
  confidence: number;
  signal_strength: 'strong' | 'moderate' | 'weak';
};

function buildDashboardFutures(
  coins: NonNullable<ReturnType<typeof useTopCoins>['data']>
): DashFutures[] {
  return [...coins]
    .filter((c) => c.current_price > 0)
    .map((coin) => {
      const day = coin.price_change_percentage_24h ?? 0;
      const week = coin.price_change_percentage_7d_in_currency ?? 0;
      const volRatio = coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0;
      const score = day * 1.5 + week * 0.5 + Math.min(volRatio * 100, 5);

      const direction: DashFutures['direction'] =
        score > 8 ? 'long' : score < -8 ? 'short' : 'neutral';
      const absScore = Math.abs(score);
      const leverage = direction === 'neutral' ? 1 : absScore > 18 ? 4 : absScore > 12 ? 3 : 2;
      const confidence = Math.round(Math.min(60 + absScore * 1.8, 88));
      const signal_strength: DashFutures['signal_strength'] =
        absScore > 18 ? 'strong' : absScore > 10 ? 'moderate' : 'weak';

      return { id: coin.id, name: coin.name, symbol: coin.symbol, image: coin.image, direction, leverage, confidence, signal_strength };
    })
    .filter((c) => c.direction !== 'neutral')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  /* ── Search state ── */
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Data ── */
  const { data: topCoins, isLoading: coinsLoading } = useTopCoins(50);
  const { data: searchResults } = useSearchCoins(query);
  const { data: trending, isLoading: trendingLoading } = useTrendingCoins();
  const { data: fearGreed } = useFearGreed();
  const { data: globalData, isLoading: globalLoading } = useGlobalMarket();

  /* ── Derived data ── */
  const topCoinsMap = useMemo(
    () => new Map(topCoins?.map((c) => [c.id, c]) ?? []),
    [topCoins],
  );

  const gainers = useMemo(
    () =>
      [...(topCoins ?? [])]
        .filter((c) => (c.price_change_percentage_24h ?? 0) > 0)
        .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, 5),
    [topCoins],
  );

  const losers = useMemo(
    () =>
      [...(topCoins ?? [])]
        .filter((c) => (c.price_change_percentage_24h ?? 0) < 0)
        .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
        .slice(0, 5),
    [topCoins],
  );

  const watchlistIds = useMemo(() => getWatchlistIds(), []);
  const watchlistCoins = useMemo(
    () => watchlistIds.map((id) => topCoinsMap.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof topCoinsMap.get>>[],
    [watchlistIds, topCoinsMap],
  );

  const recentPredictions = useMemo(() => getRecentPredictions(), []);
  const [moveWatchHorizon, setMoveWatchHorizon] = useState<24 | 72>(72);
  const [binanceDismissed, setBinanceDismissed] = useState(
    () => localStorage.getItem('predx_binance_banner') === 'dismissed'
  );
  const moveWatch = useMemo(
    () => (topCoins?.length ? buildMoveWatch(topCoins, moveWatchHorizon) : []),
    [topCoins, moveWatchHorizon],
  );
  const dashFutures = useMemo(
    () => (topCoins?.length ? buildDashboardFutures(topCoins) : []),
    [topCoins],
  );

  /* ── Search dropdown click-outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = searchFocused && query.trim().length >= 2 && (searchResults?.length ?? 0) > 0;

  /* ── Render ── */
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-20 md:pb-8 space-y-6">

      {/* ═══════════════════════════════════════
          GREETING
      ═══════════════════════════════════════ */}
      <div>
        <h1 className="text-2xl font-bold text-slate-50">
          {getGreeting()}{profile?.username ? `, ${profile.username}` : ''}.
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Here's what's moving in the market today.
        </p>
      </div>

      {/* ═══════════════════════════════════════
          1. SEARCH BAR
      ═══════════════════════════════════════ */}
      <div ref={searchRef} className="relative">
        <div
          className={`flex items-center gap-3 rounded-2xl border bg-[#0D1526] px-5 py-3.5 transition-all ${
            searchFocused ? 'border-cyan-400/50 shadow-[0_0_0_3px_rgba(34,211,238,0.08)]' : 'border-[#1E3050]'
          }`}
        >
          <Search size={20} className={`flex-shrink-0 transition-colors ${searchFocused ? 'text-cyan-400' : 'text-slate-500'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search by name, symbol, or paste a contract address (0x…)"
            className="flex-1 bg-transparent text-base text-slate-100 placeholder-slate-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="text-slate-500 transition-colors hover:text-slate-300"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search dropdown */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#1E3050] bg-[#0D1526] shadow-2xl">
            {searchResults!.slice(0, 8).map((coin) => {
              const marketData = topCoinsMap.get(coin.id);
              const positive = (marketData?.price_change_percentage_24h ?? 0) >= 0;
              return (
                <button
                  key={coin.id}
                  type="button"
                  onClick={() => {
                    navigate(`/coin/${coin.id}`);
                    setQuery('');
                    setSearchFocused(false);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/5"
                >
                  <img
                    src={coin.thumb}
                    alt={coin.name}
                    className="h-8 w-8 rounded-full border border-white/10 bg-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{coin.name}</p>
                    <p className="text-xs text-slate-500 uppercase">{coin.symbol}</p>
                  </div>
                  {marketData && (
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-sm font-medium text-slate-100">
                        {formatPrice(marketData.current_price)}
                      </p>
                      <p className={`text-xs font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPct(marketData.price_change_percentage_24h)}
                      </p>
                    </div>
                  )}
                  {coin.market_cap_rank && (
                    <span className="flex-shrink-0 rounded-full border border-[#223556] bg-[#101B30] px-2 py-0.5 text-xs text-slate-500">
                      #{coin.market_cap_rank}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          2. MARKET OVERVIEW BAR
      ═══════════════════════════════════════ */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {/* BTC Dominance */}
        <div className="flex-shrink-0 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 min-w-[160px]">
          {globalLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-500">BTC Dominance</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-50">
                {globalData?.btc_dominance.toFixed(1)}%
              </p>
              <div className="mt-1 h-1 w-full rounded-full bg-[#1A2940]">
                <div
                  className="h-1 rounded-full bg-amber-400"
                  style={{ width: `${globalData?.btc_dominance ?? 50}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Total Market Cap */}
        <div className="flex-shrink-0 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 min-w-[180px]">
          {globalLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-500">Market Cap</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-50">
                {formatLargeNumber(globalData?.total_market_cap_usd ?? 0)}
              </p>
              <p className={`mt-0.5 text-xs font-medium ${
                (globalData?.market_cap_change_24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPct(globalData?.market_cap_change_24h ?? 0)} (24h)
              </p>
            </>
          )}
        </div>

        {/* 24h Volume */}
        <div className="flex-shrink-0 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 min-w-[160px]">
          {globalLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-500">24h Volume</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-50">
                {formatLargeNumber(globalData?.total_volume_usd ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Global trading volume</p>
            </>
          )}
        </div>

        {/* Fear & Greed */}
        <div className="flex-shrink-0 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 min-w-[160px]">
          {!fearGreed ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-500">Fear &amp; Greed</p>
              <p
                className="mt-1 font-mono text-xl font-bold"
                style={{
                  color:
                    fearGreed.value >= 60 ? '#22C55E'
                    : fearGreed.value >= 40 ? '#EAB308'
                    : '#EF4444',
                }}
              >
                {fearGreed.value}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{fearGreed.label}</p>
            </>
          )}
        </div>

        {/* Top Coin quick stats */}
        {!coinsLoading && topCoins?.slice(0, 3).map((coin) => {
          const positive = (coin.price_change_percentage_24h ?? 0) >= 0;
          return (
            <Link
              key={coin.id}
              to={`/coin/${coin.id}`}
              className="flex-shrink-0 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 min-w-[160px] transition-colors hover:border-cyan-500/30"
            >
              <div className="flex items-center gap-2">
                <img src={coin.image} alt={coin.name} className="h-5 w-5 rounded-full" />
                <p className="text-xs uppercase tracking-wide text-slate-400">{coin.symbol}</p>
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-slate-50">
                {formatPrice(coin.current_price, 'USD', true)}
              </p>
              <p className={`mt-0.5 text-xs font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                {formatPct(coin.price_change_percentage_24h ?? 0)}
              </p>
            </Link>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════
          BINANCE CONNECT BANNER
      ═══════════════════════════════════════ */}
      {!binanceDismissed && (
        <div className="relative overflow-hidden rounded-2xl border border-[#F0B90B]/25 bg-gradient-to-r from-[#0D1526] to-[#0A0F1A] px-5 py-4">
          {/* Gold glow */}
          <div className="pointer-events-none absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-[#F0B90B]/8 to-transparent" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#F0B90B]/30 bg-[#F0B90B]/10">
                <Link2 size={18} className="text-[#F0B90B]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Connect Your Binance Account
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Link in read-only mode · AI analyzes your real holdings ·{' '}
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Shield size={10} /> AES-256 encrypted
                  </span>
                </p>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                to="/portfolio"
                className="flex items-center gap-1.5 rounded-xl bg-[#F0B90B] px-4 py-2 text-xs font-bold text-[#0A0F1A] shadow-lg shadow-[#F0B90B]/20 transition-all hover:bg-[#F0B90B]/90"
              >
                Connect Binance
                <ChevronRight size={13} />
              </Link>
              <button
                onClick={() => {
                  setBinanceDismissed(true);
                  localStorage.setItem('predx_binance_banner', 'dismissed');
                }}
                className="rounded-lg p-1.5 text-slate-600 transition-colors hover:text-slate-400"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          3. TOP MOVERS
      ═══════════════════════════════════════ */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">PredX Move Watch</h2>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-[#0D1526] p-0.5">
            {([24, 72] as const).map((h) => (
              <button
                key={h}
                onClick={() => setMoveWatchHorizon(h)}
                className={`rounded-full px-3 py-0.5 text-xs font-semibold transition-all ${
                  moveWatchHorizon === h
                    ? 'bg-cyan-400/20 text-cyan-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          {coinsLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))
            : moveWatch.map((coin) => (
                <Link
                  key={coin.id}
                  to={`/coin/${coin.id}`}
                  className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-4 transition-all hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.06)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={coin.image} alt={coin.name} className="h-9 w-9 rounded-full border border-white/10" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{coin.name}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{coin.symbol}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${signalBg(coin.overallSignal)}`}>
                      {signalLabel(coin.overallSignal)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Predicted Price</p>
                    <p className="mt-1 text-xl font-bold text-slate-50">
                      {formatPrice(coin.targetPrice, 'USD', true)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-emerald-300">
                      <TrendingUp size={14} />
                      {formatPct(coin.targetPct)} in {coin.forecastHours}h
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#223556] bg-[#101B30] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Current Price</p>
                    <p className="mt-1 font-mono text-sm text-slate-100">{formatPrice(coin.currentPrice, 'USD', true)}</p>
                    <p className="text-xs text-slate-400">{coin.confidence}% confidence</p>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-400">{coin.reason}</p>
                </Link>
              ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          4. FUTURES SIGNALS STRIP
      ═══════════════════════════════════════ */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-400" />
            <h2 className="text-base font-semibold text-slate-100">Futures Signals</h2>
          </div>
          <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-xs font-semibold text-purple-300">
            Live · Perpetual
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          {coinsLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            : dashFutures.length === 0
            ? (
              <div className="col-span-5 rounded-2xl border border-[#1E3050] bg-[#0D1526] p-6 text-center text-sm text-slate-500">
                No strong futures setups right now. Check back when the market shows clearer direction.
              </div>
            )
            : dashFutures.map((coin) => {
              const isLong = coin.direction === 'long';
              const dirColor = isLong ? 'text-emerald-400' : 'text-red-400';
              const dirBg = isLong ? 'border-emerald-500/25 bg-emerald-500/8' : 'border-red-500/25 bg-red-500/8';
              const DirIcon = isLong ? TrendingUp : TrendingDown;
              const strengthDot = coin.signal_strength === 'strong' ? 'bg-emerald-400' : coin.signal_strength === 'moderate' ? 'bg-amber-400' : 'bg-slate-500';
              return (
                <Link
                  key={coin.id}
                  to={`/coin/${coin.id}`}
                  className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-4 transition-all hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.06)]"
                >
                  {/* Coin header */}
                  <div className="flex items-center gap-2 mb-3">
                    <img src={coin.image} alt={coin.name} className="h-7 w-7 rounded-full border border-white/10" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{coin.name}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{coin.symbol}</p>
                    </div>
                  </div>

                  {/* Direction badge */}
                  <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${dirBg}`}>
                    <div className="flex items-center gap-1.5">
                      <DirIcon size={13} className={dirColor} />
                      <span className={`text-sm font-extrabold ${dirColor}`}>
                        {coin.direction.toUpperCase()} {coin.leverage}×
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${strengthDot}`} />
                      <span className="text-[10px] text-slate-500 capitalize">{coin.signal_strength}</span>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Confidence</span>
                      <span>{coin.confidence}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-[#1A2940] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLong ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${coin.confidence}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Gainers */}
        <div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">🚀</span>
            <h2 className="text-sm font-semibold text-slate-100">Top Gainers</h2>
            <span className="ml-auto text-xs text-slate-500">24h</span>
          </div>
          <div className="space-y-2">
            {coinsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))
              : gainers.map((coin) => (
                  <Link
                    key={coin.id}
                    to={`/coin/${coin.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
                  >
                    <img src={coin.image} alt={coin.name} className="h-7 w-7 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{coin.symbol}</p>
                      <p className="font-mono text-xs text-slate-400">
                        {formatPrice(coin.current_price, 'USD', true)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-bold text-green-400">
                      {formatPct(coin.price_change_percentage_24h)}
                    </span>
                  </Link>
                ))}
          </div>
        </div>

        {/* Losers */}
        <div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">💥</span>
            <h2 className="text-sm font-semibold text-slate-100">Top Losers</h2>
            <span className="ml-auto text-xs text-slate-500">24h</span>
          </div>
          <div className="space-y-2">
            {coinsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))
              : losers.map((coin) => (
                  <Link
                    key={coin.id}
                    to={`/coin/${coin.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
                  >
                    <img src={coin.image} alt={coin.name} className="h-7 w-7 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{coin.symbol}</p>
                      <p className="font-mono text-xs text-slate-400">
                        {formatPrice(coin.current_price, 'USD', true)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
                      {formatPct(coin.price_change_percentage_24h)}
                    </span>
                  </Link>
                ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          4. YOUR WATCHLIST
      ═══════════════════════════════════════ */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-yellow-400" />
            <h2 className="text-base font-semibold text-slate-100">Your Watchlist</h2>
          </div>
          {watchlistCoins.length > 0 && (
            <Link to="/markets" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              Browse more →
            </Link>
          )}
        </div>

        {coinsLoading && watchlistIds.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: Math.min(watchlistIds.length, 3) }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : watchlistCoins.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {watchlistCoins.map((coin) => {
              const positive = (coin.price_change_percentage_24h ?? 0) >= 0;
              return (
                <Link
                  key={coin.id}
                  to={`/coin/${coin.id}`}
                  className="group rounded-2xl border border-[#1E3050] bg-[#0D1526] p-4 transition-all hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.06)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={coin.image} alt={coin.name} className="h-9 w-9 rounded-full flex-shrink-0 border border-white/10" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{coin.name}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{coin.symbol}</p>
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                        positive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {formatPct(coin.price_change_percentage_24h ?? 0)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-bold text-slate-100">
                        {formatPrice(coin.current_price)}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {formatGHS(coin.current_price_ghs ?? coin.current_price * 15.5)}
                      </p>
                    </div>
                    <div className="h-10 w-24">
                      {coin.sparkline_in_7d?.price && (
                        <SparklineChart data={coin.sparkline_in_7d.price} positive={positive} />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#1E3050] bg-[#0D1526]/50 p-8 text-center">
            <Star size={32} className="mx-auto mb-3 text-slate-600" />
            <p className="font-medium text-slate-300">No coins in your watchlist yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Visit any coin's detail page and tap{' '}
              <span className="text-yellow-400">Add to Watchlist</span>
            </p>
            <Link
              to="/markets"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#223556] bg-[#101B30] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
            >
              Browse Markets
            </Link>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          5. TRENDING NOW
      ═══════════════════════════════════════ */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Flame size={16} className="text-orange-400" />
          <h2 className="text-base font-semibold text-slate-100">Trending Now</h2>
          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-xs font-semibold text-orange-300">
            CoinGecko
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {trendingLoading
            ? Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-32 flex-shrink-0" />
              ))
            : trending?.map((coin, i) => {
                const marketData = topCoinsMap.get(coin.id);
                const positive = (marketData?.price_change_percentage_24h ?? 0) >= 0;
                return (
                  <Link
                    key={coin.id}
                    to={`/coin/${coin.id}`}
                    className="group flex-shrink-0 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 transition-all hover:border-orange-400/30 w-36"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">#{i + 1}</span>
                      <img
                        src={coin.thumb}
                        alt={coin.name}
                        className="h-6 w-6 rounded-full border border-white/10"
                      />
                    </div>
                    <p className="mt-2 truncate text-xs font-semibold text-slate-200">{coin.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{coin.symbol}</p>
                    {marketData && (
                      <p className={`mt-1 text-xs font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPct(marketData.price_change_percentage_24h)}
                      </p>
                    )}
                  </Link>
                );
              })}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          6. RECENT PREDICTIONS
      ═══════════════════════════════════════ */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">Recent Predictions</h2>
          </div>
          <Link
            to="/predict"
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            New prediction →
          </Link>
        </div>

        {recentPredictions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1E3050] bg-[#0D1526]/50 p-8 text-center">
            <Brain size={32} className="mx-auto mb-3 text-slate-600" />
            <p className="font-medium text-slate-300">No predictions yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Open a coin and generate an AI forecast — it'll appear here.
            </p>
            <Link
              to="/markets"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Brain size={14} /> Generate a Forecast
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPredictions.map((pred, i) => (
              <Link
                key={`${pred.coinId}-${pred.horizon}-${i}`}
                to={`/coin/${pred.coinId}`}
                className="flex items-center gap-4 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 transition-colors hover:border-cyan-500/30 hover:bg-[#0D1526]"
              >
                <img
                  src={pred.coinImage}
                  alt={pred.coinName}
                  className="h-9 w-9 rounded-full border border-white/10 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-100">{pred.coinName}</p>
                    <span className="rounded-full border border-[#223556] bg-[#101B30] px-2 py-0.5 text-xs font-medium uppercase text-slate-500">
                      {pred.horizon}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${signalBg(pred.overall_signal)}`}>
                      {signalLabel(pred.overall_signal)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {pred.confidence_score}% confidence
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {pred.neutral_price_target && (
                    <p className="font-mono text-sm font-semibold text-slate-100">
                      {formatPrice(pred.neutral_price_target, 'USD', true)}
                    </p>
                  )}
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-slate-500">
                    <Clock size={10} />
                    {timeAgo(pred.viewed_at)}
                  </p>
                </div>
                <Eye size={14} className="flex-shrink-0 text-slate-600 group-hover:text-cyan-400" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-green-400" />
        Live market feed active · dashboard ideas refresh from current market momentum
      </div>
    </div>
  );
}
