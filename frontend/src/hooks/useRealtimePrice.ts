import { useEffect, useMemo, useRef, useState } from 'react';
import { getCoinPrice } from '@/lib/coingecko';
import { marketApi } from '@/lib/api';

export type RealtimeConnectionStatus = 'live' | 'delayed' | 'offline';
export type RealtimeSource = 'websocket' | 'polling' | 'offline';

interface UseRealtimePriceOptions {
  coinId: string;
  timeframe: string;
  /** Polling interval in ms for the REST fallback. null = Off (no polling). Defaults to 30 000 ms. */
  pollIntervalMs?: number | null;
}

interface RealtimeSnapshot {
  currentPrice: number | null;
  priceChange24h: number | null;
  lastUpdated: number | null;
  lastTradeVolumeUsd: number;
  connectionStatus: RealtimeConnectionStatus;
  source: RealtimeSource;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  tether: 'USDTUSDT',
  binancecoin: 'BNBUSDT',
  ripple: 'XRPUSDT',
  xrp: 'XRPUSDT',
  solana: 'SOLUSDT',
  cardano: 'ADAUSDT',
  dogecoin: 'DOGEUSDT',
  tron: 'TRXUSDT',
  avalanche: 'AVAXUSDT',
  'avalanche-2': 'AVAXUSDT',
  chainlink: 'LINKUSDT',
  toncoin: 'TONUSDT',
  stellar: 'XLMUSDT',
  'shiba-inu': 'SHIBUSDT',
  polkadot: 'DOTUSDT',
  litecoin: 'LTCUSDT',
  'bitcoin-cash': 'BCHUSDT',
  near: 'NEARUSDT',
  'near-protocol': 'NEARUSDT',
  uniswap: 'UNIUSDT',
  aptos: 'APTUSDT',
  sui: 'SUIUSDT',
  pepe: 'PEPEUSDT',
  'render-token': 'RENDERUSDT',
};

function getBinancePair(coinId: string) {
  return BINANCE_SYMBOL_MAP[coinId] ?? null;
}

