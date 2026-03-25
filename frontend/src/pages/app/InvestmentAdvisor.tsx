import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Brain, CircleDollarSign, Loader2, Shield, Target, TrendingUp } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getCoinPricesForAdvisor } from '@/lib/coingecko';
import { generateInvestmentAdvice, type Currency, type RiskLevel, type Timeframe } from '@/lib/claude';
import { formatGHS, formatPct, formatPrice } from '@/lib/utils';
import type { PortfolioAdvice, TopCoinAdvisorData } from '@/types/advisor';

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string; detail: string }[] = [
  { value: '1week', label: '1 Week', detail: 'Short-term positioning around near-term momentum.' },
  { value: '1month', label: '1 Month', detail: 'Balanced view for early trend continuation.' },
  { value: '3months', label: '3 Months', detail: 'Enough time for strong narratives to play out.' },
  { value: '6months', label: '6 Months', detail: 'Medium-term allocation across majors and selected alts.' },
  { value: '1year', label: '1 Year', detail: 'Longer horizon with room for compounding and volatility.' },
];

const RISK_OPTIONS: { value: RiskLevel; label: string; description: string }[] = [
  { value: 'conservative', label: 'Conservative', description: 'Focus on capital preservation with heavier weight in established large-cap coins.' },
  { value: 'moderate', label: 'Moderate', description: 'Blend stability and growth using large-cap leaders plus a few stronger mid-cap opportunities.' },
  { value: 'aggressive', label: 'Aggressive', description: 'Maximize upside potential with more volatility and broader altcoin exposure.' },
];

const PIE_COLORS = ['#22C55E', '#38BDF8', '#F59E0B', '#F97316', '#A3E635', '#EAB308'];

function toAdvisorCoinData(coins: Awaited<ReturnType<typeof getCoinPricesForAdvisor>>): TopCoinAdvisorData[] {
  return coins.map((coin) => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    image: coin.image,
    current_price: coin.priceUSD,
    priceUSD: coin.priceUSD,
    priceGHS: coin.priceGHS,
    minInvestmentGHS: coin.minInvestmentGHS,
    marketCap: coin.marketCap,
    volume24h: coin.volume24h,
    market_cap_rank: coin.market_cap_rank,
    price_change_percentage_24h: coin.price_change_percentage_24h,
    price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
  }));
}

function formatUnits(units: number, symbol: string) {
  if (!Number.isFinite(units) || units <= 0) return `≈ 0 ${symbol}`;
  if (units >= 100) return `≈ ${units.toFixed(1)} ${symbol}`;
  if (units >= 1) return `≈ ${units.toFixed(2)} ${symbol}`;
  return `≈ ${units.toFixed(6)} ${symbol}`;
}

