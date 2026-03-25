// CoinDetail — Main coin detail page at /coin/:coinId

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Brain, TrendingUp, TrendingDown,
  AlertTriangle, Zap, Clock, Star, Bell, BellRing,
  Activity, ChevronRight, Newspaper, Timer, Shield,
  Loader2, RefreshCcw, X, Sparkles, Share2,
} from 'lucide-react';
import ShareModal from '@/components/prediction/ShareModal';
import TechnicalBreakdown from '@/components/prediction/TechnicalBreakdown';
import FuturesSignalPanel from '@/components/prediction/FuturesSignalPanel';
import { marketApi, predictionApi, alertsApi } from '@/lib/api';
import {
  formatPrice, formatGHS, formatPct, formatLargeNumber,
  sentimentColor, timeAgo,
} from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import SignalBadge from '@/components/ui/SignalBadge';
import ConfidenceBar from '@/components/ui/ConfidenceBar';
import PriceChart from '@/components/charts/PriceChart';
import SentimentMeter from '@/components/charts/SentimentMeter';
import type { Horizon } from '@/types';
import type { ChartTimeframe } from '@/components/charts/chartUtils';
import { saveRecentPrediction } from '@/lib/recentPredictions';

/* ─── Constants ───────────────────────────────────────────────────────────── */

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

const ADVISOR_TIMEFRAMES = [
  { value: '1week',   label: '1W' },
  { value: '1month',  label: '1M' },
  { value: '3months', label: '3M' },
  { value: '6months', label: '6M' },
  { value: '1year',   label: '1Y' },
] as const;

