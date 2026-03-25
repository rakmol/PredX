// Portfolio page — placeholder with coming soon exchange connection

import { BarChart2, Link as LinkIcon, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Portfolio() {
  const exchanges = [
    { name: 'Binance', logo: '🟡', status: 'coming_soon' },
    { name: 'Bybit', logo: '🟠', status: 'coming_soon' },
    { name: 'KuCoin', logo: '🟢', status: 'coming_soon' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart2 size={22} className="text-brand" /> Portfolio Tracker
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect your exchange accounts for AI coaching on your trading behavior
        </p>
      </div>

      {/* Exchange connections */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Connect Exchange (Read-Only)</h2>
        {exchanges.map(ex => (
          <div
            key={ex.name}
            className="flex items-center gap-4 bg-[#0D1526] border border-[#1E3050] rounded-xl px-4 py-4"
          >
            <span className="text-2xl">{ex.logo}</span>
            <div className="flex-1">
              <p className="font-medium text-slate-200">{ex.name}</p>
              <p className="text-xs text-slate-500">Read-only API key — no trading permissions</p>
            </div>
            <span className="text-xs text-slate-500 border border-[#1E3050] rounded-full px-2.5 py-1">
              Coming Soon
            </span>
          </div>
        ))}
      </div>

      {/* Teaser */}
      <div className="bg-gradient-to-br from-brand/10 to-purple-500/10 border border-brand/20 rounded-xl p-6 text-center">
        <LinkIcon size={32} className="text-brand mx-auto mb-3" />
        <h3 className="font-semibold text-slate-200 mb-2">Exchange Integration Coming Soon</h3>
        <p className="text-sm text-slate-400 mb-4 max-w-sm mx-auto">
          Connect Binance, Bybit, or KuCoin and PredX will analyze your actual trading patterns,
          identify behavioral biases, and coach you to trade better.
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs text-left max-w-xs mx-auto mb-4">
          {[
            'Trade history analysis',
            'Win/loss pattern detection',
            'Emotional trading alerts',
            'AI coaching sessions',
            'Portfolio performance',
            'Risk exposure scoring',
          ].map(f => (
            <div key={f} className="flex items-center gap-1.5 text-slate-300">
              <Zap size={10} className="text-brand flex-shrink-0" /> {f}
            </div>
          ))}
        </div>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand/90 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <Zap size={14} /> Get Early Access with Pro
        </Link>
      </div>
    </div>
  );
}
