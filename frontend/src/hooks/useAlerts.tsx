import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BellRing, Mail } from 'lucide-react';
import { alertsApi, marketApi } from '@/lib/api';
import { formatGHS, formatPrice } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAlertsStore } from '@/store/alertsStore';
import { useAuthStore } from '@/store/authStore';
import { usePushNotifications } from './usePushNotifications';
import type { PriceAlert } from '@/types';

type NotificationMethod = 'in_app' | 'email';

interface CreateAlertInput {
  coin_id: string;
  coin_symbol: string;
  condition: 'above' | 'below';
  threshold: number;
  threshold_currency?: 'USD' | 'GHS';
  display_threshold?: number;
  notification_methods?: NotificationMethod[];
}

interface UseAlertsOptions {
  enabled?: boolean;
}

function getAlertTargetLabel(alert: PriceAlert) {
  const currency = alert.threshold_currency ?? 'USD';
  const displayThreshold = alert.display_threshold ?? alert.threshold;
  return currency === 'GHS'
    ? formatGHS(displayThreshold)
    : formatPrice(displayThreshold, 'USD');
}

function buildToastMessage(alert: PriceAlert, currentPrice: number, ghsRate: number) {
  const symbol = alert.coin_symbol.toUpperCase();
  const targetLabel = getAlertTargetLabel(alert);
  const action = alert.condition === 'above' ? 'crossed above' : 'dropped below';
  return {
    title: `${symbol} just ${action} ${targetLabel}!`,
    subtitle: `${formatPrice(currentPrice, 'USD')} · ${formatGHS(currentPrice * ghsRate)}`,
  };
}

async function sendAlertEmail(alert: PriceAlert, currentPrice: number, email: string, ghsRate: number) {
  if (!alert.notification_methods?.includes('email')) return;

  await supabase.functions.invoke('send-alert-email', {
    body: {
      email,
      coinId: alert.coin_id,
      coinSymbol: alert.coin_symbol.toUpperCase(),
      condition: alert.condition,
      target: getAlertTargetLabel(alert),
      currentPriceUsd: formatPrice(currentPrice, 'USD'),
      currentPriceGhs: formatGHS(currentPrice * ghsRate),
      triggeredAt: new Date().toISOString(),
    },
  });
}

export function useAlerts({ enabled = true }: UseAlertsOptions = {}) {
  const queryClient = useQueryClient();
  const setAlerts = useAlertsStore((state) => state.setAlerts);
  const addAlert = useAlertsStore((state) => state.addAlert);
  const removeAlert = useAlertsStore((state) => state.removeAlert);
  const alerts = useAlertsStore((state) => state.alerts);

  const alertsQuery = useQuery<PriceAlert[]>({
    queryKey: ['alerts'],
    queryFn: alertsApi.getAlerts,
    enabled,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (alertsQuery.data) setAlerts(alertsQuery.data);
  }, [alertsQuery.data, setAlerts]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateAlertInput) => alertsApi.createAlert(payload),
    onSuccess: (createdAlert: PriceAlert) => {
      addAlert(createdAlert);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => alertsApi.deleteAlert(id),
    onSuccess: (_, id) => {
      removeAlert(id);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  return {
    ...alertsQuery,
    alerts: alertsQuery.data ?? alerts,
    createAlert: createMutation.mutateAsync,
    deleteAlert: deleteMutation.mutateAsync,
    getAlerts: alertsQuery.refetch,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useAlertChecker(enabled = true) {
  const queryClient = useQueryClient();
  const alerts = useAlertsStore((state) => state.alerts);
  const profile = useAuthStore((state) => state.profile);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const inFlightRef = useRef(new Set<string>());
  const { notify, isGranted: pushGranted } = usePushNotifications();

  useEffect(() => {
    if (!enabled || !isAuthenticated || !profile?.email) return;

    let cancelled = false;

    const checkAlerts = async () => {
      const activeAlerts = alerts.filter((alert) => alert.is_active && !alert.triggered_at);
      if (activeAlerts.length === 0) return;

      const uniqueCoinIds = [...new Set(activeAlerts.map((alert) => alert.coin_id))];

      try {
        const [coins, ghsRate] = await Promise.all([
          Promise.all(uniqueCoinIds.map((coinId) => marketApi.getCoin(coinId))),
          marketApi.getGhsRate().catch(() => 15.5),
        ]);

        if (cancelled) return;

        const coinMap = new Map(coins.map((coin) => [coin.id, coin]));
        const triggeredAlerts = activeAlerts.filter((alert) => {
          const currentPrice = coinMap.get(alert.coin_id)?.current_price;
          if (currentPrice == null || inFlightRef.current.has(alert.id)) return false;
          return alert.condition === 'above'
            ? currentPrice >= alert.threshold
            : currentPrice <= alert.threshold;
        });

        await Promise.all(
          triggeredAlerts.map(async (alert) => {
            const coin = coinMap.get(alert.coin_id);
            if (!coin) return;

            inFlightRef.current.add(alert.id);
            try {
              await alertsApi.markTriggered(alert.id, coin.current_price);
              const toastCopy = buildToastMessage(alert, coin.current_price, ghsRate);

              // ── In-app toast notification ──
              toast.custom(
                (t) => (
                  <button
                    type="button"
                    onClick={() => {
                      toast.dismiss(t.id);
                      window.location.assign(`/coin/${alert.coin_id}`);
                    }}
                    className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[#1E3050] bg-[#0D1526] px-4 py-3 text-left shadow-2xl"
                  >
                    <div className="mt-0.5 rounded-full bg-amber-400/15 p-2 text-amber-300">
                      <BellRing size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{toastCopy.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{toastCopy.subtitle}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-cyan-300">
                        Click to view {alert.coin_symbol.toUpperCase()}
                      </p>
                    </div>
                  </button>
                ),
                { duration: 8000 },
              );

              // ── Browser push notification (if permission granted) ──
              if (pushGranted) {
                notify(toastCopy.title, {
                  body: `${toastCopy.subtitle} — tap to open PredX`,
                  tag: `alert-${alert.id}`, // Deduplicates repeated triggers
                });
              }

              // ── Email notification ──
              try {
                await sendAlertEmail(alert, coin.current_price, profile.email, ghsRate);
                if (alert.notification_methods?.includes('email')) {
                  toast.success(`Alert email queued for ${alert.coin_symbol.toUpperCase()}.`, {
                    icon: <Mail size={14} />,
                  });
                }
              } catch (emailError) {
                console.warn('Failed to invoke send-alert-email', emailError);
              }
            } catch (error) {
              console.warn('Failed to trigger alert', error);
            } finally {
              inFlightRef.current.delete(alert.id);
            }
          }),
        );

        await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      } catch (error) {
        console.warn('Alert checker failed', error);
      }
    };

    void checkAlerts();
    const intervalId = window.setInterval(() => { void checkAlerts(); }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [alerts, enabled, isAuthenticated, notify, profile?.email, pushGranted, queryClient]);
}
