// RefreshSelector — Binance-style auto-refresh interval selector for charts

import { useEffect, useState } from 'react';

export interface RefreshOption {
  label: string;
  ms: number | null;
}

export const REFRESH_OPTIONS: RefreshOption[] = [
  { label: 'Off', ms: null },
  { label: '5s', ms: 5_000 },
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m',  ms: 60_000 },
  { label: '5m',  ms: 300_000 },
  { label: '15m', ms: 900_000 },
];

export const REFRESH_INTERVAL_STORAGE_KEY = 'predx_chart_refresh_interval';
export const DEFAULT_REFRESH_INTERVAL_MS = 5_000;

export function getStoredRefreshInterval(): number | null {
  try {
    const stored = localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY);
    if (stored === null) return DEFAULT_REFRESH_INTERVAL_MS;
    if (stored === 'null') return null;
    const parsed = Number(stored);
    return REFRESH_OPTIONS.some((o) => o.ms === parsed) ? parsed : DEFAULT_REFRESH_INTERVAL_MS;
  } catch {
    return DEFAULT_REFRESH_INTERVAL_MS;
  }
}

export function setStoredRefreshInterval(ms: number | null): void {
  try {
    localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(ms));
  } catch { /* noop */ }
}

interface Props {
  intervalMs: number | null;
  onChange: (ms: number | null) => void;
  isWebSocket: boolean;
  lastRefreshedAt: number | null;
}

export default function RefreshSelector({ intervalMs, onChange, isWebSocket, lastRefreshedAt }: Props) {
  const [countdown, setCountdown] = useState(0);
  const [justUpdated, setJustUpdated] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // "Updated just now" flash whenever lastRefreshedAt advances
  useEffect(() => {
    if (!lastRefreshedAt) return;
    setJustUpdated(true);
    const t = window.setTimeout(() => setJustUpdated(false), 3000);
    return () => window.clearTimeout(t);
  }, [lastRefreshedAt]);

  // Countdown timer — resets on interval change or after a refresh
  useEffect(() => {
    if (!intervalMs) {
      setCountdown(0);
      return;
    }

    const full = Math.ceil(intervalMs / 1000);
    setCountdown(full);

    const id = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? full : prev - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [intervalMs, lastRefreshedAt]);

  function handleChange(ms: number | null) {
    onChange(ms);
    setStoredRefreshInterval(ms);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* WebSocket live badge with tooltip */}
      {isWebSocket ? (
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-cyan-400 cursor-default"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip((v) => !v)}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Live via WebSocket
          </button>
          {showTooltip && (
            <div className="absolute bottom-7 left-0 z-50 w-56 rounded-lg bg-[#1E3050] border border-slate-700 p-2.5 text-xs text-slate-300 shadow-xl pointer-events-none">
              Real-time data active — manual refresh not needed
            </div>
          )}
        </div>
      ) : (
        /* Countdown / status text */
        <span className="text-xs text-slate-500 w-[110px]">
          {justUpdated
            ? 'Updated just now'
            : intervalMs
            ? `Refreshing in ${countdown}s`
            : 'Auto-refresh off'}
        </span>
      )}

      {/* Pill button group — grayed when WS active */}
      <div
        className={`flex rounded-xl border border-[#223556] bg-[#11131A] p-1 transition-opacity ${
          isWebSocket ? 'opacity-40 pointer-events-none' : ''
        }`}
        title={isWebSocket ? 'Real-time data active — manual refresh not needed' : undefined}
      >
        {REFRESH_OPTIONS.map(({ label, ms }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleChange(ms)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              intervalMs === ms
                ? 'bg-[#0068FF] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
