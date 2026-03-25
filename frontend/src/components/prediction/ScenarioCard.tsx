import type { PredictionScenario } from '@/types';
import { formatUSD } from '@/utils/formatCurrency';
import { cn } from '@/lib/utils';
import type { Horizon } from '@/types';

type ScenarioType = 'bullish' | 'neutral' | 'bearish';

interface ScenarioCardProps {
  type: ScenarioType;
  scenario: PredictionScenario;
  currentPrice: number;
  isBlurred?: boolean;
  horizon?: Horizon;
}

const config: Record<ScenarioType, { label: string; color: string; bg: string; border: string }> = {
  bullish: { label: 'Best Case',   color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  neutral: { label: 'Middle Case', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  bearish: { label: 'Worst Case',  color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30' },
};

const HORIZON_LABEL: Record<Horizon, string> = {
  '24h': '24 hours',
  '7d':  '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

function buildWhatThisMeans(type: ScenarioType, pct: number, horizon: Horizon): string {
  const period = HORIZON_LABEL[horizon];
  const absPct = Math.abs(pct).toFixed(1);
  if (type === 'bullish') {
    return `What this means for you: if you buy now and this scenario plays out, your investment could grow by ${absPct}% in ${period}.`;
  }
  if (type === 'neutral') {
    const dir = pct >= 0 ? `gain ${absPct}%` : `dip ${absPct}%`;
    return `What this means for you: in this scenario your investment would ${dir} over ${period} — a sideways or modest move.`;
  }
  return `What this means for you: in this scenario your investment could drop by ${absPct}% over ${period} — consider setting a stop-loss to protect yourself.`;
}

export default function ScenarioCard({ type, scenario, isBlurred, horizon = '7d' }: ScenarioCardProps) {
  const { label, color, bg, border } = config[type];
  const pct = scenario.percentage_change ?? 0;
  const technicalReasoning = scenario.key_factors[0] ?? null;

  return (
    <div className={cn('rounded-xl border p-4', bg, border, isBlurred && 'blur-locked')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn('text-sm font-semibold', color)}>{label}</span>
        <span className={cn('text-xs font-medium', color)}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </span>
      </div>

      {/* Price */}
      <p className={cn('text-2xl font-bold font-mono', color)}>
        {scenario.price_target ? formatUSD(scenario.price_target) : '—'}
      </p>

      {/* Technical reasoning line */}
      {technicalReasoning && (
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          {technicalReasoning}
        </p>
      )}

      {/* What this means for you */}
      <p className={cn('mt-3 text-xs leading-relaxed', color === 'text-red-400' ? 'text-red-300/70' : 'text-slate-300')}>
        {buildWhatThisMeans(type, pct, horizon)}
      </p>

      {/* Remaining key factors */}
      {scenario.key_factors.length > 1 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Other factors</p>
          {scenario.key_factors.slice(1, 3).map((f, i) => (
            <p key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
              <span className={cn('mt-0.5 flex-shrink-0', color)}>›</span>
              {f}
            </p>
          ))}
        </div>
      )}

      {/* Confidence bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Probability</span>
          <span>{scenario.confidence}%</span>
        </div>
        <div className="h-1 bg-[#0D1526] rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', color.replace('text-', 'bg-'))}
            style={{ width: `${scenario.confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}
