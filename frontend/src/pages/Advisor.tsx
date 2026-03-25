// AI Investment Advisor page
// User enters amount + coin, gets allocation advice with 3 scenarios

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Zap } from 'lucide-react';
import { marketApi, predictionApi } from '@/lib/api';
import { formatPrice, formatGHS, formatPct } from '@/lib/utils';
import ConfidenceBar from '@/components/ui/ConfidenceBar';
import type { Currency, Horizon, InvestmentAdvice, PredictionResult } from '@/types';

export default function Advisor() {
  const [coinId, setCoinId] = useState('bitcoin');
  const [coinSearch, setCoinSearch] = useState('Bitcoin');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('GHS');
  const [horizon, setHorizon] = useState<Horizon>('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ advice: InvestmentAdvice; prediction: PredictionResult } | null>(null);
  const [error, setError] = useState('');

  const { data: searchResults } = useQuery({
    queryKey: ['search', coinSearch],
    queryFn: () => marketApi.search(coinSearch),
    enabled: coinSearch.length >= 2,
    staleTime: 30_000,
  });

  const handleGenerate = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Please enter a valid amount'); return; }
    setError('');
    setIsLoading(true);
    try {
      const data = await predictionApi.getInvestmentAdvice(coinId, amt, currency, horizon);
      setResult(data);
    } catch {
      setError('Failed to generate advice. You may need to sign in or upgrade to Pro.');
    } finally {
      setIsLoading(false);
    }
  };

  const riskColor = {
    low: 'text-green-400 bg-green-500/10 border-green-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    very_high: 'text-red-400 bg-red-500/10 border-red-500/30',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Brain size={24} className="text-brand" /> AI Investment Advisor
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Enter your investment amount and get AI-powered allocation advice with 3 scenarios
        </p>
      </div>

      {/* Input form */}
      <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5 space-y-4">
        {/* Coin selector */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Coin</label>
          <div className="relative">
            <input
              value={coinSearch}
              onChange={e => setCoinSearch(e.target.value)}
              placeholder="Search coin..."
              className="w-full bg-[#111E35] border border-[#1E3050] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand"
            />
            {searchResults && searchResults.length > 0 && coinSearch && (
              <div className="absolute top-full mt-1 w-full bg-[#0D1526] border border-[#1E3050] rounded-lg overflow-hidden shadow-xl z-50">
                {searchResults.slice(0, 6).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCoinId(c.id); setCoinSearch(c.name); }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 text-left transition-colors"
                  >
                    <img src={c.thumb} alt={c.name} className="w-5 h-5 rounded-full" />
                    <span className="text-sm text-slate-200">{c.name}</span>
                    <span className="text-xs text-slate-500 uppercase ml-auto">{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount + currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full bg-[#111E35] border border-[#1E3050] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Currency</label>
            <div className="flex bg-[#111E35] border border-[#1E3050] rounded-lg overflow-hidden">
              {(['GHS', 'USD'] as Currency[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    currency === c ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c === 'GHS' ? '₵ GHS' : '$ USD'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horizon */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Time Horizon</label>
          <div className="grid grid-cols-4 gap-2">
            {(['24h', '7d', '30d', '90d'] as Horizon[]).map(h => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`py-2 text-sm rounded-lg font-medium transition-colors ${
                  horizon === h ? 'bg-brand text-white' : 'bg-[#111E35] border border-[#1E3050] text-slate-400 hover:text-slate-200'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-60 text-white py-3 rounded-xl font-medium transition-colors"
        >
          {isLoading ? (
            <><Zap size={16} className="animate-pulse" /> Generating AI Advice...</>
          ) : (
            <><Brain size={16} /> Generate Investment Advice</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Allocation summary */}
          <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Recommended Allocation</p>
                <p className="text-4xl font-bold text-brand">{result.advice.recommended_allocation}%</p>
                <p className="text-sm text-slate-400 mt-1">of your {currency === 'GHS' ? formatGHS(result.advice.input_amount) : formatPrice(result.advice.input_amount, 'USD')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">
                  {result.advice.coin_symbol} price
                </p>
                <p className="font-mono text-slate-200">
                  {currency === 'GHS'
                    ? formatGHS(result.advice.price_in_currency)
                    : formatPrice(result.advice.current_price)}
                </p>
                <span className={`text-xs font-medium px-2 py-0.5 border rounded-full mt-1 inline-block ${riskColor[result.advice.risk_level]}`}>
                  {result.advice.risk_level.replace('_', ' ')} risk
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-3">{result.advice.allocation_rationale}</p>
            <div className="flex gap-4 text-xs">
              <div>
                <p className="text-slate-500">Stop Loss</p>
                <p className="text-red-400 font-mono font-medium">{formatPrice(result.advice.stop_loss)}</p>
              </div>
              <div>
                <p className="text-slate-500">Take Profit</p>
                <p className="text-green-400 font-mono font-medium">{formatPrice(result.advice.take_profit)}</p>
              </div>
              <div>
                <p className="text-slate-500">Hold Period</p>
                <p className="text-slate-200 font-medium">{result.advice.time_horizon}</p>
              </div>
            </div>
          </div>

          {/* 3 Scenarios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['bullish', 'neutral', 'bearish'] as const).map(scenario => {
              const s = result.advice.scenarios[scenario];
              const positive = s.profit_loss_pct >= 0;
              const colors = {
                bullish: 'border-green-500/30 bg-green-500/5',
                neutral: 'border-yellow-500/30 bg-yellow-500/5',
                bearish: 'border-red-500/30 bg-red-500/5',
              }[scenario];

              return (
                <div key={scenario} className={`border rounded-xl p-4 ${colors}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{scenario}</p>
                  <p className="text-xs text-slate-500">Target Price</p>
                  <p className="font-mono font-bold text-slate-200">{formatPrice(s.price_target)}</p>
                  <p className="text-xs text-slate-500 mt-2">Portfolio Value</p>
                  <p className="font-semibold text-slate-100">
                    {currency === 'GHS' ? formatGHS(s.portfolio_value) : formatPrice(s.portfolio_value, 'USD')}
                  </p>
                  <p className={`text-sm font-bold flex items-center gap-1 mt-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
                    {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatPct(s.profit_loss_pct)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* AI reasoning */}
          <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={16} className="text-brand" />
              <h3 className="font-semibold text-slate-200">AI Reasoning</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{result.advice.ai_reasoning}</p>
          </div>

          {/* Signal from prediction */}
          <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <DollarSign size={14} />
                Overall Market Signal for {result.prediction.coin_symbol}
              </div>
              <ConfidenceBar value={result.prediction.confidence_score} />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-2 text-xs text-slate-500 bg-[#111E35] border border-[#1E3050] rounded-lg p-3">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <p>
              This is AI-generated analysis for educational purposes only. Cryptocurrency investments are highly volatile.
              Never invest more than you can afford to lose. PredX is not a financial advisor.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

