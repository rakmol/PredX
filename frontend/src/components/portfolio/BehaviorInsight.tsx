import type { BehaviorInsightData } from '@/types';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BehaviorInsightProps {
  insight: BehaviorInsightData;
}

const icons = {
  positive: CheckCircle,
  warning:  AlertTriangle,
  neutral:  Info,
};

const colors = {
  positive: 'text-green-400 bg-green-500/10 border-green-500/30',
  warning:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  neutral:  'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export default function BehaviorInsight({ insight }: BehaviorInsightProps) {
  const Icon = icons[insight.severity];

  return (
    <div className={cn('rounded-xl border p-4', colors[insight.severity])}>
      <div className="flex items-start gap-3">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">{insight.pattern}</p>
          <p className="text-xs mt-1 opacity-80">{insight.description}</p>
          <p className="text-xs mt-2 font-medium opacity-90">💡 {insight.recommendation}</p>
        </div>
      </div>
    </div>
  );
}