export function useRealtimePrice({ coinId, timeframe, pollIntervalMs }: UseRealtimePriceOptions) {
  // Resolve the effective poll interval:
  // - undefined → use default (30 s)
  // - null      → Off (no REST polling)
  // - number    → poll at that interval
  const effectivePollMs =
    pollIntervalMs === undefined ? DEFAULT_POLL_INTERVAL_MS : pollIntervalMs;

  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>({
    currentPrice: null,
    priceChange24h: null,
    lastUpdated: null,
    lastTradeVolumeUsd: 0,
    connectionStatus: 'offline',
    source: 'offline',
  });
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  const websocketRef = useRef<WebSocket | null>(null);
  const pollingHealthyRef = useRef(false);
  const websocketHealthyRef = useRef(false);
  const lastPriceRef = useRef<number | null>(null);

  // ── WebSocket + polling effect ──────────────────────────────────────────
  // WebSocket is always attempted for supported pairs, regardless of pollIntervalMs.
  // REST polling is skipped when effectivePollMs is null.
  useEffect(() => {
    let disposed = false;

    const syncStatus = () => {
      if (disposed) return;

      if (websocketHealthyRef.current) {
        setSnapshot((current) => ({
          ...current,
          connectionStatus: 'live',
          source: 'websocket',
        }));
        return;
      }

      if (pollingHealthyRef.current) {
        setSnapshot((current) => ({
          ...current,
          connectionStatus: 'delayed',
          source: 'polling',
        }));
        return;
      }

      setSnapshot((current) => ({
        ...current,
        connectionStatus: 'offline',
        source: 'offline',
      }));
    };

    const pollPrice = async () => {
      try {
        let price: Awaited<ReturnType<typeof getCoinPrice>>;
        try {
          price = await getCoinPrice(coinId);
        } catch {
          const coin = await marketApi.getCoin(coinId);
          price = {
            usd: coin.current_price,
            ghs: 0,
            usd_24h_change: coin.price_change_percentage_24h ?? 0,
            last_updated: coin.last_updated ?? new Date().toISOString(),
          };
        }
        if (disposed) return;

        pollingHealthyRef.current = true;
        lastPriceRef.current = price.usd;

        setSnapshot((current) => ({
          ...current,
          currentPrice: price.usd,
          priceChange24h: price.usd_24h_change,
          lastUpdated: Date.now(),
          lastTradeVolumeUsd: 0,
          connectionStatus: websocketHealthyRef.current ? 'live' : 'delayed',
          source: websocketHealthyRef.current ? 'websocket' : 'polling',
        }));
      } catch {
        pollingHealthyRef.current = false;
        syncStatus();
      }
    };

    // Initial fetch regardless of polling interval (so we always show a price on mount)
    void pollPrice();

    // Ongoing REST polling — only when effectivePollMs is a positive number
    let pollingTimer: number | undefined;
    if (effectivePollMs !== null && effectivePollMs > 0) {
      pollingTimer = window.setInterval(() => {
        void pollPrice();
      }, effectivePollMs);
    }

    // WebSocket — always attempted for supported Binance pairs so charts feel live
    const binancePair = getBinancePair(coinId);
    if (binancePair) {
      try {
        const socket = new WebSocket(`wss://stream.binance.com:9443/ws/${binancePair.toLowerCase()}@trade`);
        websocketRef.current = socket;

        socket.onopen = () => {
          websocketHealthyRef.current = true;
          syncStatus();
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              p?: string;
              q?: string;
              T?: number;
              E?: number;
            };
            const nextPrice = Number(payload.p ?? 0);
            if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;

            websocketHealthyRef.current = true;
            lastPriceRef.current = nextPrice;

            setSnapshot((current) => ({
              ...current,
              currentPrice: nextPrice,
              lastUpdated: payload.T ?? payload.E ?? Date.now(),
              lastTradeVolumeUsd: nextPrice * Number(payload.q ?? 0),
              connectionStatus: 'live',
              source: 'websocket',
            }));
          } catch {
            websocketHealthyRef.current = false;
            syncStatus();
          }
        };

        socket.onerror = () => {
          websocketHealthyRef.current = false;
          syncStatus();
        };

        socket.onclose = () => {
          websocketHealthyRef.current = false;
          syncStatus();
        };
      } catch {
        websocketHealthyRef.current = false;
        syncStatus();
      }
    } else {
      websocketHealthyRef.current = false;
      syncStatus();
    }

    return () => {
      disposed = true;
      if (pollingTimer !== undefined) window.clearInterval(pollingTimer);
      websocketHealthyRef.current = false;
      pollingHealthyRef.current = false;
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinId, timeframe, effectivePollMs]);

  // ── Seconds-since-update ticker ─────────────────────────────────────────
  useEffect(() => {
    if (!snapshot.lastUpdated) {
      setSecondsSinceUpdate(0);
      return;
    }

    setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - snapshot.lastUpdated) / 1000)));
    const timer = window.setInterval(() => {
      setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - (snapshot.lastUpdated ?? Date.now())) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [snapshot.lastUpdated]);

  return useMemo(
    () => ({
      currentPrice: snapshot.currentPrice,
      priceChange24h: snapshot.priceChange24h,
      lastUpdated: snapshot.lastUpdated,
      lastTradeVolumeUsd: snapshot.lastTradeVolumeUsd,
      connectionStatus: snapshot.connectionStatus,
      source: snapshot.source,
      secondsSinceUpdate,
      isActive: snapshot.connectionStatus !== 'offline',
      isWebsocket: snapshot.source === 'websocket',
      isPolling: snapshot.source === 'polling',
    }),
    [secondsSinceUpdate, snapshot],
  );
}
