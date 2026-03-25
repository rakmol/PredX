// FuturesSignalPanel — TradingView-style futures signal display
import type { FuturesSignal } from '@/types';
import { formatUSD } from '@/utils/formatCurrency';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Shield } from 'lucide-react';

interface Props {
  signal: FuturesSignal;
  coinSymbol: string;
}

const STRENGTH_COLOR = {
  strong:   'text-emerald-400',
  moderate: 'text-amber-400',
  weak:     'text-slate-400',
} as const;

const STRENGTH_LABEL = {
  strong:   'Strong',
  moderate: 'Moderate',
  weak:     'Weak',
} as const;

export default function FuturesSignalPanel({ signal, coinSymbol }: Props) {
  const isLong    = signal.direction === 'long';
  const isShort   = signal.direction === 'short';
  const isNeutral = signal.direction === 'neutral';

  const directionBg    = isLong ? 'bg-emerald-500/10 border-emerald-500/30' : isShort ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-700/20 border-slate-600/30';
  const directionColor = isLong ? 'text-emerald-400' : isShort ? 'text-red-400' : 'text-slate-400';
  const DirectionIcon  = isLong ? TrendingUp : isShort ? TrendingDown : Minus;

  return (
    <div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <Target size={15} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Futures Signal</p>
            <p className="text-xs text-slate-500">{coinSymbol} · Perpetual / Futures</p>
          </div>
        </div>
        <span className={`text-xs font-semibold ${STRENGTH_COLOR[signal.signal_strength]}`}>
          {STRENGTH_LABEL[signal.signal_strength]} signal
        </span>
      </div>

      {/* Direction badge */}
      <div className={`flex items-center justify-between rounded-xl border p-4 ${directionBg}`}>
        <div className="flex items-center gap-3">
          <DirectionIcon size={22} className={directionColor} />
          <div>
            <p className={`text-xl font-extrabold ${directionColor}`}>
              {isNeutral ? 'NEUTRAL' : `${signal.direction.toUpperCase()} ${signal.leverage}×`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{signal.confidence}% confidence</p>
          </div>
        </div>
        {!isNeutral && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Risk / Reward</p>
            <p className={`text-lg font-bold ${signal.risk_reward >= 2 ? 'text-emerald-400' : signal.risk_reward >= 1.5 ? 'text-amber-400' : 'text-red-400'}`}>
              1 : {signal.risk_reward}
            </p>
          </div>
        )}
      </div>

      {/* Entry / SL / TP grid */}
      {!isNeutral && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#1E3050] bg-[#080f1e] px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Entry Zone</p>
            <p className="mt-1 text-xs font-semibold text-slate-300">
              {formatUSD(signal.entry_zone.low)}
            </p>
            <p className="text-[10px] text-slate-600">– {formatUSD(signal.entry_zone.high)}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-red-500/70">Stop Loss</p>
            <p className="mt-1 text-xs font-bold text-red-400">{formatUSD(signal.stop_loss)}</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Shield size={9} className="text-red-500/60" />
              <p className="text-[10px] text-red-500/60">max {signal.max_drawdown_estimate}% loss</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-emerald-500/70">Take Profit</p>
            <p className="mt-1 text-xs font-bold text-emerald-400">{formatUSD(signal.take_profit)}</p>
            <p className="text-[10px] text-emerald-500/60 mt-0.5">target</p>
          </div>
        </div>
      )}

      {/* Position sizing */}
      {!isNeutral && (
        <div className="flex items-center justify-between rounded-xl border border-[#1E3050] bg-[#080f1e] px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Recommended position size</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">
              ~{signal.position_size_pct}% of capital
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Max drawdown</p>
            <p className={`text-sm font-bold mt-0.5 ${signal.max_drawdown_estimate > 20 ? 'text-red-400' : signal.max_drawdown_estimate > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {signal.max_drawdown_estimate}%
            </p>
          </div>
        </div>
      )}

      {/* Rationale */}
      <p className="text-xs leading-relaxed text-slate-400">{signal.rationale}</p>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2">
        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-amber-500/70" />
        <p className="text-[10px] leading-relaxed text-amber-500/70">
          Futures trading carries significant risk including total loss of margin. This signal is for educational purposes only. Always trade with money you can afford to lose.
        </p>
      </div>
    </div>
  );
}
