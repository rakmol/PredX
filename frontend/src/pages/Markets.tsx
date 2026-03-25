// Markets page — top coins list with USD + GHS prices

import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Brain } from 'lucide-react';
import { formatPct, formatLargeNumber } from '@/lib/utils';
import { formatUSD, formatGHS } from '@/utils/formatCurrency';
import SparklineChart from '@/components/charts/SparklineChart';
import FearGreedGauge from '@/components/ui/FearGreedGauge';
import { useTopCoins, useFearGreed } from '@/hooks/useCoins';

export default function Markets() {
  const { data: coins, isLoading } = useTopCoins(50);
  const { data: fearGreed } = useFearGreed();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Crypto Markets</h1>
          <p className="text-sm text-slate-400 mt-0.5">Top 50 cryptocurrencies by market cap</p>
        </div>

        {fearGreed && (
          <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-3">
            <FearGreedGauge value={fearGreed.value} label={fearGreed.label} size="sm" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[2rem_1fr_repeat(2,minmax(0,1fr))_minmax(0,1fr)_5rem_6rem] gap-4 px-4 py-3 border-b border-[#1E3050] text-xs text-slate-500 font-medium uppercase tracking-wide">
          <span>#</span>
          <span>Coin</span>
          <span className="text-right">USD Price</span>
          <span className="text-right">GHS Price</span>
          <span className="hidden lg:block text-right">Market Cap</span>
          <span className="hidden md:block text-right">7d Chart</span>
          <span className="text-right">Action</span>
        </div>

        {/* Skeleton */}
        {isLoading && (
          <div className="space-y-px">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-white/[0.02] animate-pulse"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        )}

        {/* Rows */}
        {coins?.map((coin) => {
          const positive = (coin.price_change_percentage_24h ?? 0) >= 0;

          return (
            <div
              key={coin.id}
              className="grid grid-cols-[2rem_1fr_repeat(2,minmax(0,1fr))_minmax(0,1fr)_5rem_6rem] gap-4 px-4 py-3 border-b border-[#1E3050]/50 hover:bg-white/[0.02] transition-colors items-center"
            >
              {/* Rank */}
              <span className="text-slate-500 text-sm">{coin.market_cap_rank}</span>

              {/* Coin info */}
              <div className="flex items-center gap-2 min-w-0">
                <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{coin.name}</p>
                  <p className="text-xs text-slate-500 uppercase">{coin.symbol}</p>
                </div>
              </div>

              {/* USD price + 24h */}
              <div className="text-right">
                <p className="text-sm font-medium text-slate-100 font-mono">
                  {formatUSD(coin.current_price)}
                </p>
                <span className={`text-xs flex items-center justify-end gap-0.5 mt-0.5 ${positive ? 'text-green-400' : 'text-red-400'}`}>
                  {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {formatPct(coin.price_change_percentage_24h ?? 0)}
                </span>
              </div>

              {/* GHS price */}
              <div className="text-right">
                <p className="text-sm font-medium text-slate-400 font-mono">
                  {formatGHS(coin.current_price_ghs ?? coin.current_price * 15.5)}
                </p>
              </div>

              {/* Market cap */}
              <div className="hidden lg:block text-right text-sm text-slate-400">
                {formatLargeNumber(coin.market_cap)}
              </div>

              {/* Sparkline */}
              <div className="hidden md:block h-12">
                {coin.sparkline_in_7d?.price && (
                  <SparklineChart data={coin.sparkline_in_7d.price} positive={positive} />
                )}
              </div>

              {/* Action */}
              <div className="flex justify-end">
                <Link
                  to={`/predict/${coin.id}`}
                  className="flex items-center gap-1.5 text-xs bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Brain size={12} />
                  Predict
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 mt-4 text-xs text-slate-500">
        <div className="w-1.5 h-1.5 bg-green-400 rounded-full live-dot" />
        Prices refresh every 60s · CoinGecko · All prices in USD and GHS
      </div>
    </div>
  );
}
