// TechnicalBreakdown — structured card showing every signal with a plain-English explanation

import type { TechnicalIndicators } from '@/types';

interface Props {
  technicals: TechnicalIndicators;
}

type BadgeVariant = 'BUY' | 'SELL' | 'WATCH' | 'NEUTRAL';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  BUY:     'bg-green-500/20 text-green-400 border border-green-500/30',
  SELL:    'bg-red-500/20 text-red-400 border border-red-500/30',
  WATCH:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  NEUTRAL: 'bg-slate-700/40 text-slate-400 border border-slate-600/30',
};

function Badge({ variant }: { variant: BadgeVariant }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_STYLES[variant]}`}>
      {variant}
    </span>
  );
}

function Row({
  name,
  value,
  badge,
  explanation,
}: {
  name: string;
  value: string;
  badge: BadgeVariant;
  explanation: string;
}) {
  return (
    <div className="py-3 border-b border-[#1A2940] last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-200">{name}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono text-sm text-slate-300">{value}</span>
          <Badge variant={badge} />
        </div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{explanation}</p>
    </div>
  );
}

function getRSIExplanation(rsi: number, signal: string): string {
  if (signal === 'oversold')
    return `RSI is at ${rsi.toFixed(1)} — the price has dropped fast recently, meaning a bounce back up is likely soon.`;
  if (signal === 'overbought')
    return `RSI is at ${rsi.toFixed(1)} — the price has risen very fast and may need to slow down before going higher.`;
  return `RSI is at ${rsi.toFixed(1)} — momentum is balanced, with no strong push up or down right now.`;
}

function getRSIBadge(signal: string): BadgeVariant {
  if (signal === 'oversold') return 'BUY';
  if (signal === 'overbought') return 'SELL';
  return 'NEUTRAL';
}

function getMACDExplanation(trend: string, histogram: number): string {
  if (trend === 'bullish')
    return `MACD is showing a bullish crossover (histogram: ${histogram.toFixed(4)}) — more people are choosing to buy than sell right now, and buying pressure is building.`;
  if (trend === 'bearish')
    return `MACD is showing a bearish crossover (histogram: ${histogram.toFixed(4)}) — selling pressure is taking over and more people are exiting than entering.`;
  return `MACD is neutral (histogram: ${histogram.toFixed(4)}) — buyers and sellers are evenly matched, so no clear direction yet.`;
}

function getMACDBadge(trend: string): BadgeVariant {
  if (trend === 'bullish') return 'BUY';
  if (trend === 'bearish') return 'SELL';
  return 'NEUTRAL';
}

function getMAExplanation(trend: string): string {
  if (trend.includes('bull'))
    return 'Moving averages are aligned upward — short-term price is above the long-term average, which means the overall trend is heading higher.';
  if (trend.includes('bear'))
    return 'Moving averages are aligned downward — short-term price is below the long-term average, which means the overall trend is pointing lower.';
  return 'Moving averages are mixed — price is crossing its averages sideways, meaning no clear trend direction has formed yet.';
}

function getMABadge(trend: string): BadgeVariant {
  if (trend.includes('bull')) return 'BUY';
  if (trend.includes('bear')) return 'SELL';
  return 'NEUTRAL';
}

function getBollingerExplanation(position: string, bandwidth: number): string {
  if (bandwidth < 0.04)
    return 'Bollinger Bands are squeezing tight — the price has been unusually calm, which often means a big move in either direction is coming soon.';
  if (position === 'above_upper' || position === 'near_upper')
    return 'Price is near the upper Bollinger Band — the coin is trading at the high end of its recent range and may be due for a pullback.';
  if (position === 'below_lower' || position === 'near_lower')
    return 'Price is near the lower Bollinger Band — the coin is trading at the low end of its recent range and a recovery bounce is possible.';
  return 'Price is inside the Bollinger Bands — the coin is trading in a normal range with no extreme overbought or oversold signals.';
}

function getBollingerBadge(position: string, bandwidth: number): BadgeVariant {
  if (bandwidth < 0.04) return 'WATCH';
  if (position === 'above_upper' || position === 'near_upper') return 'SELL';
  if (position === 'below_lower' || position === 'near_lower') return 'BUY';
  return 'NEUTRAL';
}

function getVolumeExplanation(trend: string): string {
  if (trend === 'increasing')
    return 'Trading volume is rising — more people are actively buying and selling, which adds strength and conviction to the current price move.';
  if (trend === 'decreasing')
    return 'Trading volume is falling — fewer people are actively trading, which means the current price move has less support behind it.';
  return 'Trading volume is stable — participation is normal, meaning neither side has a strong conviction advantage right now.';
}

function getVolumeBadge(trend: string): BadgeVariant {
  if (trend === 'increasing') return 'BUY';
  if (trend === 'decreasing') return 'SELL';
  return 'NEUTRAL';
}

export default function TechnicalBreakdown({ technicals }: Props) {
  const { rsi, rsi_signal, macd, moving_averages, bollinger, volume_trend } = technicals;
  const maTrend = moving_averages.trend ?? 'neutral';

  return (
    <div className="rounded-xl border border-[#1E3050] bg-[#060F1C] p-4">
      <Row
        name="RSI (Relative Strength Index)"
        value={rsi.toFixed(1)}
        badge={getRSIBadge(rsi_signal)}
        explanation={getRSIExplanation(rsi, rsi_signal)}
      />
      <Row
        name="MACD"
        value={macd.trend.charAt(0).toUpperCase() + macd.trend.slice(1)}
        badge={getMACDBadge(macd.trend)}
        explanation={getMACDExplanation(macd.trend, macd.histogram)}
      />
      <Row
        name="Moving Averages"
        value={maTrend.replace('_', ' ')}
        badge={getMABadge(maTrend)}
        explanation={getMAExplanation(maTrend)}
      />
      <Row
        name="Bollinger Bands"
        value={bollinger.position.replace(/_/g, ' ')}
        badge={getBollingerBadge(bollinger.position, bollinger.bandwidth)}
        explanation={getBollingerExplanation(bollinger.position, bollinger.bandwidth)}
      />
      <Row
        name="Volume Trend"
        value={volume_trend.charAt(0).toUpperCase() + volume_trend.slice(1)}
        badge={getVolumeBadge(volume_trend)}
        explanation={getVolumeExplanation(volume_trend)}
      />
    </div>
  );
}
