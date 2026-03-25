import type { PredictionResult } from '@/types';
import ScenarioCard from './ScenarioCard';
import FuturesSignalPanel from './FuturesSignalPanel';
import { signalBg, signalLabel } from '@/lib/utils';
import { blurClass } from '@/utils/watermark';
import { Clock, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PredictionCardProps {
  prediction: PredictionResult;
  username?: string;
  showFutures?: boolean;
}

export default function PredictionCard({ prediction, username, showFutures = false }: PredictionCardProps) {
  const { overall_signal, confidence_score, scenarios, is_blurred, expires_at, coin_symbol, futures_signal } = prediction;

  return (
    <div className="space-y-4">
      {/* Signal header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${signalBg(overall_signal)}`}>
            {signalLabel(overall_signal)}
          </span>
          <div className="text-sm text-slate-400">
            <span className="font-medium text-slate-200">{confidence_score}%</span> confidence
          </div>
        </div>

        {username && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Shield size={12} />
            {username}
          </div>
        )}
      </div>

      {/* Scenarios */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${blurClass(is_blurred)}`}>
        <ScenarioCard type="bullish" scenario={scenarios.bullish} currentPrice={prediction.current_price} horizon={prediction.prediction_horizon} />
        <ScenarioCard type="neutral" scenario={scenarios.neutral} currentPrice={prediction.current_price} horizon={prediction.prediction_horizon} />
        <ScenarioCard type="bearish" scenario={scenarios.bearish} currentPrice={prediction.current_price} horizon={prediction.prediction_horizon} />
      </div>

      {/* Futures signal panel */}
      {showFutures && futures_signal && (
        <FuturesSignalPanel signal={futures_signal} coinSymbol={coin_symbol} />
      )}

      {/* Expiry */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Clock size={11} />
        Prediction valid for {formatDistanceToNow(new Date(expires_at))} · {coin_symbol.toUpperCase()}
      </div>
    </div>
  );
}
