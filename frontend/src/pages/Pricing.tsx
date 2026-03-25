// Pricing page — Freemium model

import { Check, X, Zap } from 'lucide-react';

const FREE_FEATURES = [
  { text: 'View top 50 coins & prices', included: true },
  { text: 'Basic technical indicators', included: true },
  { text: 'Fear & Greed Index', included: true },
  { text: 'AI signal (buy/sell/hold)', included: true },
  { text: '2 price alerts', included: true },
  { text: 'Full price targets (blurred)', included: false },
  { text: 'AI detailed analysis', included: false },
  { text: 'Investment advisor', included: false },
  { text: 'Unlimited alerts', included: false },
  { text: 'All 4 time horizons', included: false },
];

const PRO_FEATURES = [
  { text: 'Everything in Free', included: true },
  { text: 'Full price targets (3 scenarios)', included: true },
  { text: 'AI detailed analysis & reasoning', included: true },
  { text: 'AI Investment Advisor (GHS & USD)', included: true },
  { text: 'Unlimited price alerts', included: true },
  { text: 'All 4 time horizons (24h/7d/30d/90d)', included: true },
  { text: 'Portfolio AI coaching', included: true },
  { text: 'Exchange account analysis', included: true },
  { text: 'Up to 2 devices', included: true },
  { text: 'Priority prediction queue', included: true },
];

export default function Pricing() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 pb-20 md:pb-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-100 mb-3">
          Simple, Transparent Pricing
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Start free. Upgrade when you're ready for AI-powered price targets and full investment analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Free */}
        <div className="bg-[#0D1526] border border-[#1E3050] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-1">Free</h2>
          <p className="text-slate-500 text-sm mb-4">Get started with the basics</p>
          <div className="mb-6">
            <span className="text-4xl font-bold text-slate-100">$0</span>
            <span className="text-slate-500 text-sm"> / forever</span>
          </div>
          <button className="w-full py-2.5 border border-[#1E3050] text-slate-400 rounded-xl text-sm font-medium mb-6 cursor-default">
            Current Plan
          </button>
          <ul className="space-y-3">
            {FREE_FEATURES.map(f => (
              <li key={f.text} className="flex items-center gap-2.5 text-sm">
                {f.included
                  ? <Check size={15} className="text-green-400 flex-shrink-0" />
                  : <X size={15} className="text-slate-600 flex-shrink-0" />}
                <span className={f.included ? 'text-slate-300' : 'text-slate-600'}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="bg-gradient-to-b from-brand/10 to-[#0D1526] border border-brand/40 rounded-2xl p-6 relative overflow-hidden glow-blue">
          <div className="absolute top-4 right-4 bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">
            MOST POPULAR
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">Pro</h2>
          <p className="text-slate-400 text-sm mb-4">Full AI prediction power</p>
          <div className="mb-2">
            <span className="text-4xl font-bold text-white">$9.99</span>
            <span className="text-slate-400 text-sm"> / month</span>
          </div>
          <p className="text-xs text-slate-500 mb-6">≈ GHS 155 / month · via Paystack or Stripe</p>

          <button className="w-full py-2.5 bg-brand hover:bg-brand/90 text-white rounded-xl text-sm font-bold mb-6 transition-colors flex items-center justify-center gap-2">
            <Zap size={16} /> Upgrade to Pro
          </button>

          <ul className="space-y-3">
            {PRO_FEATURES.map(f => (
              <li key={f.text} className="flex items-center gap-2.5 text-sm">
                <Check size={15} className="text-brand flex-shrink-0" />
                <span className="text-slate-200">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Anti-piracy note */}
      <div className="mt-8 text-center text-xs text-slate-600 max-w-md mx-auto">
        All predictions include your username watermark. Predictions expire after their time window.
        Accounts limited to 2 devices. Sharing screenshots is encouraged — they drive downloads.
      </div>
    </div>
  );
}
