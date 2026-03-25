import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  BellRing,
  ChevronRight,
  Loader2,
  Mail,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAlerts } from '@/hooks/useAlerts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { marketApi } from '@/lib/api';
import { formatGHS, formatPct, formatPrice, timeAgo } from '@/lib/utils';
import type { CoinSearchResult, PriceAlert } from '@/types';

type CurrencyToggle = 'USD' | 'GHS';
type NotificationMethod = 'in_app' | 'email';

function formatAlertCondition(alert: PriceAlert) {
  const priceLabel = alert.threshold_currency === 'GHS'
    ? formatGHS(alert.display_threshold ?? alert.threshold)
    : formatPrice(alert.display_threshold ?? alert.threshold, 'USD');

  return `${alert.coin_symbol.toUpperCase()} ${alert.condition === 'above' ? 'above' : 'below'} ${priceLabel}`;
}

function distanceToTarget(currentPrice: number, targetPrice: number, condition: 'above' | 'below') {
  if (targetPrice <= 0 || currentPrice <= 0) return 0;
  const raw = condition === 'above'
    ? ((targetPrice - currentPrice) / currentPrice) * 100
    : ((currentPrice - targetPrice) / currentPrice) * 100;
  return Number.isFinite(raw) ? raw : 0;
}

export default function AlertsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { permission: pushPermission, requestPermission: requestPush, isSupported: pushSupported } = usePushNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(null);
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [currency, setCurrency] = useState<CurrencyToggle>('USD');
  const [targetPrice, setTargetPrice] = useState('');
  const [notificationMethods, setNotificationMethods] = useState<NotificationMethod[]>(['in_app']);

  const { alerts, isLoading, createAlert, deleteAlert, isCreating } = useAlerts();
  const { data: ghsRate = 15.5 } = useQuery({
    queryKey: ['ghs-rate'],
    queryFn: () => marketApi.getGhsRate(),
    staleTime: 300_000,
  });

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['alerts-search', searchTerm],
    queryFn: () => marketApi.search(searchTerm.trim()),
    enabled: searchTerm.trim().length >= 2 && !selectedCoin,
    staleTime: 30_000,
  });

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.is_active && !alert.triggered_at),
    [alerts],
  );

  const triggeredAlerts = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return alerts
      .filter((alert) => alert.triggered_at && new Date(alert.triggered_at).getTime() >= cutoff)
      .sort((left, right) => new Date(right.triggered_at ?? 0).getTime() - new Date(left.triggered_at ?? 0).getTime());
  }, [alerts]);

  const uniqueActiveCoinIds = useMemo(
    () => [...new Set(activeAlerts.map((alert) => alert.coin_id))],
    [activeAlerts],
  );

  const priceQueries = useQueries({
    queries: uniqueActiveCoinIds.map((coinId) => ({
      queryKey: ['alert-coin-price', coinId],
      queryFn: () => marketApi.getCoin(coinId),
      staleTime: 60_000,
    })),
  });

  const priceMap = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof marketApi.getCoin>>>();
    priceQueries.forEach((query) => {
      if (query.data) map.set(query.data.id, query.data);
    });
    return map;
  }, [priceQueries]);

  // All users have unlimited alerts — no free tier limit
  const freeLimitReached = false;

  const resetForm = () => {
    setSearchTerm('');
    setSelectedCoin(null);
    setDirection('above');
    setCurrency('USD');
    setTargetPrice('');
    setNotificationMethods(['in_app']);
  };

  const toggleNotificationMethod = (method: NotificationMethod) => {
    setNotificationMethods((current) => {
      if (current.includes(method)) {
        const next = current.filter((item) => item !== method);
        return next.length > 0 ? next : ['in_app'];
      }
      return [...current, method];
    });
  };

  const handleCreateAlert = async () => {
    if (!selectedCoin) return;

    const parsedTarget = Number(targetPrice);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) return;

    const thresholdInUsd = currency === 'USD' ? parsedTarget : parsedTarget / ghsRate;

    await createAlert({
      coin_id: selectedCoin.id,
      coin_symbol: selectedCoin.symbol.toUpperCase(),
      condition: direction,
      threshold: thresholdInUsd,
      threshold_currency: currency,
      display_threshold: parsedTarget,
      notification_methods: notificationMethods,
    });

    setIsCreateOpen(false);
    resetForm();
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 pb-20 md:px-6 md:pb-8">
      <section className="rounded-3xl border border-[#1E3050] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_35%),linear-gradient(180deg,_rgba(13,21,38,0.98),_rgba(7,12,24,0.98))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              <Bell size={14} />
              Price Alerts
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Track breakout prices and get nudged the moment they hit.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Create coin alerts in USD or GHS, watch live distance to target, and review every trigger from the last 30 days.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-2xl border border-[#1E3050] bg-[#08111F] p-4 sm:min-w-80">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notifications</p>
            <p className="text-sm text-slate-300">
              Unlimited active alerts. Get in-app, email, and browser push notifications when your alerts trigger.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus size={15} />
                Create Alert
              </Button>

              {/* Push notification permission button */}
              {pushSupported && pushPermission === 'default' && (
                <button
                  type="button"
                  onClick={() => void requestPush()}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/15"
                >
                  <BellRing size={15} />
                  Enable Push Alerts
                </button>
              )}
              {pushSupported && pushPermission === 'granted' && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-2 text-xs font-medium text-green-400">
                  <Bell size={12} /> Push alerts on
                </span>
              )}
              {pushSupported && pushPermission === 'denied' && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600/30 bg-slate-600/10 px-3 py-2 text-xs text-slate-500" title="Push notifications are blocked in your browser settings">
                  <BellOff size={12} /> Push blocked in browser
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Active Alerts</h2>
              <p className="mt-1 text-sm text-slate-400">See what is still pending and how close each alert is to firing.</p>
            </div>
            <div className="rounded-full border border-[#1E3050] bg-[#08111F] px-3 py-1 text-xs font-medium text-slate-300">
              {activeAlerts.length} active
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-2xl border border-[#1E3050] bg-[#08111F]" />
              ))}
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#1E3050] bg-[#08111F] px-6 py-14 text-center">
              <Bell size={34} className="mx-auto text-slate-500" />
              <p className="mt-4 text-lg font-semibold text-slate-100">No active alerts yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Create your first alert to track breakouts and dips automatically.
              </p>
              <Button className="mt-5" onClick={() => setIsCreateOpen(true)} disabled={freeLimitReached}>
                <Plus size={15} />
                Create Alert
              </Button>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-[#1E3050]">
              {activeAlerts.map((alert) => {
                const coin = priceMap.get(alert.coin_id);
                const currentPrice = coin?.current_price;
                const distancePct = currentPrice != null
                  ? distanceToTarget(currentPrice, alert.threshold, alert.condition as 'above' | 'below')
                  : null;

                return (
                  <div key={alert.id} className="grid gap-4 border-t border-[#1E3050] bg-[#08111F] px-4 py-4 first:border-t-0 lg:grid-cols-[1.5fr_1.2fr_1fr_1fr_0.5fr] lg:items-center">
                    <div className="flex items-center gap-3">
                      <img
                        src={coin?.image ?? `https://placehold.co/40x40/0f172a/e2e8f0?text=${alert.coin_symbol.slice(0, 1)}`}
                        alt={alert.coin_symbol}
                        className="h-10 w-10 rounded-full border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100">{formatAlertCondition(alert)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{alert.coin_symbol}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Current price</p>
                      {coin ? (
                        <>
                          <p className="text-sm font-medium text-slate-100">{formatPrice(currentPrice ?? 0, 'USD')}</p>
                          <p className="text-xs text-slate-400">{formatGHS((currentPrice ?? 0) * ghsRate)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">Loading...</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Distance to target</p>
                      <p className={`text-sm font-semibold ${distancePct != null && distancePct <= 5 ? 'text-amber-300' : 'text-slate-100'}`}>
                        {distancePct == null ? 'Calculating...' : formatPct(Math.max(distancePct, 0), false)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Notifications</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(alert.notification_methods ?? ['in_app']).map((method) => (
                          <span
                            key={method}
                            className="rounded-full border border-[#1E3050] bg-[#0D1526] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300"
                          >
                            {method === 'in_app' ? 'In-App' : 'Email'}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void deleteAlert(alert.id)}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-red-200 transition hover:bg-red-500/15"
                        aria-label={`Delete ${alert.coin_symbol} alert`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-[#1E3050] bg-[#0D1526] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Triggered in Last 30 Days</h2>
              <p className="mt-1 text-sm text-slate-400">A clean audit trail of every alert that already fired.</p>
            </div>
            <div className="rounded-full border border-[#1E3050] bg-[#08111F] px-3 py-1 text-xs font-medium text-slate-300">
              {triggeredAlerts.length} triggered
            </div>
          </div>

          {triggeredAlerts.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#1E3050] bg-[#08111F] px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-200">No triggered alerts yet.</p>
              <p className="mt-2 text-sm text-slate-400">Once an alert fires, it will stay here for 30 days.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {triggeredAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-[#1E3050] bg-[#08111F] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{formatAlertCondition(alert)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{alert.coin_symbol}</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200">
                      Triggered
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Triggered at price</p>
                      <p className="text-sm font-medium text-slate-100">
                        {alert.triggered_price != null ? formatPrice(alert.triggered_price, 'USD') : 'Unavailable'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Triggered at time</p>
                      <p className="text-sm font-medium text-slate-100">
                        {alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : 'Unavailable'}
                      </p>
                      {alert.triggered_at && (
                        <p className="mt-1 text-xs text-slate-400">{timeAgo(alert.triggered_at)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Modal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetForm(); }} title="Create Price Alert">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Search coin</label>
            <div className="relative">
              <Input
                value={selectedCoin ? `${selectedCoin.name} (${selectedCoin.symbol.toUpperCase()})` : searchTerm}
                onChange={(event) => {
                  setSelectedCoin(null);
                  setSearchTerm(event.target.value);
                }}
                placeholder="Type BTC, Bitcoin, ETH..."
                prefix={<Search size={15} />}
              />
              {!selectedCoin && searchTerm.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-auto rounded-2xl border border-[#1E3050] bg-[#08111F] shadow-2xl">
                  {isSearching ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                      <Loader2 size={15} className="animate-spin" />
                      Searching coins...
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.slice(0, 8).map((coin) => (
                      <button
                        key={coin.id}
                        type="button"
                        onClick={() => {
                          setSelectedCoin(coin);
                          setSearchTerm(coin.name);
                        }}
                        className="flex w-full items-center gap-3 border-b border-[#1E3050] px-4 py-3 text-left transition hover:bg-white/5 last:border-b-0"
                      >
                        <img src={coin.thumb} alt={coin.name} className="h-7 w-7 rounded-full" />
                        <div>
                          <p className="text-sm font-medium text-slate-100">{coin.name}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{coin.symbol}</p>
                        </div>
                        <ChevronRight size={14} className="ml-auto text-slate-500" />
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-400">No matching coins found.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'above', label: 'Price goes above' },
                { value: 'below', label: 'Price goes below' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDirection(option.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    direction === option.value
                      ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                      : 'border-[#1E3050] bg-[#08111F] text-slate-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-slate-300">Target price</label>
              <div className="flex rounded-xl border border-[#1E3050] bg-[#08111F] p-1">
                {(['USD', 'GHS'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCurrency(option)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      currency === option
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              min="0"
              step="any"
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
              placeholder={currency === 'USD' ? '95000' : '1450000'}
            />
            <p className="mt-2 text-xs text-slate-500">
              Alerts are checked against live USD prices every 60 seconds and converted automatically when you set a GHS target.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Notification methods</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { value: 'in_app', label: 'In-app', icon: Bell, note: 'Shows a toast and opens the coin page when clicked.' },
                { value: 'email', label: 'Email', icon: Mail, note: 'Sends a matching email when the alert triggers.' },
              ] as const).map((option) => {
                const Icon = option.icon;
                const disabled = false;
                const selected = notificationMethods.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleNotificationMethod(option.value)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      selected
                        ? 'border-cyan-400/30 bg-cyan-400/10'
                        : 'border-[#1E3050] bg-[#08111F]'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={15} className={selected ? 'text-cyan-200' : 'text-slate-400'} />
                      <p className="text-sm font-medium text-slate-100">{option.label}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{option.note}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateAlert()}
              loading={isCreating}
              disabled={!selectedCoin || !targetPrice || freeLimitReached}
            >
              Create Alert
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
