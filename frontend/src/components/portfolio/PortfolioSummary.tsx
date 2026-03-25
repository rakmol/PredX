import type { PortfolioSummaryData } from '@/types';
import { formatUSD, formatPct } from '@/utils/formatCurrency';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Card from '@/components/ui/Card';

interface PortfolioSummaryProps {
  summary: PortfolioSummaryData;
}

export default function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  const positive = summary.total_pnl >= 0;

  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500 font-medium mb-1">Total Portfolio Value</p>
      <p className="text-3xl font-bold text-slate-100 font-mono">
        {formatUSD(summary.total_value_usd)}
      </p>
      <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
        {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {formatUSD(Math.abs(summary.total_pnl))} ({formatPct(summary.total_pnl_pct)})
      </div>
    </Card>
  );
}