export default function InvestmentAdvisor() {
  const [amount, setAmount] = useState('500');
  const [currency, setCurrency] = useState<Currency>('GHS');
  const [timeframe, setTimeframe] = useState<Timeframe>('3months');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('moderate');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PortfolioAdvice | null>(null);

  const parsedAmount = Number(amount);
  const isSmallBudgetInput = currency === 'GHS' && Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount < 100;

  const { data: topCoins, isLoading: coinsLoading } = useQuery({
    queryKey: ['coin-prices-advisor'],
    queryFn: getCoinPricesForAdvisor,
    staleTime: 60_000,
  });

  const filteredAllocations = useMemo(
    () => (result?.recommended_allocation ?? []).filter((coin) => coin.amount_usd >= 0.5),
    [result],
  );

  const handleAnalyze = async () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid investment amount to analyze.');
      return;
    }

    if (!topCoins?.length) {
      setError('Coin market data is still loading. Try again in a moment.');
      return;
    }

    setError('');
    setIsAnalyzing(true);

    try {
      const advice = await generateInvestmentAdvice(
        parsedAmount,
        currency,
        timeframe,
        riskLevel,
        toAdvisorCoinData(topCoins),
      );
      setResult({
        ...advice,
        recommended_allocation: advice.recommended_allocation.filter((coin) => coin.amount_usd >= 0.5),
      });
    } catch {
      setError('Unable to generate portfolio advice right now. Please try again shortly.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col gap-6 px-4 py-6 pb-20 md:px-6 md:pb-8">
      <section className="rounded-3xl border border-[#1E3050] bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(180deg,_rgba(13,21,38,0.98),_rgba(8,14,26,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              <Brain size={14} />
              AI Investment Advisor
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Build a risk-aware crypto allocation from affordable market leaders.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Set your amount, time horizon, and risk profile, then let the advisor narrow the market to realistic assets your budget can actually reach.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[26rem]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Coverage</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{topCoins?.length ?? 0} coins</p>
              <p className="mt-1 text-xs text-slate-400">Top 50 coins screened for affordability</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Output</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">Realistic</p>
              <p className="mt-1 text-xs text-slate-400">Every suggestion must fit your actual budget</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Engine</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">Claude</p>
              <p className="mt-1 text-xs text-slate-400">Allocation plus affordability reasoning</p>
            </div>
          </div>
        </div>
      </section>

      {(isSmallBudgetInput || result?.affordability_warning) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-300" />
            <p>{result?.affordability_warning ?? "Small budget detected - we've limited recommendations to affordable assets only."}</p>
          </div>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
          <div className="flex items-center gap-2">
            <CircleDollarSign size={18} className="text-cyan-300" />
            <h2 className="text-lg font-semibold text-slate-100">Investment Setup</h2>
          </div>
          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Amount</label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="500"
                  className="w-full rounded-2xl border border-[#223556] bg-[#101B30] px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-400"
                />
                <div className="flex rounded-2xl border border-[#223556] bg-[#101B30] p-1">
                  {(['GHS', 'USD'] as Currency[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCurrency(option)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        currency === option ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-slate-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Timeframe</label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {TIMEFRAME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeframe(option.value)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      timeframe === option.value
                        ? 'border-cyan-400 bg-cyan-400/10'
                        : 'border-[#223556] bg-[#101B30] hover:border-cyan-400/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-100">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{option.detail}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Risk Level</label>
              <div className="grid gap-3">
                {RISK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRiskLevel(option.value)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      riskLevel === option.value
                        ? 'border-emerald-400 bg-emerald-400/10'
                        : 'border-[#223556] bg-[#101B30] hover:border-emerald-400/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-100">{option.label}</p>
                      {riskLevel === option.value && <Shield size={16} className="text-emerald-300" />}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || coinsLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  AI is analyzing 20+ coins...
                </>
              ) : (
                <>
                  <TrendingUp size={16} />
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-slate-100">What You'll Get</h2>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[#223556] bg-[#101B30] p-4">
              <p className="text-sm font-medium text-slate-100">Affordable allocation mix</p>
              <p className="mt-1 text-sm text-slate-400">Only coins your budget can realistically reach make it into the final portfolio.</p>
            </div>
            <div className="rounded-2xl border border-[#223556] bg-[#101B30] p-4">
              <p className="text-sm font-medium text-slate-100">Units you can actually buy</p>
              <p className="mt-1 text-sm text-slate-400">Every recommendation shows the estimated units or fractions your allocation amount can purchase.</p>
            </div>
            <div className="rounded-2xl border border-[#223556] bg-[#101B30] p-4">
              <p className="text-sm font-medium text-slate-100">Scenario-based outcomes</p>
              <p className="mt-1 text-sm text-slate-400">Bullish, neutral, and bearish outcomes are translated into total portfolio values in GHS and USD.</p>
            </div>
          </div>
        </div>
      </section>

      {result && (
        <>
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Allocation Mix</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-100">Portfolio recommendation</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Potential gain</p>
                  <p className="text-xl font-semibold text-emerald-300">{formatPct(result.potential_gain_percent)}</p>
                </div>
              </div>

              <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={filteredAllocations} dataKey="percentage" nameKey="symbol" innerRadius={72} outerRadius={108} paddingAngle={3}>
                      {filteredAllocations.map((entry, index) => (
                        <Cell key={entry.symbol} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0]?.payload as PortfolioAdvice['recommended_allocation'][number];
                        return (
                          <div className="rounded-xl border border-[#223556] bg-[#08111F] px-3 py-2 shadow-xl">
                            <p className="text-sm font-semibold text-slate-100">{item.coin}</p>
                            <p className="text-xs text-slate-300">{item.percentage}% allocation</p>
                            <p className="text-xs text-slate-400">{formatGHS(item.amount_ghs)}</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {filteredAllocations.map((coin, index) => (
                  <div key={coin.symbol} className="flex items-center gap-3 rounded-2xl border border-[#223556] bg-[#101B30] px-4 py-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{coin.coin}</p>
                      <p className="text-xs text-slate-400">{formatUnits(coin.units_purchasable, coin.symbol)}</p>
                    </div>
                    <span className="ml-auto text-sm font-semibold text-slate-100">{coin.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Summary</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-100">Expected portfolio outcome</h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#223556] bg-[#101B30] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Invested</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">{formatGHS(result.total_invested_ghs)}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatPrice(result.total_invested_usd, 'USD')}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/80">Potential value</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-200">{formatGHS(result.total_potential_value_ghs)}</p>
                  <p className="mt-1 text-xs text-emerald-100/80">{formatPrice(result.total_potential_value_usd, 'USD')}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-[#223556] bg-[#101B30] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Strategy summary</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{result.strategy_summary}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Bullish', data: result.scenario_bullish, classes: 'border-emerald-500/30 bg-emerald-500/10' },
              { label: 'Neutral', data: result.scenario_neutral, classes: 'border-cyan-500/30 bg-cyan-500/10' },
              { label: 'Bearish', data: result.scenario_bearish, classes: 'border-orange-500/30 bg-orange-500/10' },
            ].map((scenario) => (
              <div key={scenario.label} className={`rounded-3xl border p-5 ${scenario.classes}`}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{scenario.label} Scenario</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{formatGHS(scenario.data.total_value_ghs)}</p>
                <p className="mt-1 text-sm text-slate-300">{formatPrice(scenario.data.total_value_usd, 'USD')}</p>
                <p className="mt-4 text-sm font-medium text-slate-100">{formatPct(scenario.data.gain_percent)}</p>
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#223556]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                    <th className="pb-3 pr-4 font-medium">Coin</th>
                    <th className="pb-3 pr-4 font-medium">Allocation</th>
                    <th className="pb-3 pr-4 font-medium">Amount (GHS)</th>
                    <th className="pb-3 pr-4 font-medium">Predicted value</th>
                    <th className="pb-3 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#162640]">
                  {filteredAllocations.map((coin) => (
                    <tr key={coin.symbol} className="align-top">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={coin.image || `https://placehold.co/40x40/0f172a/e2e8f0?text=${coin.symbol.slice(0, 1)}`}
                            alt={coin.coin}
                            className="h-10 w-10 rounded-full border border-white/10 bg-slate-900 object-cover"
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-100">{coin.coin}</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{coin.symbol}</p>
                            <p className="mt-1 text-xs text-cyan-300">{formatUnits(coin.units_purchasable, coin.symbol)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-sm font-medium text-slate-100">{coin.percentage}%</td>
                      <td className="py-4 pr-4">
                        <p className="text-sm font-medium text-slate-100">{formatGHS(coin.amount_ghs)}</p>
                        <p className="text-xs text-slate-400">{formatPrice(coin.amount_usd, 'USD')}</p>
                        <p className="mt-1 text-xs text-slate-500">{coin.affordability_note}</p>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="text-sm font-medium text-emerald-300">{formatGHS(coin.potential_value_ghs)}</p>
                        <p className="text-xs text-slate-400">Target {formatPrice(coin.target_price, 'USD')}</p>
                      </td>
                      <td className="py-4 text-sm leading-6 text-slate-300">{coin.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <div className="mt-auto rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-300" />
          <p>{result?.warning ?? 'Crypto is highly volatile. Never invest more than you can afford to lose. This is not financial advice.'}</p>
        </div>
      </div>
    </div>
  );
}
