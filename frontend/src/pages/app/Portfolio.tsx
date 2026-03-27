import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Wallet,
  Link2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Unlink,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { marketApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  testConnection, encryptField, saveExchangeConnection, deleteExchangeConnection,
  getAccountBalance, getDecryptedKeys, getTradeHistory, updateLastSynced,
} from '@/lib/binance';
import { useAuthStore } from '@/store/authStore';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import SparklineChart from '@/components/charts/SparklineChart';
import { formatGHS, formatPct, formatPrice, timeAgo } from '@/lib/utils';
import type { CoinData, CoinSearchResult } from '@/types';
import {
  PIE_COLORS,
  SUPPORTED_LIVE_EXCHANGES,
  buildInsights,
  buildPositionNote,
  getManualStorageKey,
  getSortValue,
  toRowTone,
  type ConnectedBalance,
  type ConnectedTrade,
  type ExchangeConnectionRow,
  type ManualPosition,
  type PortfolioRow,
  type SortDirection,
  type SortKey,
} from './portfolioHelpers';

/* ─── Connect Binance Modal ──────────────────────────────────────────────── */

function ConnectBinanceModal({ userId, onConnected, onClose }: {
  userId: string;
  onConnected: () => void;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [step, setStep] = useState<'form' | 'testing' | 'success' | 'error'>('form');
  const [message, setMessage] = useState('');

  const handleConnect = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    setStep('testing');
    setMessage('');

    const result = await testConnection(apiKey.trim(), apiSecret.trim());
    if (!result.success) {
      setStep('error');
      setMessage(result.message);
      return;
    }

    try {
      const [encKey, encSecret] = await Promise.all([
        encryptField(apiKey.trim(), userId),
        encryptField(apiSecret.trim(), userId),
      ]);
      await saveExchangeConnection(userId, encKey, encSecret);
      setStep('success');
      setMessage(result.message);
      setTimeout(() => { onConnected(); onClose(); }, 1500);
    } catch (err) {
      setStep('error');
      setMessage(err instanceof Error ? err.message : 'Failed to save connection.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[#1E3050] bg-[#0A1525] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0B90B]/20">
            <span className="text-lg font-bold text-[#F0B90B]">B</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Connect Binance</h2>
            <p className="text-xs text-slate-500">Read-only · no trading access</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-slate-400 space-y-1.5">
          <p className="font-semibold text-blue-300 mb-2">How to create a read-only API key on Binance:</p>
          <p>1. Go to Binance → Account → API Management</p>
          <p>2. Click <strong className="text-slate-200">"Create API"</strong> and choose System Generated</p>
          <p>3. Enable <strong className="text-slate-200">Read Info only</strong> — disable all other permissions</p>
          <p>4. Copy your API Key and Secret Key below</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Binance API Key"
              className="w-full rounded-xl border border-[#1E3050] bg-[#050A14] px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#F0B90B]/50 transition-colors"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Secret Key</label>
            <div className="relative">
              <input
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                type={showSecret ? 'text' : 'password'}
                placeholder="Paste your Secret Key"
                className="w-full rounded-xl border border-[#1E3050] bg-[#050A14] px-4 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#F0B90B]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
            step === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' :
            step === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
            'border-amber-500/30 bg-amber-500/10 text-amber-300'
          }`}>
            {step === 'error' ? <XCircle size={13} className="mt-0.5 shrink-0" /> :
             step === 'success' ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : null}
            {message}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#1E3050] py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={step === 'testing' || step === 'success' || !apiKey || !apiSecret}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F0B90B] py-2.5 text-sm font-bold text-black transition-all hover:bg-[#F0B90B]/90 disabled:opacity-50"
          >
            {step === 'testing' ? <><Loader2 size={14} className="animate-spin" /> Testing…</> :
             step === 'success' ? <><CheckCircle2 size={14} /> Connected!</> :
             <><Link2 size={14} /> Connect</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, sub, tone = 'text-slate-100' }: { title: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[#1E3050] bg-[#08111F] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-400">{sub}</p>
    </div>
  );
}

export default function PortfolioPage() {
  const profile = useAuthStore((state) => state.profile);
  const isPro = true; // All authenticated users have full access
  const queryClient = useQueryClient();
  const [manualPositions, setManualPositions] = useState<ManualPosition[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(null);
  const [amountOwned, setAmountOwned] = useState(''); const [averageBuyPrice, setAverageBuyPrice] = useState('');
  const [openedAt, setOpenedAt] = useState(new Date().toISOString().slice(0, 10));
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const saved = localStorage.getItem(getManualStorageKey(profile.id));
    setManualPositions(saved ? JSON.parse(saved) as ManualPosition[] : []);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(getManualStorageKey(profile.id), JSON.stringify(manualPositions));
  }, [manualPositions, profile?.id]);

  const { data: ghsRate = 15.5 } = useQuery({ queryKey: ['ghs-rate'], queryFn: () => marketApi.getGhsRate() });
  const { data: topCoins = [] } = useQuery({ queryKey: ['portfolio-top-coins'], queryFn: () => marketApi.getTopCoins(250), staleTime: 60_000 });

  const { data: connections = [] } = useQuery({
    queryKey: ['portfolio-connections-local', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('exchange_connections').select('id, exchange, last_synced_at, created_at').eq('user_id', profile?.id);
      if (error) throw new Error(error.message);
      return (data ?? []) as ExchangeConnectionRow[];
    },
    retry: false,
  });

  const activeConnection = useMemo(
    () => connections.find((connection) => SUPPORTED_LIVE_EXCHANGES.includes(connection.exchange as 'binance' | 'bybit')) ?? null,
    [connections]
  );

  const { data: liveData, isFetching: syncing, refetch: refetchLiveData } = useQuery({
    queryKey: ['portfolio-live-data', profile?.id, activeConnection?.exchange],
    enabled: !!profile?.id && activeConnection?.exchange === 'binance',
    queryFn: async () => {
      const keys = await getDecryptedKeys(profile!.id);
      if (!keys) return { balances: [] as ConnectedBalance[], trades: [] as ConnectedTrade[] };
      const [balances, trades] = await Promise.all([getAccountBalance(keys.apiKey, keys.apiSecret), getTradeHistory(keys.apiKey, keys.apiSecret)]);
      await updateLastSynced(profile!.id);
      return { balances, trades };
    },
    staleTime: 120_000,
    retry: false,
  });

  const searchResults = useQuery({
    queryKey: ['portfolio-search', searchTerm],
    enabled: searchTerm.trim().length >= 2 && !selectedCoin,
    queryFn: () => marketApi.search(searchTerm.trim()),
    staleTime: 30_000,
  });

  const selectedCoinQuery = useQuery({
    queryKey: ['portfolio-selected-coin', selectedCoin?.id],
    enabled: !!selectedCoin?.id,
    queryFn: () => marketApi.getCoin(selectedCoin!.id),
  });

  const manualCoinQueries = useQueries({
    queries: Array.from(new Set(manualPositions.map((position) => position.coinId))).map((coinId) => ({
      queryKey: ['portfolio-coin', coinId],
      queryFn: () => marketApi.getCoin(coinId),
      staleTime: 60_000,
    })),
  });

  const manualCoinMap = useMemo(() => {
    const map = new Map<string, CoinData>();
    manualCoinQueries.forEach((query) => { if (query.data) map.set(query.data.id, query.data); });
    return map;
  }, [manualCoinQueries]);

  const positions = useMemo<PortfolioRow[]>(() => {
    if (activeConnection) {
      const balances = liveData?.balances ?? []; const trades = liveData?.trades ?? [];
      const rows = balances.map((balance) => {
        const symbol = balance.coin.toUpperCase();
        const quantity = balance.free + balance.locked;
        const marketCoin = topCoins.find((coin) => coin.symbol.toUpperCase() === symbol);
        const buyTrades = trades.filter((trade) => trade.side === 'BUY' && trade.coin.toUpperCase() === symbol);
        const totalBoughtQty = buyTrades.reduce((sum, trade) => sum + trade.qty, 0);
        const totalBoughtCost = buyTrades.reduce((sum, trade) => sum + trade.quoteQty, 0);
        const averageBuyPrice = totalBoughtQty > 0 ? totalBoughtCost / totalBoughtQty : marketCoin?.current_price ?? (quantity > 0 ? balance.valueUSD / quantity : 0);
        const currentPrice = marketCoin?.current_price ?? (quantity > 0 ? balance.valueUSD / quantity : 0);
        const currentValueUsd = quantity * currentPrice || balance.valueUSD;
        const pnlUsd = currentValueUsd - quantity * averageBuyPrice;
        const change24hPct = marketCoin?.price_change_percentage_24h ?? 0;
        return {
          id: `live-${symbol}`, coinId: marketCoin?.id ?? symbol.toLowerCase(), coinName: marketCoin?.name ?? symbol, coinSymbol: symbol,
          image: marketCoin?.image ?? `https://placehold.co/40x40/0f172a/e2e8f0?text=${symbol.slice(0, 1)}`, quantity, averageBuyPrice, currentPrice,
          currentValueUsd, currentValueGhs: currentValueUsd * ghsRate, pnlUsd, pnlGhs: pnlUsd * ghsRate,
          pnlPct: averageBuyPrice > 0 ? ((currentPrice - averageBuyPrice) / averageBuyPrice) * 100 : 0,
          change24hUsd: currentValueUsd * (change24hPct / 100), change24hGhs: currentValueUsd * (change24hPct / 100) * ghsRate, change24hPct,
          allocationPct: 0, sparkline: marketCoin?.sparkline_in_7d?.price ?? [], live: true, aiNote: '',
        };
      });
      const total = rows.reduce((sum, row) => sum + row.currentValueUsd, 0);
      return rows.map((row) => ({ ...row, allocationPct: total > 0 ? (row.currentValueUsd / total) * 100 : 0 })).map((row) => ({ ...row, aiNote: buildPositionNote(row) }));
    }

    const rows = manualPositions.map((position) => {
      const coin = manualCoinMap.get(position.coinId);
      const currentPrice = coin?.current_price ?? position.averageBuyPrice;
      const currentValueUsd = position.amountOwned * currentPrice;
      const pnlUsd = currentValueUsd - position.amountOwned * position.averageBuyPrice;
      const change24hPct = coin?.price_change_percentage_24h ?? 0;
      return {
        id: position.id, coinId: position.coinId, coinName: position.coinName, coinSymbol: position.coinSymbol, image: coin?.image ?? position.image,
        quantity: position.amountOwned, averageBuyPrice: position.averageBuyPrice, currentPrice, currentValueUsd, currentValueGhs: currentValueUsd * ghsRate,
        pnlUsd, pnlGhs: pnlUsd * ghsRate, pnlPct: position.averageBuyPrice > 0 ? ((currentPrice - position.averageBuyPrice) / position.averageBuyPrice) * 100 : 0,
        change24hUsd: currentValueUsd * (change24hPct / 100), change24hGhs: currentValueUsd * (change24hPct / 100) * ghsRate, change24hPct,
        allocationPct: 0, sparkline: coin?.sparkline_in_7d?.price ?? [], openedAt: position.openedAt, live: false, aiNote: '',
      };
    });
    const total = rows.reduce((sum, row) => sum + row.currentValueUsd, 0);
    return rows.map((row) => ({ ...row, allocationPct: total > 0 ? (row.currentValueUsd / total) * 100 : 0 })).map((row) => ({ ...row, aiNote: buildPositionNote(row) }));
  }, [activeConnection, ghsRate, liveData?.balances, liveData?.trades, manualCoinMap, manualPositions, topCoins]);

  const sortedPositions = useMemo(() => [...positions].sort((left, right) => {
    const delta = getSortValue(left, sortKey) - getSortValue(right, sortKey);
    return sortDirection === 'asc' ? delta : -delta;
  }), [positions, sortDirection, sortKey]);

  const summary = useMemo(() => {
    const totalValueUsd = positions.reduce((sum, row) => sum + row.currentValueUsd, 0);
    const totalPnlUsd = positions.reduce((sum, row) => sum + row.pnlUsd, 0);
    const totalChange24hUsd = positions.reduce((sum, row) => sum + row.change24hUsd, 0);
    const totalCostBasis = totalValueUsd - totalPnlUsd;
    const meta = buildInsights(positions, liveData?.trades ?? []);
    return {
      totalValueUsd, totalValueGhs: totalValueUsd * ghsRate, totalPnlUsd, totalPnlGhs: totalPnlUsd * ghsRate,
      totalPnlPct: totalCostBasis > 0 ? (totalPnlUsd / totalCostBasis) * 100 : 0,
      totalChange24hUsd, totalChange24hGhs: totalChange24hUsd * ghsRate, change24hPct: totalValueUsd > 0 ? (totalChange24hUsd / totalValueUsd) * 100 : 0,
      ...meta,
    };
  }, [ghsRate, liveData?.trades, positions]);

  const handleDisconnect = async () => {
    if (!profile?.id) return;
    try {
      await deleteExchangeConnection(profile.id);
      queryClient.invalidateQueries({ queryKey: ['portfolio-connections-local'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-live-data'] });
      toast.success('Binance disconnected.');
    } catch {
      toast.error('Failed to disconnect.');
    }
  };

  const handleConnected = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolio-connections-local'] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-live-data'] });
    toast.success('Binance connected! Syncing your portfolio…');
  };

  const addManualPosition = () => {
    if (!selectedCoin || !selectedCoinQuery.data) return;
    const amount = Number(amountOwned); const avgBuy = Number(averageBuyPrice);
    if (amount <= 0 || avgBuy <= 0) return;
    setManualPositions((current) => [{ id: crypto.randomUUID(), coinId: selectedCoin.id, coinName: selectedCoin.name, coinSymbol: selectedCoin.symbol.toUpperCase(), image: selectedCoinQuery.data.image, amountOwned: amount, averageBuyPrice: avgBuy, openedAt }, ...current]);
    setIsAddOpen(false); setSelectedCoin(null); setSearchTerm(''); setAmountOwned(''); setAverageBuyPrice(''); setOpenedAt(new Date().toISOString().slice(0, 10));
  };

  const toggleSort = (nextKey: SortKey) => sortKey === nextKey ? setSortDirection((current) => current === 'desc' ? 'asc' : 'desc') : (setSortKey(nextKey), setSortDirection('desc'));
  const deleteManualPosition = (id: string) => setManualPositions((current) => current.filter((position) => position.id !== id));
  const isConnectedMode = Boolean(activeConnection);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 pb-20 md:px-6 md:pb-8">

      {/* Connect Binance modal */}
      {isConnectOpen && profile?.id && (
        <ConnectBinanceModal
          userId={profile.id}
          onConnected={handleConnected}
          onClose={() => setIsConnectOpen(false)}
        />
      )}

      {/* ── Binance Connect Banner (shown when not connected) ── */}
      {!isConnectedMode && (
        <div className="rounded-2xl border border-[#F0B90B]/30 bg-[#F0B90B]/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0B90B]/20">
            <span className="text-xl font-extrabold text-[#F0B90B]">B</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-100">Connect your Binance account</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Link your Binance read-only API to auto-sync your holdings, trade history, and get AI analysis of your real portfolio.
            </p>
          </div>
          <button
            onClick={() => setIsConnectOpen(true)}
            className="shrink-0 flex items-center gap-2 rounded-xl bg-[#F0B90B] px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-[#F0B90B]/90"
          >
            <Link2 size={15} /> Connect Binance
          </button>
        </div>
      )}

      {/* ── Disconnect button (shown when connected) ── */}
      {isConnectedMode && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0B90B]/20">
              <span className="text-sm font-extrabold text-[#F0B90B]">B</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Binance Connected</p>
              <p className="text-xs text-slate-500">Live portfolio sync active</p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
          >
            <Unlink size={12} /> Disconnect
          </button>
        </div>
      )}

      <section className="rounded-3xl border border-[#1E3050] bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_32%),linear-gradient(180deg,_rgba(13,21,38,0.98),_rgba(7,12,24,0.98))] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200"><Wallet size={14} />{isConnectedMode ? 'Connected Portfolio' : 'Manual Portfolio'}</div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">Track positions, allocation, and behavior in one place.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Manual portfolios persist per user, while connected Binance portfolios auto-sync live balances. Both modes include summary metrics, allocation, and position-level coaching.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:w-[30rem]">
            <SummaryCard title="Total Value" value={formatPrice(summary.totalValueUsd, 'USD')} sub={formatGHS(summary.totalValueGhs)} />
            <SummaryCard title="Portfolio P&L" value={formatPct(summary.totalPnlPct)} sub={`${formatPrice(summary.totalPnlUsd, 'USD')} · ${formatGHS(summary.totalPnlGhs)}`} tone={summary.totalPnlUsd >= 0 ? 'text-green-300' : 'text-red-300'} />
            <SummaryCard title="Health Score" value={`${summary.healthScore}/100`} sub={`${summary.diversificationRating} diversification`} tone="text-cyan-200" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2 text-slate-100"><BarChart3 size={18} className="text-cyan-300" /><h2 className="text-lg font-semibold">Portfolio Summary</h2></div><p className="mt-1 text-sm text-slate-400">{isConnectedMode ? `Auto-synced from ${activeConnection?.exchange?.toUpperCase()}.` : 'Manually managed positions stored on this account.'}</p></div>
            <div className="flex flex-wrap items-center gap-2">{isConnectedMode ? <><div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">Live Sync</div><Button variant="secondary" size="sm" loading={syncing} onClick={() => refetchLiveData()}><RefreshCw size={14} />Refresh</Button></> : <Button size="sm" onClick={() => setIsAddOpen(true)}><Plus size={14} />Add Position</Button>}</div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Total value" value={formatPrice(summary.totalValueUsd, 'USD')} sub={formatGHS(summary.totalValueGhs)} />
            <SummaryCard title="Total P&L" value={formatPrice(summary.totalPnlUsd, 'USD')} sub={`${formatGHS(summary.totalPnlGhs)} · ${formatPct(summary.totalPnlPct)}`} tone={summary.totalPnlUsd >= 0 ? 'text-green-300' : 'text-red-300'} />
            <SummaryCard title="24h change" value={formatPrice(summary.totalChange24hUsd, 'USD')} sub={`${formatGHS(summary.totalChange24hGhs)} · ${formatPct(summary.change24hPct)}`} tone={summary.totalChange24hUsd >= 0 ? 'text-green-300' : 'text-red-300'} />
            <SummaryCard title="Health score" value={`${summary.healthScore}/100`} sub={summary.diversificationRating} tone="text-cyan-200" />
          </div>
          {isConnectedMode && <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400"><div className="inline-flex items-center gap-1.5 rounded-full border border-[#1E3050] bg-[#08111F] px-3 py-1"><Clock3 size={12} />{activeConnection?.last_synced_at ? `Last sync ${timeAgo(activeConnection.last_synced_at)}` : 'Not synced yet'}</div>{activeConnection?.exchange !== 'binance' && <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-200"><AlertTriangle size={12} />Live parsing is currently optimized for Binance.</div>}</div>}
        </div>

        <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
          <div className="flex items-center gap-2"><Sparkles size={18} className="text-emerald-300" /><h2 className="text-lg font-semibold text-slate-100">Allocation Breakdown</h2></div>
          <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={positions} dataKey="currentValueUsd" nameKey="coinSymbol" innerRadius={72} outerRadius={108} paddingAngle={3}>{positions.map((position, index) => <Cell key={position.id} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const row = payload[0]?.payload as PortfolioRow; return <div className="rounded-xl border border-[#223556] bg-[#07101D] px-4 py-3 shadow-2xl"><p className="text-sm font-semibold text-slate-100">{row.coinName}</p><p className="text-xs text-slate-300">{row.allocationPct.toFixed(1)}% allocation</p><p className="mt-1 text-xs text-slate-400">{formatPrice(row.currentValueUsd, 'USD')} · {formatGHS(row.currentValueGhs)}</p></div>; }} /></PieChart></ResponsiveContainer></div>
          <div className="grid gap-3 sm:grid-cols-2">{positions.slice(0, 6).map((position, index) => <div key={position.id} className="flex items-center gap-3 rounded-2xl border border-[#1E3050] bg-[#08111F] px-4 py-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} /><img src={position.image} alt={position.coinName} className="h-8 w-8 rounded-full" /><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{position.coinName}</p><p className="text-xs text-slate-400">{position.coinSymbol}</p></div><span className="ml-auto text-sm font-semibold text-slate-100">{position.allocationPct.toFixed(1)}%</span></div>)}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
        <div className="flex items-center gap-2"><Brain size={18} className="text-cyan-300" /><h2 className="text-lg font-semibold text-slate-100">AI Portfolio Analysis</h2></div>
        {!isPro ? <div className="mt-5 rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/10 to-cyan-500/10 p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="text-lg font-semibold text-slate-100">Pro unlocks behavioral insights, coaching, and diversification analysis.</p><p className="mt-2 text-sm leading-6 text-slate-300">Free users can track positions, performance, and allocation, but AI portfolio analysis stays locked until you upgrade.</p></div><Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"><Sparkles size={16} />Upgrade to Pro</Link></div></div> : <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><div className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{summary.insights.map((insight) => <div key={insight.title} className={`rounded-2xl border p-4 ${insight.tone === 'positive' ? 'border-green-500/20 bg-green-500/10' : insight.tone === 'warning' ? 'border-amber-500/20 bg-amber-500/10' : 'border-[#1E3050] bg-[#08111F]'}`}><p className="text-sm font-semibold text-slate-100">{insight.title}</p><p className="mt-2 text-sm leading-6 text-slate-300">{insight.body}</p></div>)}</div><div className="rounded-2xl border border-[#1E3050] bg-[#08111F] p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Coaching tips</p><div className="mt-3 space-y-3">{summary.coachingTips.map((tip) => <div key={tip} className="flex items-start gap-3"><Shield size={14} className="mt-1 flex-shrink-0 text-cyan-300" /><p className="text-sm leading-6 text-slate-300">{tip}</p></div>)}</div></div></div><div className="rounded-2xl border border-[#1E3050] bg-[#08111F] p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Diversification rating</p><p className="mt-2 text-3xl font-semibold text-slate-50">{summary.diversificationRating}</p><p className="mt-3 text-sm leading-6 text-slate-300">{summary.diversificationMessage}</p></div></div>}
      </section>

      <section className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-100">Positions</h2><p className="mt-1 text-sm text-slate-400">Sort by value, total P&amp;L, or 24h change. Expand any row for a mini chart and position note.</p></div><div className="flex flex-wrap gap-2">{([{ key: 'value', label: 'Value' }, { key: 'pnl', label: 'P&L' }, { key: 'change24h', label: '24h Change' }] as { key: SortKey; label: string }[]).map((option) => <button key={option.key} type="button" onClick={() => toggleSort(option.key)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${sortKey === option.key ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-[#1E3050] bg-[#08111F] text-slate-400'}`}>{option.label}{sortKey === option.key && (sortDirection === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}</button>)}</div></div>
        {sortedPositions.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#1E3050] bg-[#08111F] px-6 py-14 text-center"><Wallet size={36} className="mx-auto text-slate-500" /><p className="mt-4 text-lg font-semibold text-slate-100">No positions yet</p><p className="mt-2 text-sm text-slate-400">{isConnectedMode ? 'Connect a supported exchange with live balances or refresh to sync positions.' : 'Add your first manual holding to start tracking value, P&L, and allocation.'}</p>{!isConnectedMode && <Button className="mt-5" onClick={() => setIsAddOpen(true)}><Plus size={14} />Add Position</Button>}</div> : <div className="mt-6 overflow-hidden rounded-2xl border border-[#1E3050]">{sortedPositions.map((row) => { const expanded = expandedRowId === row.id; return <div key={row.id} className={`border-t border-[#1E3050] first:border-t-0 ${toRowTone(row)}`}><div className="grid gap-4 px-4 py-4 lg:grid-cols-[2.2fr_0.9fr_1fr_1fr_1.1fr_1.1fr_0.9fr_0.6fr] lg:items-center"><div className="flex items-center gap-3"><img src={row.image} alt={row.coinName} className="h-10 w-10 rounded-full border border-white/10" /><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-100">{row.coinName}</p>{row.live && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200">Live</span>}</div><p className="text-xs uppercase tracking-[0.12em] text-slate-400">{row.coinSymbol}</p></div></div><div><p className="text-xs text-slate-500 lg:hidden">Amount</p><p className="text-sm font-medium text-slate-100">{row.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p></div><div><p className="text-xs text-slate-500 lg:hidden">Avg Buy</p><p className="text-sm font-medium text-slate-100">{formatPrice(row.averageBuyPrice, 'USD')}</p></div><div><p className="text-xs text-slate-500 lg:hidden">Current</p><p className="text-sm font-medium text-slate-100">{formatPrice(row.currentPrice, 'USD')}</p></div><div><p className="text-xs text-slate-500 lg:hidden">Value</p><p className="text-sm font-medium text-slate-100">{formatPrice(row.currentValueUsd, 'USD')}</p><p className="text-xs text-slate-400">{formatGHS(row.currentValueGhs)}</p></div><div><p className="text-xs text-slate-500 lg:hidden">P&amp;L</p><p className={`text-sm font-semibold ${row.pnlUsd >= 0 ? 'text-green-300' : 'text-red-300'}`}>{formatPrice(row.pnlUsd, 'USD')}</p><p className={`text-xs ${row.pnlUsd >= 0 ? 'text-green-200/80' : 'text-red-200/80'}`}>{formatGHS(row.pnlGhs)} · {formatPct(row.pnlPct)}</p></div><div><p className="text-xs text-slate-500 lg:hidden">24h</p><p className={`text-sm font-semibold ${row.change24hUsd >= 0 ? 'text-green-300' : 'text-red-300'}`}>{formatPrice(row.change24hUsd, 'USD')}</p><p className={`text-xs ${row.change24hUsd >= 0 ? 'text-green-200/80' : 'text-red-200/80'}`}>{formatGHS(row.change24hGhs)} · {formatPct(row.change24hPct)}</p></div><div className="flex items-center justify-end gap-2">{!row.live && <button type="button" onClick={() => deleteManualPosition(row.id)} className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/15">Remove</button>}<button type="button" onClick={() => setExpandedRowId((current) => current === row.id ? null : row.id)} className="rounded-lg border border-[#1E3050] bg-[#08111F] p-2 text-slate-300 transition hover:text-white">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div></div>{expanded && <div className="border-t border-[#1E3050] bg-[#08111F] px-4 py-4"><div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"><div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Mini Chart</p><div className="mt-3 h-16">{row.sparkline.length > 0 ? <SparklineChart data={row.sparkline} positive={row.change24hPct >= 0} /> : <div className="flex h-full items-center justify-center text-xs text-slate-500">Chart not available</div>}</div></div><div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">AI Note</p><p className="mt-3 text-sm leading-6 text-slate-300">{row.aiNote}</p></div></div></div>}</div>; })}</div>}
      </section>

      <Modal open={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Manual Position"><div className="space-y-4"><div><label className="mb-2 block text-sm font-medium text-slate-300">Coin</label><input value={selectedCoin ? `${selectedCoin.name} (${selectedCoin.symbol})` : searchTerm} onChange={(event) => { setSelectedCoin(null); setSearchTerm(event.target.value); }} placeholder="Search by coin name or symbol" className="w-full rounded-xl border border-[#1E3050] bg-[#08111F] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-brand" />{!selectedCoin && searchResults.data && searchResults.data.length > 0 && <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-[#1E3050] bg-[#08111F]">{searchResults.data.slice(0, 8).map((coin) => <button key={coin.id} type="button" onClick={() => { setSelectedCoin(coin); setSearchTerm(coin.name); }} className="flex w-full items-center gap-3 border-b border-[#1E3050] px-3 py-2.5 text-left transition hover:bg-white/5 last:border-b-0"><img src={coin.thumb} alt={coin.name} className="h-6 w-6 rounded-full" /><div><p className="text-sm font-medium text-slate-100">{coin.name}</p><p className="text-xs uppercase tracking-[0.12em] text-slate-400">{coin.symbol}</p></div></button>)}</div>}</div><div className="grid gap-4 sm:grid-cols-2"><Input label="Amount Owned" type="number" min="0" step="any" value={amountOwned} onChange={(event) => setAmountOwned(event.target.value)} /><Input label="Average Buy Price (USD)" type="number" min="0" step="any" value={averageBuyPrice} onChange={(event) => setAverageBuyPrice(event.target.value)} /></div><Input label="Date Opened" type="date" value={openedAt} onChange={(event) => setOpenedAt(event.target.value)} />{selectedCoinQuery.data && selectedCoin && <div className="rounded-2xl border border-[#1E3050] bg-[#08111F] p-4 text-sm text-slate-300"><p className="font-medium text-slate-100">{selectedCoin.name}</p><p className="mt-1">Current price: {formatPrice(selectedCoinQuery.data.current_price, 'USD')}</p><p className="text-xs text-slate-400">{formatPct(selectedCoinQuery.data.price_change_percentage_24h ?? 0)} over 24h</p></div>}<div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button onClick={addManualPosition} disabled={!selectedCoin || !amountOwned || !averageBuyPrice || selectedCoinQuery.isLoading}>{selectedCoinQuery.isLoading && <Loader2 size={14} className="animate-spin" />}Add Position</Button></div></div></Modal>
    </div>
  );
}
