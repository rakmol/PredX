import type { Trade } from '@/types';
import { formatUSD } from '@/utils/formatCurrency';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface TradeCardProps {
  trade: Trade;
}

export default function TradeCard({ trade }: TradeCardProps) {
  const isBuy = trade.side === 'buy';

  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1E3050]/60 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {isBuy ? <ArrowDownLeft size={14} className="text-green-400" /> : <ArrowUpRight size={14} className="text-red-400" />}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">
            {isBuy ? 'Buy' : 'Sell'} {trade.symbol}
          </p>
          <p className="text-xs text-slate-500">
            {trade.quantity} @ {formatUSD(trade.price)} · {trade.exchange}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${isBuy ? 'text-red-400' : 'text-green-400'}`}>
          {isBuy ? '-' : '+'}{formatUSD(trade.total)}
        </p>
        <p className="text-xs text-slate-500">{format(new Date(trade.timestamp), 'MMM d, HH:mm')}</p>
      </div>
    </div>
  );
}
