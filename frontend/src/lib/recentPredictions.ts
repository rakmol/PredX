// Persist the last N predictions a user ran — stored in localStorage

import type { OverallSignal, Horizon } from '@/types';

export interface RecentPrediction {
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinImage: string;
  horizon: Horizon;
  overall_signal: OverallSignal;
  confidence_score: number;
  neutral_price_target: number | null;
  generated_at: string;
  viewed_at: string;
}

const KEY = 'predx_recent_predictions';
const MAX = 5;

export function saveRecentPrediction(pred: RecentPrediction): void {
  try {
    const existing: RecentPrediction[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    // Remove same coinId + horizon combination so the latest replaces it
    const filtered = existing.filter(
      (p) => !(p.coinId === pred.coinId && p.horizon === pred.horizon),
    );
    const updated = [pred, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch { /* storage unavailable — silently ignore */ }
}

export function getRecentPredictions(): RecentPrediction[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
