/**
 * ShareModal — modal that shows the ShareableCard preview and share actions.
 *
 * Actions:
 *  1. Download as PNG  — html2canvas captures the card div
 *  2. Share to WhatsApp — wa.me deep link with pre-filled message
 *  3. Copy link        — copies predx.app/c/:coinId to clipboard
 *
 * html2canvas is loaded lazily so it doesn't bloat the initial bundle.
 */

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, MessageCircle, Link2, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import ShareableCard from './ShareableCard';
import type { OverallSignal, SentimentLabel } from '@/types';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Card data
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinImage: string;
  timeframe: string;
  signal: OverallSignal;
  confidenceScore: number;
  sentiment: SentimentLabel;
  username: string;
}

export default function ShareModal({
  isOpen, onClose,
  coinId, coinName, coinSymbol, coinImage,
  timeframe, signal, confidenceScore, sentiment, username,
}: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `https://predx.app/c/${coinId}`;
  const whatsappText = `📊 ${coinName} (${coinSymbol.toUpperCase()}) ${timeframe} AI signal: ${signal.replace('_', ' ').toUpperCase()} — See the full prediction at ${shareUrl}`;

  // ── Download as PNG ──────────────────────────────────────────────────────────
  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,               // 2× for Retina / sharp PNG
        useCORS: true,          // needed for coin images from external CDN
        logging: false,
        windowWidth: 400,
      });

      const link = document.createElement('a');
      link.download = `predx-${coinSymbol.toLowerCase()}-${timeframe}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Card downloaded!');
    } catch {
      toast.error('Download failed — try again.');
    } finally {
      setDownloading(false);
    }
  }

  // ── WhatsApp share ───────────────────────────────────────────────────────────
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, '_blank', 'noopener');
  }

  // ── Copy link ────────────────────────────────────────────────────────────────
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy link.');
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-[#1E3050] border border-[#2a4070] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X size={15} />
        </button>

        {/* Card preview — html2canvas captures this div */}
        <div className="flex justify-center mb-4">
          <ShareableCard
            ref={cardRef}
            coinName={coinName}
            coinSymbol={coinSymbol}
            coinImage={coinImage}
            timeframe={timeframe}
            signal={signal}
            confidenceScore={confidenceScore}
            sentiment={sentiment}
            username={username}
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <ActionButton
            icon={downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            label="Download"
            onClick={handleDownload}
            disabled={downloading}
          />
          <ActionButton
            icon={<MessageCircle size={18} />}
            label="WhatsApp"
            onClick={handleWhatsApp}
            accent="green"
          />
          <ActionButton
            icon={copied ? <Check size={18} className="text-green-400" /> : <Link2 size={18} />}
            label={copied ? 'Copied!' : 'Copy Link'}
            onClick={handleCopy}
          />
        </div>

        {/* Share URL display */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#1E3050] bg-[#08111F] px-3 py-2">
          <span className="flex-1 truncate text-xs text-slate-400 font-mono">{shareUrl}</span>
          <button onClick={handleCopy} className="text-xs text-brand hover:text-blue-300 transition-colors font-medium">
            Copy
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-slate-600">
          Anyone with this link sees a teaser — full predictions require sign-up.
        </p>
      </div>
    </div>
  );
}

// ─── Small action button ──────────────────────────────────────────────────────

function ActionButton({
  icon, label, onClick, disabled = false, accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: 'green';
}) {
  const accentClass = accent === 'green'
    ? 'border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20'
    : 'border-[#1E3050] bg-[#0D1526] text-slate-300 hover:border-brand/40 hover:text-slate-100';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors disabled:opacity-50 ${accentClass}`}
    >
      {icon}
      {label}
    </button>
  );
}
