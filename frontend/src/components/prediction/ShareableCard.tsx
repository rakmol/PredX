/**
 * ShareableCard — the image that gets downloaded or shared.
 *
 * Design rules:
 *  - Dark, branded (PredX palette)
 *  - Shows signal, confidence label, sentiment label — NOT the actual price target
 *  - Bottom CTA drives installs: "Get your prediction at predx.app"
 *  - Watermark: "Shared by @username" (subtle, bottom-left)
 *
 * The outer div is what html2canvas captures. Keep it fixed-width (400px)
 * so the PNG is consistent across screen sizes.
 */

import { forwardRef } from 'react';
import type { OverallSignal, SentimentLabel } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 75) return { text: 'High',   color: '#22c55e' };
  if (score >= 50) return { text: 'Medium', color: '#f59e0b' };
  return                   { text: 'Low',   color: '#ef4444' };
}

function signalDisplay(signal: OverallSignal): { text: string; color: string; bg: string } {
  switch (signal) {
    case 'strong_buy':  return { text: 'STRONG BUY',  color: '#4ade80', bg: 'rgba(34,197,94,0.15)' };
    case 'buy':         return { text: 'BUY',         color: '#4ade80', bg: 'rgba(34,197,94,0.12)' };
    case 'hold':        return { text: 'HOLD',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
    case 'sell':        return { text: 'SELL',        color: '#f87171', bg: 'rgba(239,68,68,0.12)' };
    case 'strong_sell': return { text: 'STRONG SELL', color: '#f87171', bg: 'rgba(239,68,68,0.15)' };
  }
}

function sentimentDisplay(sentiment: SentimentLabel): { text: string; color: string } {
  switch (sentiment) {
    case 'very_bullish': return { text: 'Very Bullish', color: '#4ade80' };
    case 'bullish':      return { text: 'Bullish',      color: '#86efac' };
    case 'neutral':      return { text: 'Neutral',      color: '#fbbf24' };
    case 'bearish':      return { text: 'Bearish',      color: '#fca5a5' };
    case 'very_bearish': return { text: 'Very Bearish', color: '#f87171' };
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShareableCardProps {
  coinName: string;
  coinSymbol: string;
  coinImage: string;
  timeframe: string;       // e.g. "7d"
  signal: OverallSignal;
  confidenceScore: number; // 0–100
  sentiment: SentimentLabel;
  username: string;        // shared by @username
}

// ─── Component ───────────────────────────────────────────────────────────────

const ShareableCard = forwardRef<HTMLDivElement, ShareableCardProps>(
  ({ coinName, coinSymbol, coinImage, timeframe, signal, confidenceScore, sentiment, username }, ref) => {
    const sig = signalDisplay(signal);
    const conf = confidenceLabel(confidenceScore);
    const sent = sentimentDisplay(sentiment);

    const horizonLabel: Record<string, string> = {
      '24h': '24-Hour', '7d': '7-Day', '30d': '30-Day', '90d': '90-Day',
    };

    return (
      <div
        ref={ref}
        style={{
          width: 400,
          background: 'linear-gradient(160deg, #0d1526 0%, #050a14 60%, #081020 100%)',
          border: '1px solid #1e3050',
          borderRadius: 20,
          padding: '28px 24px 20px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          color: '#e2e8f0',
        }}
      >
        {/* Subtle grid overlay — decorative */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg,rgba(96,165,250,0.03) 0,rgba(96,165,250,0.03) 1px,transparent 1px,transparent 40px),' +
              'repeating-linear-gradient(90deg,rgba(96,165,250,0.03) 0,rgba(96,165,250,0.03) 1px,transparent 1px,transparent 40px)',
            pointerEvents: 'none',
          }}
        />

        {/* Glow accent */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${sig.color}22 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* ── Header: PredX brand ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Logo mark */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 800,
                color: '#fff',
              }}
            >
              P
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>
              PredX
            </span>
          </div>

          {/* Timeframe badge */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#60a5fa',
              background: 'rgba(96,165,250,0.12)',
              border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: 20,
              padding: '3px 10px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {horizonLabel[timeframe] ?? timeframe} Forecast
          </div>
        </div>

        {/* ── Coin identity ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <img
            src={coinImage}
            alt={coinName}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.08)',
              background: '#0d1526',
              objectFit: 'cover',
            }}
            crossOrigin="anonymous"
          />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.4px' }}>
              {coinName}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {coinSymbol}
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'rgba(30,48,80,0.8)', marginBottom: 20 }} />

        {/* ── Signal pill (the star of the card) ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
            AI Signal
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: sig.bg,
              border: `1px solid ${sig.color}44`,
              borderRadius: 10,
              padding: '10px 18px',
            }}
          >
            {/* Signal dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: sig.color,
                boxShadow: `0 0 6px ${sig.color}`,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 800, color: sig.color, letterSpacing: '0.5px' }}>
              {sig.text}
            </span>
          </div>
        </div>

        {/* ── Confidence + Sentiment row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {/* Confidence */}
          <div
            style={{
              background: 'rgba(8,17,31,0.6)',
              border: '1px solid #1e3050',
              borderRadius: 12,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>
              Confidence
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: conf.color, fontVariantNumeric: 'tabular-nums' }}>
                {conf.text}
              </span>
            </div>
            {/* Confidence bar */}
            <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${confidenceScore}%`,
                  background: `linear-gradient(90deg, ${conf.color}88, ${conf.color})`,
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{confidenceScore}%</div>
          </div>

          {/* Sentiment */}
          <div
            style={{
              background: 'rgba(8,17,31,0.6)',
              border: '1px solid #1e3050',
              borderRadius: 12,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>
              Sentiment
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: sent.color }}>
              {sent.text}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Market mood</div>
          </div>
        </div>

        {/* ── "Price locked" teaser — intentional mystery ── */}
        <div
          style={{
            background: 'rgba(96,165,250,0.05)',
            border: '1px dashed rgba(96,165,250,0.2)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>🔒</span>
          <span style={{ fontSize: 12, color: '#60a5fa' }}>
            Price target hidden — see it in the app
          </span>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'rgba(30,48,80,0.8)', marginBottom: 16 }} />

        {/* ── CTA footer ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
              Get your prediction at
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>predx.app</div>
          </div>

          {/* QR code placeholder — actual QR rendered via URL */}
          <QRCodeSVG value={`https://predx.app/c/${coinSymbol.toLowerCase()}`} size={52} />
        </div>

        {/* ── Watermark ── */}
        <div
          style={{
            marginTop: 12,
            fontSize: 10,
            color: '#334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Shared by @{username}</span>
          <span>Not financial advice</span>
        </div>
      </div>
    );
  },
);

ShareableCard.displayName = 'ShareableCard';
export default ShareableCard;

// ─── Inline QR code (no external dep needed) ─────────────────────────────────
// We use a simple URL-based Google Charts QR (or a tiny inline implementation).
// To avoid any npm dep, we use the free QR server API. Replace with qrcode.react
// if you prefer a pure client-side solution.

function QRCodeSVG({ value, size }: { value: string; size: number }) {
  // Uses the free QR code image API — works offline-safe via img element
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}&bgcolor=0D1526&color=60a5fa&margin=1`;
  return (
    <img
      src={src}
      alt="QR code"
      width={size}
      height={size}
      style={{ borderRadius: 6, border: '1px solid rgba(96,165,250,0.2)', flexShrink: 0 }}
      crossOrigin="anonymous"
    />
  );
}
