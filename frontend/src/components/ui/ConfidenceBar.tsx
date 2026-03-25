// Confidence score bar
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface SignalAgreement {
  bullish_count: number;
  bearish_count: number;
  total: number;
  direction: 'bullish' | 'bearish' | 'neutral';
}

interface Props {
  value: number; // 0-100
  label?: string;
  signalAgreement?: SignalAgreement;
}

function getConfidenceLabel(value: number): { text: string; color: string; pulse: boolean } {
  if (value >= 91) return { text: 'Very High', color: '#00FF88', pulse: true };
  if (value >= 81) return { text: 'High', color: '#22C55E', pulse: false };
  if (value >= 71) return { text: 'Good', color: '#4ADE80', pulse: false };
  if (value >= 65) return { text: 'Moderate', color: '#EAB308', pulse: false };
  return { text: 'Low', color: '#EF4444', pulse: false };
}

export default function ConfidenceBar({ value, label = 'Confidence', signalAgreement }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { text: confidenceText, color, pulse } = getConfidenceLabel(value);
  const isMainConfidence = label === 'Confidence';

  const bullishCount = signalAgreement?.bullish_count ?? 0;
  const bearishCount = signalAgreement?.bearish_count ?? 0;
  const total = signalAgreement?.total ?? 0;
  const neutralCount = total - bullishCount - bearishCount;
  const dir = signalAgreement?.direction ?? 'neutral';
  const majorCount = dir === 'bullish' ? bullishCount : dir === 'bearish' ? bearishCount : total;
  const dirLabel = dir === 'bullish' ? 'bullish' : dir === 'bearish' ? 'bearish' : 'mixed';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1">
          <span className="text-slate-400">{label}</span>
          {isMainConfidence && (
            <div className="relative">
              <HelpCircle
                size={11}
                className="text-slate-500 cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(v => !v)}
              />
              {showTooltip && (
                <div className="absolute left-0 bottom-5 z-50 w-56 rounded-lg bg-[#1E3050] border border-slate-700 p-2.5 text-slate-300 text-xs shadow-xl">
                  This score is based on 5 technical indicators, market sentiment, and price momentum all analyzed together by PredX AI
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isMainConfidence && (
            <span className="text-slate-400 text-[10px]">{confidenceText}</span>
          )}
          <span className={`font-medium${pulse ? ' animate-pulse' : ''}`} style={{ color }}>{value}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#1E3050] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      {signalAgreement && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="flex gap-0.5">
            {Array.from({ length: bullishCount }).map((_, i) => (
              <span key={`b-${i}`} className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            ))}
            {Array.from({ length: neutralCount }).map((_, i) => (
              <span key={`n-${i}`} className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
            ))}
            {Array.from({ length: bearishCount }).map((_, i) => (
              <span key={`r-${i}`} className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            ))}
          </div>
          <span className="text-[10px] text-slate-400">{majorCount}/{total} signals {dirLabel}</span>
        </div>
      )}
    </div>
  );
}