type AdvisorTimeframe = typeof ADVISOR_TIMEFRAMES[number]['value'];

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1A2940] ${className}`} />;
}

/* ─── Countdown hook ──────────────────────────────────────────────────────── */

function useCountdown(expiresAt: string | undefined) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };

    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

/* ─── Watchlist hook ──────────────────────────────────────────────────────── */

function useWatchlist(coinId: string) {
  const [isWatched, setIsWatched] = useState(() => {
    try {
      const saved = localStorage.getItem('predx_watchlist');
      return saved ? (JSON.parse(saved) as string[]).includes(coinId) : false;
    } catch { return false; }
  });

  const toggle = useCallback(() => {
    try {
      const saved = localStorage.getItem('predx_watchlist');
      const list: string[] = saved ? JSON.parse(saved) : [];
      const updated = isWatched
        ? list.filter((id) => id !== coinId)
        : [...list, coinId];
      localStorage.setItem('predx_watchlist', JSON.stringify(updated));
      setIsWatched((prev) => !prev);
      toast.success(isWatched ? 'Removed from watchlist' : 'Added to watchlist');
    } catch {
      toast.error('Could not update watchlist');
    }
  }, [coinId, isWatched]);

  return { isWatched, toggle };
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function CoinDetail() {
  const { coinId = 'bitcoin' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Chart / prediction state
  const [horizon, setHorizon] = useState<Horizon>('7d');
  // Auto-enable: prediction loads immediately on page open
  const [analysisEnabled, setAnalysisEnabled] = useState(true);
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('7D');

  // Alert modal state
  const [showAlert, setShowAlert] = useState(false);
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [creatingAlert, setCreatingAlert] = useState(false);

  // Advisor CTA state
  const [advisorAmount, setAdvisorAmount] = useState('500');
  const [advisorCurrency, setAdvisorCurrency] = useState<'GHS' | 'USD'>('GHS');
  const [advisorTimeframe, setAdvisorTimeframe] = useState<AdvisorTimeframe>('3months');

  // Watchlist
  const { isWatched, toggle: toggleWatchlist } = useWatchlist(coinId);

  // Share modal
  const [showShare, setShowShare] = useState(false);

  // Technical breakdown toggle
  const [showTechBreakdown, setShowTechBreakdown] = useState(false);

  /* ── Queries ── */

  const { data: coin, isLoading: coinLoading } = useQuery({
    queryKey: ['coin', coinId],
    queryFn: () => marketApi.getCoin(coinId),
    staleTime: 60_000,
    retry: 2,
  });

  // History is fetched lazily by PriceChart internally — no need to block the page on it.

  const { data: ghsRate = 15.5 } = useQuery({
    queryKey: ['ghs-rate'],
    queryFn: () => marketApi.getGhsRate(),
    staleTime: 300_000,
  });

  const {
    data: prediction,
    isLoading: predLoading,
    refetch: refetchPred,
    error: predError,
    isRefetching: predRefetching,
  } = useQuery({
    queryKey: ['prediction', coinId, horizon],
    queryFn: () => predictionApi.getPrediction(coinId, horizon),
    enabled: analysisEnabled && !!coinId,
    staleTime: 300_000,
    retry: 1,
  });

  /* ── Countdown ── */
  const countdown = useCountdown(prediction?.expires_at);
  const predictionErrorMessage =
    predError instanceof Error && predError.message
      ? predError.message
      : 'Failed to generate forecast. Please try again.';

  /* ── Save to recent predictions when a new result arrives ── */
  useEffect(() => {
    if (prediction && coin) {
      saveRecentPrediction({
        coinId: coin.id,
        coinName: coin.name,
        coinSymbol: coin.symbol.toUpperCase(),
        coinImage: coin.image,
        horizon: prediction.prediction_horizon,
        overall_signal: prediction.overall_signal,
        confidence_score: prediction.confidence_score,
        neutral_price_target: prediction.scenarios.neutral.price_target,
        generated_at: prediction.generated_at,
        viewed_at: new Date().toISOString(),
      });
    }
  }, [prediction?.generated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived values ── */
  const positive = (coin?.price_change_percentage_24h ?? 0) >= 0;
  const priceGHS = coin ? coin.current_price * ghsRate : 0;
  const username = (profile as any)?.username ?? (profile as any)?.email?.split('@')[0] ?? 'User';

  // Market signals derived from prediction data (no live news API)
  const newsItems = prediction
    ? [
        ...prediction.key_opportunities.slice(0, 3).map((text) => ({ text, tag: 'bullish' as const })),
        ...prediction.key_risks.slice(0, 2).map((text) => ({ text, tag: 'bearish' as const })),
      ]
    : [];

  /* ── Alert creation ── */
  const handleCreateAlert = async () => {
    if (!coin || !alertThreshold) return;
    const threshold = Number(alertThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      toast.error('Enter a valid price threshold');
      return;
    }
    setCreatingAlert(true);
    try {
      await alertsApi.createAlert({
        coin_id: coin.id,
        coin_symbol: coin.symbol.toUpperCase(),
        condition: alertCondition,
        threshold,
      });
      toast.success(
        `Alert set: notify when ${coin.symbol.toUpperCase()} goes ${alertCondition} ${formatPrice(threshold)}`,
      );
      setShowAlert(false);
      setAlertThreshold('');
    } catch {
      toast.error('Failed to create alert. Try again.');
    } finally {
      setCreatingAlert(false);
    }
  };

  /* ── Advisor navigation ── */
  const handleGetPlan = () => {
    const params = new URLSearchParams({
      coin: coinId,
      amount: advisorAmount,
      currency: advisorCurrency,
      timeframe: advisorTimeframe,
    });
    navigate(`/advisor?${params.toString()}`);
  };

  /* ── Horizon tab handler ── */
  const handleHorizonChange = (h: Horizon) => {
    setHorizon(h);
    if (!analysisEnabled) setAnalysisEnabled(true);
    // queryKey change triggers automatic refetch via react-query
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-20 md:pb-8 space-y-4">

      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* ═══════════════════════════════════════════
          1. COIN HEADER
      ═══════════════════════════════════════════ */}
      <section className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-5">
        {coinLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="ml-auto h-8 w-36" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="ml-auto h-9 w-36" />
            </div>
          </div>
        ) : coin ? (
          <>
            {/* Identity + price */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={coin.image}
                  alt={coin.name}
                  className="h-14 w-14 rounded-full border border-white/10 bg-slate-900 object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-50">{coin.name}</h1>
                    <span className="rounded-full border border-[#223556] bg-[#101B30] px-2 py-0.5 text-xs font-medium tracking-wider text-slate-400">
                      #{coin.market_cap_rank}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm uppercase tracking-wider text-slate-500">
                    {coin.symbol}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-mono text-3xl font-bold text-slate-50">
                  {formatPrice(coin.current_price)}
                </p>
                <p className="mt-0.5 font-mono text-sm text-slate-400">
                  {formatGHS(priceGHS)}
                </p>
                <div
                  className={`mt-1 flex items-center justify-end gap-1 text-sm font-semibold ${
                    positive ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {formatPct(coin.price_change_percentage_24h ?? 0)} (24h)
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#1A2940] bg-[#08111F] px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Market Cap</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {formatLargeNumber(coin.market_cap)}
                </p>
              </div>
              <div className="rounded-xl border border-[#1A2940] bg-[#08111F] px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Volume 24h</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {formatLargeNumber(coin.total_volume)}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-[#1A2940] bg-[#08111F] px-3 py-2.5 sm:col-span-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">24h Range</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {formatPrice(coin.low_24h, 'USD', true)} – {formatPrice(coin.high_24h, 'USD', true)}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleWatchlist}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  isWatched
                    ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
                    : 'border-[#223556] bg-[#101B30] text-slate-300 hover:border-yellow-500/40 hover:text-yellow-300'
                }`}
              >
                <Star
                  size={14}
                  className={isWatched ? 'fill-yellow-400 text-yellow-400' : ''}
                />
                {isWatched ? 'Watching' : 'Add to Watchlist'}
              </button>

              <button
                type="button"
                onClick={() => setShowAlert(true)}
                className="flex items-center gap-2 rounded-xl border border-[#223556] bg-[#101B30] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
              >
                <Bell size={14} /> Set Alert
              </button>

              {/* Share button — visible once a prediction is loaded */}
              {prediction && (
                <button
                  type="button"
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-[#101B30] px-4 py-2 text-sm font-medium text-purple-300 transition-colors hover:border-purple-500/50 hover:bg-purple-500/10"
                >
                  <Share2 size={14} /> Share
                </button>
              )}

              <button
                type="button"
                onClick={() => refetchPred()}
                disabled={predLoading || predRefetching}
                className="ml-auto flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#101B30] px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {predLoading || predRefetching
                  ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                  : <><RefreshCcw size={14} /> Refresh Analysis</>
                }
              </button>
            </div>
          </>
        ) : null}
      </section>

      {/* ═══════════════════════════════════════════
          2. PRICE CHART
          PriceChart fetches its own OHLCV data internally — render it as soon as
          the coin identity is known, without waiting for any separate history query.
      ═══════════════════════════════════════════ */}
      <section>
        {coin ? (
          <PriceChart
            coinId={coinId}
            ghsRate={ghsRate}
            timeframe={chartTimeframe}
            onTimeframeChange={setChartTimeframe}
          />
        ) : coinLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : null}
      </section>

      {/* ═══════════════════════════════════════════
          3. AI PREDICTION SECTION
      ═══════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-2xl border border-[#1E3050] bg-[#0D1526]">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-[#1E3050] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">AI Price Forecast</h2>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-xs font-medium text-cyan-400/80">
              AI-Powered
            </span>
          </div>

          {/* Horizon tabs */}
          <div className="flex gap-1 rounded-xl border border-[#1E3050] bg-[#08111F] p-1">
            {HORIZONS.map((h) => (
              <button
                key={h.value}
                type="button"
                onClick={() => handleHorizonChange(h.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  horizon === h.value
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Initial loading state (prediction is auto-enabled) */}
          {!predLoading && !prediction && !predError && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Brain size={44} className="mb-4 text-cyan-400/40" />
              <h3 className="mb-1 text-base font-semibold text-slate-200">Generating AI Forecast…</h3>
              <p className="max-w-sm text-sm text-slate-400">
                Analyzing technical indicators, market sentiment, and price momentum.
              </p>
            </div>
          )}

          {/* Loading */}
          {predLoading && analysisEnabled && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Skeleton className="h-28 flex-1" />
                <Skeleton className="h-28 flex-1" />
                <Skeleton className="h-28 flex-1" />
              </div>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {/* Error */}
          {predError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 text-red-400" />
                {predictionErrorMessage}
              </div>
            </div>
          )}

          {/* Prediction result */}
          {prediction && !predLoading && (
            <div className="relative space-y-4">
              {/* Signal + confidence */}
              <div className="rounded-xl border border-[#1E3050] bg-[#08111F] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                      AI Signal · {horizon} outlook
                    </p>
                    <SignalBadge signal={prediction.overall_signal} size="lg" />
                    {prediction.signal_explanation && (
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        {prediction.signal_explanation}
                      </p>
                    )}
                    <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={11} />
                      Generated {timeAgo(prediction.generated_at)}
                    </p>
                  </div>
                  <div className="sm:w-48 sm:flex-shrink-0">
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Confidence</p>
                    <ConfidenceBar value={prediction.confidence_score} signalAgreement={prediction.signal_agreement} />
                  </div>
                </div>
              </div>

              {/* Price Range */}
              {prediction.price_range && (
                <div className="rounded-xl border border-[#1E3050] bg-[#08111F] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Predicted Price Range · {horizon}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400">Conservative</p>
                      <p className="mt-1.5 font-mono text-base font-bold text-slate-100 sm:text-lg">
                        {formatPrice(prediction.price_range.low)}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {formatGHS(prediction.price_range.low * ghsRate)}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${prediction.price_range.low_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPct(prediction.price_range.low_pct)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-400">Base Case</p>
                      <p className="mt-1.5 font-mono text-base font-bold text-slate-100 sm:text-lg">
                        {formatPrice(prediction.price_range.expected)}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {formatGHS(prediction.price_range.expected * ghsRate)}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${prediction.price_range.expected_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPct(prediction.price_range.expected_pct)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-green-400">Upside</p>
                      <p className="mt-1.5 font-mono text-base font-bold text-slate-100 sm:text-lg">
                        {formatPrice(prediction.price_range.high)}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {formatGHS(prediction.price_range.high * ghsRate)}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${prediction.price_range.high_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPct(prediction.price_range.high_pct)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3 Scenario cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(['bullish', 'neutral', 'bearish'] as const).map((scenario) => {
                  const s = prediction.scenarios[scenario];
                  const cfg = {
                    bullish: { border: 'border-green-500/30', bg: 'bg-green-500/5',  text: 'text-green-400',  label: 'Bullish' },
                    neutral: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5', text: 'text-yellow-400', label: 'Neutral' },
                    bearish: { border: 'border-red-500/30',   bg: 'bg-red-500/5',    text: 'text-red-400',   label: 'Bearish' },
                  }[scenario];

                  return (
                    <div
                      key={scenario}
                      className={`relative overflow-hidden rounded-xl border p-4 ${cfg.border} ${cfg.bg}`}
                    >
                      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>
                        {cfg.label}
                      </p>

                      <>
                          <p className="font-mono text-2xl font-bold text-slate-100">
                            {s.price_target ? formatPrice(s.price_target) : '—'}
                          </p>
                          <p className={`text-sm font-medium ${cfg.text}`}>
                            {s.percentage_change !== null ? formatPct(s.percentage_change) : '—'}
                          </p>
                          {s.price_target && (
                            <p className="mt-0.5 font-mono text-xs text-slate-400">
                              {formatGHS(s.price_target * ghsRate)}
                            </p>
                          )}
                          <div className="mt-3">
                            <ConfidenceBar value={s.confidence} label="Probability" />
                          </div>
                          {s.key_factors.length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {s.key_factors.slice(0, 2).map((f, i) => (
                                <li key={i} className="flex gap-1.5 text-xs text-slate-400">
                                  <span className={`mt-0.5 flex-shrink-0 ${cfg.text}`}>•</span>
                                  {f}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                    </div>
                  );
                })}
              </div>

              {/* No gating — all users see full prediction */}

              {/* AI Reasoning — pro only */}
              {prediction.ai_analysis && (
                <div className="rounded-xl border border-[#1E3050] bg-[#08111F] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Brain size={14} className="text-cyan-400" />
                    <h3 className="text-sm font-semibold text-slate-200">AI Reasoning</h3>
                  </div>

                  {/* Layer 1 — plain English summary, always visible */}
                  <p className="text-sm leading-relaxed text-slate-300">{prediction.ai_analysis}</p>

                  {/* Layer 2 — full technical breakdown, collapsible */}
                  <button
                    onClick={() => setShowTechBreakdown(v => !v)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <ChevronRight
                      size={13}
                      className={`transition-transform duration-200 ${showTechBreakdown ? 'rotate-90' : ''}`}
                    />
                    {showTechBreakdown ? 'Hide technical analysis' : 'See full technical analysis'}
                  </button>

                  {showTechBreakdown && (
                    <div className="mt-3">
                      <TechnicalBreakdown technicals={prediction.technicals} />
                    </div>
                  )}
                </div>
              )}

              {/* Risks + Opportunities — pro only */}
              {(
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-red-500/20 bg-[#08111F] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <AlertTriangle size={13} className="text-red-400" />
                      <h3 className="text-sm font-semibold text-red-400">Key Risks</h3>
                    </div>
                    <ul className="space-y-3">
                      {prediction.key_risks.map((r, i) => {
                        const sepIdx = r.indexOf(' — ');
                        const bold = sepIdx !== -1 ? r.slice(0, sepIdx) : r;
                        const plain = sepIdx !== -1 ? r.slice(sepIdx + 3) : '';
                        return (
                          <li key={i} className="pl-3 border-l-2 border-red-500/40">
                            <p className="text-xs font-semibold text-slate-200">{bold}</p>
                            {plain && <p className="mt-0.5 text-xs text-slate-500">{plain}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-green-500/20 bg-[#08111F] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Shield size={13} className="text-green-400" />
                      <h3 className="text-sm font-semibold text-green-400">Key Opportunities</h3>
                    </div>
                    <ul className="space-y-3">
                      {prediction.key_opportunities.map((o, i) => {
                        const sepIdx = o.indexOf(' — ');
                        const bold = sepIdx !== -1 ? o.slice(0, sepIdx) : o;
                        const plain = sepIdx !== -1 ? o.slice(sepIdx + 3) : '';
                        return (
                          <li key={i} className="pl-3 border-l-2 border-green-500/40">
                            <p className="text-xs font-semibold text-slate-200">{bold}</p>
                            {plain && <p className="mt-0.5 text-xs text-slate-500">{plain}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}

              {/* Futures signal panel */}
              {prediction.futures_signal && (
                <FuturesSignalPanel
                  signal={prediction.futures_signal}
                  coinSymbol={prediction.coin_symbol}
                />
              )}

              {/* Countdown */}
              {countdown && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Timer size={12} />
                  Forecast expires in{' '}
                  <span className="font-mono text-slate-300">{countdown}</span>
                </div>
              )}

              {/* Disclaimer */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-amber-400" />
                  <p className="text-xs leading-relaxed text-amber-200/70">
                    AI forecasts are generated from technical and sentiment signals and are not
                    financial advice. Crypto markets are highly volatile — never invest more than
                    you can afford to lose.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          4. TECHNICAL ANALYSIS
      ═══════════════════════════════════════════ */}
      {(prediction || predLoading) && (
        <section className="space-y-4 rounded-2xl border border-[#1E3050] bg-[#0D1526] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-slate-400" />
              <h2 className="text-base font-semibold text-slate-100">Technical Analysis</h2>
            </div>
            {prediction && <SignalBadge signal={prediction.overall_signal} size="sm" />}
          </div>

          {predLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : prediction ? (
            <>
              {/* Indicator rows */}
              <div className="divide-y divide-[#1A2940]">
                {/* RSI */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">RSI (14)</p>
                    <p className="text-xs capitalize text-slate-500">{prediction.technicals.rsi_signal}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p
                      className={`font-mono text-base font-bold ${
                        prediction.technicals.rsi < 30
                          ? 'text-green-400'
                          : prediction.technicals.rsi > 70
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}
                    >
                      {prediction.technicals.rsi.toFixed(1)}
                    </p>
                    <SignalBadge
                      signal={
                        prediction.technicals.rsi < 30
                          ? 'buy'
                          : prediction.technicals.rsi > 70
                          ? 'sell'
                          : 'hold'
                      }
                      size="sm"
                    />
                  </div>
                </div>

                {/* MACD */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">MACD</p>
                    <p className="text-xs capitalize text-slate-500">{prediction.technicals.macd.trend}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p
                      className={`font-mono text-base font-bold ${
                        prediction.technicals.macd.trend === 'bullish'
                          ? 'text-green-400'
                          : prediction.technicals.macd.trend === 'bearish'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}
                    >
                      {prediction.technicals.macd.histogram.toFixed(4)}
                    </p>
                    <SignalBadge
                      signal={
                        prediction.technicals.macd.trend === 'bullish'
                          ? 'buy'
                          : prediction.technicals.macd.trend === 'bearish'
                          ? 'sell'
                          : 'hold'
                      }
                      size="sm"
                    />
                  </div>
                </div>

                {/* Moving Averages */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Moving Averages</p>
                    <p className="text-xs text-slate-500">
                      MA7: {formatPrice(prediction.technicals.moving_averages.ma7, 'USD', true)} ·{' '}
                      MA25: {formatPrice(prediction.technicals.moving_averages.ma25, 'USD', true)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p
                      className={`text-sm font-semibold capitalize ${
                        prediction.technicals.moving_averages.trend.includes('bull')
                          ? 'text-green-400'
                          : prediction.technicals.moving_averages.trend.includes('bear')
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}
                    >
                      {prediction.technicals.moving_averages.trend.replace('_', ' ')}
                    </p>
                    <SignalBadge
                      signal={
                        prediction.technicals.moving_averages.trend.includes('bull')
                          ? 'buy'
                          : prediction.technicals.moving_averages.trend.includes('bear')
                          ? 'sell'
                          : 'hold'
                      }
                      size="sm"
                    />
                  </div>
                </div>

                {/* Bollinger Bands */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Bollinger Bands</p>
                    <p className="text-xs capitalize text-slate-500">
                      {prediction.technicals.bollinger.position}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-slate-400">
                      U: {formatPrice(prediction.technicals.bollinger.upper, 'USD', true)}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      L: {formatPrice(prediction.technicals.bollinger.lower, 'USD', true)}
                    </p>
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Volume Trend</p>
                    <p className="text-xs capitalize text-slate-500">
                      {prediction.technicals.volume_trend}
                    </p>
                  </div>
                  <SignalBadge
                    signal={
                      prediction.technicals.volume_trend === 'increasing'
                        ? 'buy'
                        : prediction.technicals.volume_trend === 'decreasing'
                        ? 'sell'
                        : 'hold'
                    }
                    size="sm"
                  />
                </div>
              </div>

            </>
          ) : null}
        </section>
      )}

      {/* ═══════════════════════════════════════════
          5. SENTIMENT ANALYSIS
      ═══════════════════════════════════════════ */}
      {(prediction || predLoading) && (
        <section className="space-y-4 rounded-2xl border border-[#1E3050] bg-[#0D1526] p-5">
          <div className="flex items-center gap-2">
            <Newspaper size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Sentiment Analysis</h2>
          </div>

          {predLoading ? (
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
            </div>
          ) : prediction ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                {/* Gauge */}
                <SentimentMeter
                  sentiment={prediction.sentiment}
                  previousScore={Math.max(
                    0,
                    Math.min(
                      100,
                      prediction.sentiment.fear_greed_index -
                        (prediction.sentiment.news_sentiment_score +
                          prediction.sentiment.social_sentiment_score) *
                          10,
                    ),
                  )}
                />

                {/* Summary + social buzz */}
                <div className="space-y-3 rounded-xl border border-[#1E3050] bg-[#08111F] p-4">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                      Overall Sentiment
                    </p>
                    <p
                      className={`text-base font-semibold capitalize ${sentimentColor(
                        prediction.sentiment.overall_sentiment,
                      )}`}
                    >
                      {prediction.sentiment.overall_sentiment.replace('_', ' ')}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {prediction.sentiment.sentiment_summary}
                  </p>

                  {/* Social buzz */}
                  <div className="border-t border-[#1E3050] pt-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Social Buzz</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#223556] bg-[#101B30] px-3 py-2">
                        <p className="text-xs text-slate-500">News Sentiment</p>
                        <p
                          className={`mt-0.5 text-sm font-semibold ${
                            prediction.sentiment.news_sentiment_score > 0.3
                              ? 'text-green-400'
                              : prediction.sentiment.news_sentiment_score < -0.3
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {prediction.sentiment.news_sentiment_score > 0 ? '+' : ''}
                          {(prediction.sentiment.news_sentiment_score * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#223556] bg-[#101B30] px-3 py-2">
                        <p className="text-xs text-slate-500">Social Score</p>
                        <p
                          className={`mt-0.5 text-sm font-semibold ${
                            prediction.sentiment.social_sentiment_score > 0.3
                              ? 'text-green-400'
                              : prediction.sentiment.social_sentiment_score < -0.3
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {prediction.sentiment.social_sentiment_score > 0 ? '+' : ''}
                          {(prediction.sentiment.social_sentiment_score * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Market signals derived from prediction */}
              {newsItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Market Signals
                  </p>
                  <div className="overflow-hidden rounded-xl border border-[#1E3050] bg-[#08111F] divide-y divide-[#1A2940]">
                    {newsItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                        <span
                          className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.tag === 'bullish'
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {item.tag}
                        </span>
                        <p className="text-sm leading-snug text-slate-300">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </section>
      )}

      {/* ═══════════════════════════════════════════
          6. INVESTMENT ADVISOR CTA
      ═══════════════════════════════════════════ */}
      <section className="rounded-2xl border border-[#1E3050] bg-gradient-to-br from-cyan-500/10 via-[#0D1526] to-[#0D1526] p-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-400" />
          <h2 className="text-base font-semibold text-slate-100">
            Want to invest in {coin?.name ?? coinId}? Let AI build your plan.
          </h2>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Enter an amount and timeframe — the AI advisor will build a risk-adjusted allocation with
          bullish, neutral, and bearish scenarios.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Amount + currency toggle */}
          <div className="flex flex-1 overflow-hidden rounded-xl border border-[#223556] bg-[#101B30]">
            <input
              type="number"
              min="0"
              step="any"
              value={advisorAmount}
              onChange={(e) => setAdvisorAmount(e.target.value)}
              placeholder="500"
              className="flex-1 bg-transparent px-4 py-2.5 text-sm text-slate-100 outline-none"
            />
            <div className="flex border-l border-[#223556]">
              {(['GHS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAdvisorCurrency(c)}
                  className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
                    advisorCurrency === c
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe quick select */}
          <div className="flex gap-1 rounded-xl border border-[#223556] bg-[#08111F] p-1">
            {ADVISOR_TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAdvisorTimeframe(t.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  advisorTimeframe === t.value
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleGetPlan}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Get My Plan <ChevronRight size={14} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          ALERT MODAL
      ═══════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════
          SHARE MODAL
      ═══════════════════════════════════════════ */}
      {prediction && coin && (
        <ShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          coinId={coinId}
          coinName={coin.name}
          coinSymbol={coin.symbol.toUpperCase()}
          coinImage={coin.image}
          timeframe={horizon}
          signal={prediction.overall_signal}
          confidenceScore={prediction.confidence_score}
          sentiment={prediction.sentiment.overall_sentiment}
          username={username}
        />
      )}

      {showAlert && coin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E3050] bg-[#0D1526] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing size={16} className="text-cyan-400" />
                <h3 className="font-semibold text-slate-100">Set Price Alert</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAlert(false)}
                className="text-slate-500 transition-colors hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Current price reference */}
              <div className="rounded-xl border border-[#223556] bg-[#08111F] px-4 py-3">
                <p className="text-xs text-slate-500">Current price</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-slate-100">
                  {formatPrice(coin.current_price)}
                </p>
              </div>

              {/* Condition toggle */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Notify me when price goes
                </label>
                <div className="flex gap-1 rounded-xl border border-[#223556] bg-[#101B30] p-1">
                  {(['above', 'below'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAlertCondition(c)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                        alertCondition === c
                          ? c === 'above'
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Threshold */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Price (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  placeholder={coin.current_price.toFixed(2)}
                  className="w-full rounded-xl border border-[#223556] bg-[#101B30] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateAlert}
                disabled={creatingAlert || !alertThreshold}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {creatingAlert ? (
                  <><Loader2 size={15} className="animate-spin" /> Creating...</>
                ) : (
                  <><Bell size={15} /> Create Alert</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
