// Predict page — full AI prediction for a specific coin

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Brain, RefreshCw, Lock, TrendingUp, TrendingDown,
  Shield, AlertTriangle, Zap, Clock
} from 'lucide-react';
import { marketApi, predictionApi } from '@/lib/api';
import { formatPrice, formatPct, sentimentColor, signalColor, timeAgo } from '@/lib/utils';
import SignalBadge from '@/components/ui/SignalBadge';
import ConfidenceBar from '@/components/ui/ConfidenceBar';
import PriceChart from '@/components/charts/PriceChart';
import PredictionChart from '@/components/charts/PredictionChart';
import TechnicalPanel from '@/components/charts/TechnicalPanel';
import SentimentMeter from '@/components/charts/SentimentMeter';
import type { Horizon } from '@/types';
import type { ChartTimeframe } from '@/components/charts/chartUtils';

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

export default function Predict() {
  const { coinId = 'bitcoin' } = useParams();
  const [horizon, setHorizon] = useState<Horizon>('7d');
  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('3M');

  const { data: coin } = useQuery({
    queryKey: ['coin', coinId],
    queryFn: () => marketApi.getCoin(coinId),
  });

  const { data: history } = useQuery({
    queryKey: ['history', coinId, 365],
    queryFn: () => marketApi.getCoinHistory(coinId, 365),
    enabled: !!coinId,
  });

  const { data: ghsRate = 15.5 } = useQuery({
    queryKey: ['ghs-rate'],
    queryFn: () => marketApi.getGhsRate(),
  });

  const {
    data: prediction,
    isLoading: predLoading,
    refetch: refetchPred,
    error: predError,
  } = useQuery({
    queryKey: ['prediction', coinId, horizon],
    queryFn: () => predictionApi.getPrediction(coinId, horizon),
    enabled: analysisEnabled,
    staleTime: 300_000, // 5 min
  });

  const positive = (coin?.price_change_percentage_24h ?? 0) >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-4">
      {/* Back + coin header */}
      <div className="flex items-start gap-4">
        <Link to="/" className="text-slate-400 hover:text-slate-200 mt-1">
          <ArrowLeft size={20} />
        </Link>
        {coin && (
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
              <div>
                <h1 className="text-xl font-bold text-slate-100">{coin.name}</h1>
                <span className="text-sm text-slate-500 uppercase">{coin.symbol} · #{coin.market_cap_rank}</span>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold text-slate-100 font-mono">{formatPrice(coin.current_price)}</p>
                <span className={`text-sm font-medium flex items-center justify-end gap-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
                  {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {formatPct(coin.price_change_percentage_24h ?? 0)} (24h)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Price Chart */}
      {history && coin && (
        prediction ? (
          <PredictionChart
            coinId={coinId}
            prediction={prediction}
            ghsRate={ghsRate}
            timeframe={chartTimeframe}
            onTimeframeChange={setChartTimeframe}
          />
        ) : (
          <PriceChart
            coinId={coinId}
            ghsRate={ghsRate}
            timeframe={chartTimeframe}
            onTimeframeChange={setChartTimeframe}
          />
        )
      )}

      {/* Horizon selector + Analyze button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-[#0D1526] border border-[#1E3050] rounded-xl p-1 gap-1">
          {HORIZONS.map(h => (
            <button
              key={h.value}
              onClick={() => setHorizon(h.value)}
              className={`flex-1 text-sm px-3 py-2 rounded-lg font-medium transition-colors ${
                horizon === h.value
                  ? 'bg-brand text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setAnalysisEnabled(true); if (analysisEnabled) refetchPred(); }}
          disabled={predLoading}
          className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
        >
          {predLoading ? (
            <><RefreshCw size={16} className="animate-spin" /> Analyzing...</>
          ) : (
            <><Brain size={16} /> Generate AI Prediction</>
          )}
        </button>
      </div>

      {predError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Failed to generate prediction. Please try again.
        </div>
      )}

      {/* Prediction results */}
      {prediction && (
        <div className="space-y-4">
          {/* Signal + confidence */}
          <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide">AI Signal · {horizon} outlook</p>
                <SignalBadge signal={prediction.overall_signal} size="lg" />
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={12} />
                  Generated {timeAgo(prediction.generated_at)} · expires {timeAgo(prediction.expires_at)}
                </p>
              </div>
              <div className="w-full sm:w-48">
                <ConfidenceBar value={prediction.confidence_score} signalAgreement={prediction.signal_agreement} />
              </div>
            </div>
          </div>

          {/* Three scenarios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['bullish', 'neutral', 'bearish'] as const).map(scenario => {
              const s = prediction.scenarios[scenario];
              const colors = {
                bullish: { border: 'border-green-500/30', text: 'text-green-400', bg: 'bg-green-500/5' },
                neutral: { border: 'border-yellow-500/30', text: 'text-yellow-400', bg: 'bg-yellow-500/5' },
                bearish: { border: 'border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/5' },
              }[scenario];

              return (
                <div key={scenario} className={`border rounded-xl p-4 ${colors.border} ${colors.bg} relative overflow-hidden`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${colors.text}`}>
                    {scenario} case
                  </p>

                  {prediction.is_blurred ? (
                    <div className="space-y-2">
                      <div className="blur-locked">
                        <p className="text-2xl font-bold text-slate-100">$999,999</p>
                        <p className="text-sm text-green-400">+99.9%</p>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-[#0D1526]/60 backdrop-blur-sm rounded-xl">
                        <div className="text-center">
                          <Lock size={20} className="text-brand mx-auto mb-1" />
                          <p className="text-xs text-slate-400">Pro only</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-slate-100 font-mono">
                        {s.price_target ? formatPrice(s.price_target) : '—'}
                      </p>
                      <p className={`text-sm font-medium ${colors.text}`}>
                        {s.percentage_change !== null ? formatPct(s.percentage_change) : '—'}
                      </p>
                      <ConfidenceBar value={s.confidence} label="Probability" />
                      <ul className="mt-3 space-y-1">
                        {s.key_factors.map((f, i) => (
                          <li key={i} className="text-xs text-slate-400 flex gap-1">
                            <span className={colors.text}>•</span> {f}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* AI Analysis */}
          {prediction.is_blurred ? (
            <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} className="text-brand" />
                <h3 className="font-semibold text-slate-200">AI Analysis</h3>
              </div>
              <div className="blur-locked text-sm text-slate-300 leading-relaxed">
                Lorem ipsum dolor sit amet consectetur adipisicing elit. This is a detailed analysis of the coin's
                price action, technical indicators, sentiment signals, and market structure that only Pro users can see.
                The AI has identified several key patterns suggesting...
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D1526]/80 backdrop-blur-sm rounded-xl">
                <Lock size={24} className="text-brand mb-2" />
                <p className="font-semibold text-slate-200 mb-1">Unlock Full Analysis</p>
                <p className="text-sm text-slate-400 mb-4 text-center px-8">
                  Get AI-powered price targets, detailed analysis, and all scenarios
                </p>
                <Link
                  to="/pricing"
                  className="bg-brand hover:bg-brand/90 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Zap size={16} /> Upgrade to Pro
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} className="text-brand" />
                  <h3 className="font-semibold text-slate-200">AI Analysis</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{prediction.ai_analysis}</p>
              </div>

              {/* Risks & Opportunities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0D1526] border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={14} className="text-red-400" />
                    <h3 className="text-sm font-semibold text-red-400">Key Risks</h3>
                  </div>
                  <ul className="space-y-2">
                    {prediction.key_risks.map((r, i) => (
                      <li key={i} className="text-xs text-slate-300 flex gap-2">
                        <span className="text-red-400 font-bold mt-0.5">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#0D1526] border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-green-400" />
                    <h3 className="text-sm font-semibold text-green-400">Opportunities</h3>
                  </div>
                  <ul className="space-y-2">
                    {prediction.key_opportunities.map((o, i) => (
                      <li key={i} className="text-xs text-slate-300 flex gap-2">
                        <span className="text-green-400 font-bold mt-0.5">•</span> {o}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          <TechnicalPanel data={history ?? []} timeframe={chartTimeframe} />

          {/* Technical indicators */}
          <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5">
            <h3 className="font-semibold text-slate-200 mb-4">Technical Indicators</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* RSI */}
              <div className="space-y-1">
                <p className="text-xs text-slate-500">RSI (14)</p>
                <p className={`text-lg font-bold font-mono ${
                  prediction.technicals.rsi < 30 ? 'text-green-400' :
                  prediction.technicals.rsi > 70 ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {prediction.technicals.rsi.toFixed(1)}
                </p>
                <p className="text-xs capitalize text-slate-400">{prediction.technicals.rsi_signal}</p>
              </div>
              {/* MACD */}
              <div className="space-y-1">
                <p className="text-xs text-slate-500">MACD</p>
                <p className={`text-lg font-bold font-mono ${prediction.technicals.macd.trend === 'bullish' ? 'text-green-400' : prediction.technicals.macd.trend === 'bearish' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {prediction.technicals.macd.histogram.toFixed(4)}
                </p>
                <p className="text-xs capitalize text-slate-400">{prediction.technicals.macd.trend}</p>
              </div>
              {/* MA Trend */}
              <div className="space-y-1">
                <p className="text-xs text-slate-500">MA Trend</p>
                <p className={`text-sm font-semibold capitalize ${signalColor(
                  prediction.technicals.moving_averages.trend.includes('bull') ? 'buy' :
                  prediction.technicals.moving_averages.trend.includes('bear') ? 'sell' : 'hold'
                )}`}>
                  {prediction.technicals.moving_averages.trend.replace('_', ' ')}
                </p>
                <p className="text-xs text-slate-400">Volume: {prediction.technicals.volume_trend}</p>
              </div>
              {/* Fear & Greed */}
              <div className="rounded-xl border border-[#1E3050] bg-[#08111F] p-3">
                <p className="text-xs text-slate-500">Fear & Greed</p>
                <p className="mt-1 text-lg font-bold text-slate-100">{prediction.sentiment.fear_greed_index}</p>
                <p className="text-xs text-slate-400">{prediction.sentiment.fear_greed_label}</p>
              </div>
            </div>

            {/* Bollinger Bands info */}
            <div className="mt-4 pt-4 border-t border-[#1E3050] grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-500">BB Upper</p>
                <p className="text-slate-200 font-mono">{formatPrice(prediction.technicals.bollinger.upper)}</p>
              </div>
              <div>
                <p className="text-slate-500">BB Middle</p>
                <p className="text-slate-200 font-mono">{formatPrice(prediction.technicals.bollinger.middle)}</p>
              </div>
              <div>
                <p className="text-slate-500">BB Lower</p>
                <p className="text-slate-200 font-mono">{formatPrice(prediction.technicals.bollinger.lower)}</p>
              </div>
            </div>
          </div>

          {/* Sentiment */}
          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-4">
            <SentimentMeter
              sentiment={prediction.sentiment}
              previousScore={Math.max(
                0,
                Math.min(
                  100,
                  prediction.sentiment.fear_greed_index - (prediction.sentiment.news_sentiment_score + prediction.sentiment.social_sentiment_score) * 10
                )
              )}
            />
            <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5">
              <h3 className="font-semibold text-slate-200 mb-3">Sentiment Analysis</h3>
              <p className={`text-sm font-semibold mb-2 capitalize ${sentimentColor(prediction.sentiment.overall_sentiment)}`}>
                {prediction.sentiment.overall_sentiment.replace('_', ' ')}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{prediction.sentiment.sentiment_summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Initial state */}
      {!analysisEnabled && !prediction && (
        <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-12 text-center">
          <Brain size={48} className="text-brand mx-auto mb-4 opacity-60" />
          <h2 className="text-lg font-semibold text-slate-200 mb-2">AI Price Prediction</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Select a time horizon and click "Generate AI Prediction" to get a full technical + sentiment analysis
            with price targets for each scenario.
          </p>
          <button
            onClick={() => setAnalysisEnabled(true)}
            className="bg-brand hover:bg-brand/90 text-white px-6 py-3 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
          >
            <Brain size={18} /> Generate AI Prediction
          </button>
        </div>
      )}
    </div>
  );
}
