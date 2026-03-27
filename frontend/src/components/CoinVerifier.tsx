// CoinVerifier — search a coin by name or contract address to verify it's legitimate

import { useState, useRef } from 'react';
import { Search, CheckCircle2, XCircle, Copy, Check, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { marketApi, type VerifyCoinResult, type CoinPlatform } from '@/lib/api';

function shortAddr(addr: string) {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function NetworkChip({ platform, copyable = true }: { platform: CoinPlatform; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(platform.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#1E3050] bg-[#0A1525] px-2.5 py-1.5">
      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
        {platform.networkLabel}
      </span>
      <span className="font-mono text-[11px] text-slate-400">{shortAddr(platform.address)}</span>
      {copyable && (
        <button
          onClick={copy}
          className="ml-0.5 rounded p-0.5 text-slate-500 transition-colors hover:text-slate-300"
          title="Copy address"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
      )}
    </div>
  );
}

interface Props {
  compact?: boolean; // landing page style (smaller)
}

export default function CoinVerifier({ compact = false }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyCoinResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await marketApi.verifyCoin(q);
      setResult(data);
    } catch {
      setError('Failed to verify coin. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  const clear = () => {
    setQuery('');
    setResult(null);
    setError('');
    inputRef.current?.focus();
  };

  return (
    <div className={compact ? 'w-full' : 'w-full'}>
      {!compact && (
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <h2 className="text-base font-semibold text-slate-100">Coin Verifier</h2>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            Powered by CoinGecko
          </span>
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Enter coin name or contract address (0x...)"
            className={`w-full rounded-xl border border-[#1E3050] bg-[#0D1526] pl-9 pr-4 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 ${compact ? 'py-2.5' : 'py-3'}`}
          />
        </div>
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className={`flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 font-semibold text-white transition-all hover:bg-emerald-400 disabled:opacity-50 ${compact ? 'text-xs py-2' : 'text-sm py-3'}`}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {compact ? 'Check' : 'Verify'}
        </button>
      </div>

      {/* Result */}
      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}

      {result && (
        <div className="mt-3 rounded-xl border bg-[#0D1526] p-4 transition-all
          ${result.found ? 'border-emerald-500/30' : 'border-red-500/30'}">
          <div className={`rounded-xl border p-4 ${result.found ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            {result.found ? (
              <>
                <div className="flex items-start gap-3">
                  {result.image && (
                    <img src={result.image} alt={result.name} className="h-10 w-10 rounded-full border border-white/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span className="font-bold text-slate-100">{result.name}</span>
                      <span className="text-xs text-slate-500 uppercase">{result.symbol}</span>
                      {result.marketCapRank && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          Rank #{result.marketCapRank}
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        VERIFIED ✓
                      </span>
                    </div>

                    {result.platforms && result.platforms.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Contract Addresses</p>
                        <div className="flex flex-wrap gap-2">
                          {result.platforms.map((p) => (
                            <NetworkChip key={p.network} platform={p} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        This is a native coin — no contract address (not an ERC-20/BEP-20 token).
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <XCircle size={16} className="text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-red-300">Coin not found</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    This coin or address was not found in the CoinGecko database. It may be fake, very new, or delisted. Exercise caution.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <p className="text-[10px] text-slate-600">Data from CoinGecko</p>
              <button onClick={clear} className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                Search again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
