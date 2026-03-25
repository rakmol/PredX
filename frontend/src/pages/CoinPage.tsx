/**
 * CoinPage — public shareable landing page at /c/:coinId
 *
 * This is what people see when they tap a shared PredX link.
 * Goals:
 *  1. Show enough to be interesting (coin name, price, overall signal teaser)
 *  2. Hard-gate the full prediction behind sign-up
 *  3. Drive installs via a single clear CTA
 *
 * Accessible without login — no ProtectedRoute wrapper.
 */

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, ArrowRight, Brain,
  Lock, Zap, CheckCircle,
} from 'lucide-react';
import { marketApi } from '@/lib/api';
import { formatPrice, formatPct, signalLabel, signalBg } from '@/lib/utils';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1A2940] ${className}`} />;
}

const PERKS = [
  'AI predictions: 24h, 7d, 30d, 90d',
  'Bullish / Neutral / Bearish price targets',
  'Key risks & opportunities',
  'Real-time price alerts',
];

export default function CoinPage() {
  const { coinId = 'bitcoin' } = useParams();

  const { data: coin, isLoading } = useQuery({
    queryKey: ['coin-public', coinId],
    queryFn: () => marketApi.getCoin(coinId),
    staleTime: 60_000,
    retry: 1,
  });

  const positive = (coin?.price_change_percentage_24h ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-[#050A14] flex flex-col">
      {/* ── Minimal nav ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-[#1E3050]">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
            P
          </div>
          <span className="text-base font-bold text-slate-100">PredX</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors px-3 py-1"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="text-sm font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-colors px-4 py-1.5 rounded-xl"
          >
            Sign up free
          </Link>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-4 py-10 max-w-lg mx-auto w-full">

        {/* Coin card */}
        <div className="w-full bg-[#0D1526] border border-[#1E3050] rounded-2xl p-6 mb-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-14 h-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-7 w-28 ml-auto" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              </div>
            </div>
          ) : coin ? (
            <>
              <div className="flex items-center gap-4 mb-5">
                <img
                  src={coin.image}
                  alt={coin.name}
                  className="w-14 h-14 rounded-full border border-white/10 bg-slate-900 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-slate-50 truncate">{coin.name}</h1>
                  <p className="text-sm uppercase tracking-widest text-slate-500">{coin.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold text-slate-50">
                    {formatPrice(coin.current_price)}
                  </p>
                  <div
                    className={`flex items-center justify-end gap-1 text-sm font-semibold mt-0.5 ${
                      positive ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {formatPct(coin.price_change_percentage_24h ?? 0)} (24h)
                  </div>
                </div>
              </div>

              {/* Signal teaser — intentionally vague to drive curiosity */}
              <div className="bg-[#08111F] border border-[#1E3050] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={15} className="text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    PredX AI Forecast · 7-Day
                  </span>
                </div>

                {/* Signal badge — shown, price target locked */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">AI Signal</p>
                    {/* We show a plausible-looking locked signal */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border ${signalBg('buy')}`}>
                      <span>Signal available</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1.5">Price Target</p>
                    <div className="flex items-center gap-1.5 bg-[#0D1526] border border-dashed border-[#223556] rounded-lg px-3 py-1.5">
                      <Lock size={13} className="text-cyan-400" />
                      <span className="text-sm font-semibold text-slate-400">Unlock in app</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm text-center py-6">Coin not found.</p>
          )}
        </div>

        {/* CTA card */}
        <div className="w-full bg-gradient-to-b from-cyan-500/10 to-[#0D1526] border border-cyan-500/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-cyan-400" />
            <span className="text-base font-bold text-slate-100">See the full AI prediction</span>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Sign up free and get instant access to {coin?.name ?? 'this coin'}'s full AI forecast —
            price targets, scenarios, risks, and sentiment.
          </p>

          <ul className="space-y-2 mb-5">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle size={13} className="text-cyan-400 flex-shrink-0" />
                {perk}
              </li>
            ))}
          </ul>

          <Link
            to={`/signup?coin=${coinId}`}
            className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl font-bold text-sm transition-colors"
          >
            Sign up free — it takes 30 seconds
            <ArrowRight size={15} />
          </Link>

          <p className="mt-3 text-center text-xs text-slate-500">
            No credit card needed · Free plan forever
          </p>
        </div>

        {/* Already have an account */}
        <p className="text-sm text-slate-500">
          Already have an account?{' '}
          <Link to={`/login?redirect=/coin/${coinId}`} className="text-cyan-400 hover:text-cyan-300 font-medium">
            Log in to see the full prediction
          </Link>
        </p>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="text-center text-xs text-slate-600 py-6 border-t border-[#1E3050]">
        PredX · AI-powered crypto predictions · Not financial advice
      </footer>
    </div>
  );
}
