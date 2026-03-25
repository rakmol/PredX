// Utility helpers

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency = 'USD', compact = false): string {
  if (price === null || price === undefined) return '—';
  const opts: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: price < 1 ? 4 : price < 100 ? 2 : 0,
    maximumFractionDigits: price < 1 ? 6 : price < 100 ? 2 : 0,
  };
  return new Intl.NumberFormat('en-US', opts).format(price);
}

export function formatGHS(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPct(value: number, showPlus = true): string {
  const sign = value > 0 && showPlus ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export function signalColor(signal: string): string {
  switch (signal) {
    case 'strong_buy': return 'text-green-400';
    case 'buy': return 'text-green-300';
    case 'hold': return 'text-yellow-400';
    case 'sell': return 'text-red-300';
    case 'strong_sell': return 'text-red-400';
    default: return 'text-slate-400';
  }
}

export function signalLabel(signal: string): string {
  return signal.replace('_', ' ').toUpperCase();
}

export function signalBg(signal: string): string {
  switch (signal) {
    case 'strong_buy': return 'bg-green-500/20 border-green-500/40 text-green-400';
    case 'buy': return 'bg-green-500/10 border-green-500/30 text-green-300';
    case 'hold': return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    case 'sell': return 'bg-red-500/10 border-red-500/30 text-red-300';
    case 'strong_sell': return 'bg-red-500/20 border-red-500/40 text-red-400';
    default: return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
  }
}

export function sentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'very_bullish': return 'text-green-400';
    case 'bullish': return 'text-green-300';
    case 'neutral': return 'text-yellow-400';
    case 'bearish': return 'text-red-300';
    case 'very_bearish': return 'text-red-400';
    default: return 'text-slate-400';
  }
}

export function fearGreedColor(value: number): string {
  if (value >= 80) return '#22C55E';
  if (value >= 60) return '#84CC16';
  if (value >= 40) return '#EAB308';
  if (value >= 20) return '#F97316';
  return '#EF4444';
}

export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
