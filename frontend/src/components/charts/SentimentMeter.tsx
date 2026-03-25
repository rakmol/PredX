import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { SentimentData } from '@/types';

interface SentimentMeterProps {
  score?: number;
  label?: string;
  previousScore?: number;
  sentiment?: SentimentData;
  summary?: string;
}

const SEGMENTS = [
  { value: 25, color: '#EF4444', label: 'Extreme Fear' },
  { value: 20, color: '#F97316', label: 'Fear' },
  { value: 10, color: '#9CA3AF', label: 'Neutral' },
  { value: 20, color: '#84CC16', label: 'Greed' },
  { value: 25, color: '#22C55E', label: 'Extreme Greed' },
];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function needleAngle(score: number) {
  return 180 - (score / 100) * 180;
}

function resolveTrend(current: number, previous?: number) {
  if (previous === undefined) return { icon: ArrowRight, label: 'Flat', className: 'text-slate-300' };
  const delta = current - previous;
  if (delta > 2) return { icon: ArrowUpRight, label: 'Up', className: 'text-green-300' };
  if (delta < -2) return { icon: ArrowDownRight, label: 'Down', className: 'text-red-300' };
  return { icon: ArrowRight, label: 'Flat', className: 'text-slate-300' };
}

function resolveLabel(score: number, explicitLabel?: string) {
  if (explicitLabel) return explicitLabel;
  if (score <= 25) return 'Extreme Fear';
  if (score <= 45) return 'Fear';
  if (score <= 55) return 'Neutral';
  if (score <= 75) return 'Greed';
  return 'Extreme Greed';
}

export default function SentimentMeter({ score, label, previousScore, sentiment, summary }: SentimentMeterProps) {
  const resolvedScore = clampScore(score ?? sentiment?.fear_greed_index ?? 50);
  const resolvedLabel = resolveLabel(resolvedScore, label ?? sentiment?.fear_greed_label);
  const resolvedSummary = summary ?? sentiment?.sentiment_summary;
  const trend = resolveTrend(resolvedScore, previousScore);
  const TrendIcon = trend.icon;
  const angle = needleAngle(resolvedScore);
  const radians = (Math.PI / 180) * angle;
  const centerX = 150;
  const centerY = 120;
  const needleLength = 72;
  const needleX = centerX + needleLength * Math.cos(radians);
  const needleY = centerY - needleLength * Math.sin(radians);

  return (
    <div className="rounded-2xl border border-[#1E3050] bg-[#08111F] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Sentiment Meter</h3>
          <p className="mt-1 text-xs text-slate-400">Fear & greed gauge with a 7-day trend indicator.</p>
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs ${trend.className}`}>
          <TrendIcon size={12} />
          7d {trend.label}
        </div>
      </div>

      <div className="relative mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={SEGMENTS}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              innerRadius={68}
              outerRadius={92}
              paddingAngle={1}
              stroke="none"
            >
              {SEGMENTS.map((segment) => (
                <Cell key={segment.label} fill={segment.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 180">
          <line x1={centerX} y1={centerY} x2={needleX} y2={needleY} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          <circle cx={centerX} cy={centerY} r="7" fill="#E2E8F0" />
        </svg>

        <div className="absolute inset-x-0 bottom-5 text-center">
          <p className="text-4xl font-semibold text-slate-50">{resolvedScore}</p>
          <p className="mt-1 text-sm text-slate-300">{resolvedLabel}</p>
        </div>
      </div>

      {resolvedSummary && <p className="text-sm leading-6 text-slate-400">{resolvedSummary}</p>}
    </div>
  );
}
