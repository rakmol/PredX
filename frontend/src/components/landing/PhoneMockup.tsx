import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import { formatPrice } from '@/lib/utils';

interface MiniCandle {
  time: UTCTimestamp;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function toUtcTimestamp(timestamp: number) {
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function buildSeedCandles(basePrice: number): MiniCandle[] {
  const now = Date.now();
  const interval = 15 * 60 * 1000;

  return Array.from({ length: 22 }, (_, index) => {
    const timestamp = now - (21 - index) * interval;
    const drift = Math.sin(index / 3) * basePrice * 0.008;
    const open = basePrice + drift + (index % 2 === 0 ? -basePrice * 0.004 : basePrice * 0.002);
    const close = open + Math.cos(index / 2.5) * basePrice * 0.006;
    const high = Math.max(open, close) + basePrice * 0.003;
    const low = Math.min(open, close) - basePrice * 0.003;

    return {
      time: toUtcTimestamp(timestamp),
      timestamp,
      open,
      high,
      low,
      close,
    };
  });
}

function updateMiniCandles(candles: MiniCandle[], price: number, eventTimestamp: number) {
  if (!candles.length) return candles;

  const next = [...candles];
  const last = next[next.length - 1]!;
  const interval = next.length >= 2 ? Math.max(60_000, last.timestamp - next[next.length - 2]!.timestamp) : 15 * 60 * 1000;
  const bucketTimestamp = Math.floor(eventTimestamp / interval) * interval;

  if (bucketTimestamp <= last.timestamp) {
    next[next.length - 1] = {
      ...last,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    };
  } else {
    next.push({
      timestamp: bucketTimestamp,
      time: toUtcTimestamp(bucketTimestamp),
      open: last.close,
      high: Math.max(last.close, price),
      low: Math.min(last.close, price),
      close: price,
    });
  }

  return next.slice(-26);
}

function formatCompactPrice(value: number | null) {
  if (value === null) return '--';
  if (value >= 1000) return formatPrice(value, 'USD');
  return `$${value.toFixed(value >= 100 ? 2 : 4)}`;
}

function FlippableValue({
  value,
  formatter,
  className,
}: {
  value: number | null;
  formatter: (value: number | null) => string;
  className?: string;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const timer = window.setTimeout(() => setAnimate(false), 420);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <span
      className={`${className ?? ''} inline-block transition-all duration-300 ${
        animate ? 'translate-y-[-4px] opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      {formatter(value)}
    </span>
  );
}

export default memo(function PhoneMockup() {
  const btc = useRealtimePrice({ coinId: 'bitcoin', timeframe: '1D' });
  const eth = useRealtimePrice({ coinId: 'ethereum', timeframe: '7D' });
  const sol = useRealtimePrice({ coinId: 'solana', timeframe: '7D' });

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const latestCandlesRef = useRef<MiniCandle[]>([]);

  const [candles, setCandles] = useState<MiniCandle[]>(() => buildSeedCandles(96850));

  const coinRows = useMemo(
    () => [
      { symbol: 'BTC', price: btc.currentPrice, change: btc.priceChange24h ?? 2.4, tone: (btc.priceChange24h ?? 0) >= 0 ? 'up' : 'down' },
      { symbol: 'ETH', price: eth.currentPrice, change: eth.priceChange24h ?? 1.7, tone: (eth.priceChange24h ?? 0) >= 0 ? 'up' : 'down' },
      { symbol: 'SOL', price: sol.currentPrice, change: sol.priceChange24h ?? 3.2, tone: (sol.priceChange24h ?? 0) >= 0 ? 'up' : 'down' },
    ],
    [btc.currentPrice, btc.priceChange24h, eth.currentPrice, eth.priceChange24h, sol.currentPrice, sol.priceChange24h],
  );

  useEffect(() => {
    latestCandlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      height: 138,
      layout: {
        background: { type: ColorType.Solid, color: '#0A0A0F' },
        textColor: '#64748B',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.06)' },
        horzLines: { color: 'rgba(148,163,184,0.06)' },
      },
      rightPriceScale: {
        visible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        visible: false,
        borderVisible: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
      borderVisible: true,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    seriesRef.current.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [candles]);

  useEffect(() => {
    if (!btc.currentPrice || !btc.lastUpdated || !seriesRef.current) return;

    const nextCandles = updateMiniCandles(latestCandlesRef.current, btc.currentPrice, btc.lastUpdated);
    const last = nextCandles[nextCandles.length - 1];
    if (!last) return;

    latestCandlesRef.current = nextCandles;
    setCandles(nextCandles);
    seriesRef.current.update({
      time: last.time,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });
  }, [btc.currentPrice, btc.lastUpdated]);

  return (
    <div className="relative hidden md:block">
      <div className="absolute inset-0 scale-125 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.3)_0%,_rgba(59,130,246,0.08)_34%,_transparent_72%)] blur-3xl" />

      <div className="relative mx-auto w-[220px] lg:w-[280px] animate-[phone-enter_0.8s_ease-out_0.3s_both,phone-float_3s_ease-in-out_1.1s_infinite]">
        <div className="absolute -right-[4px] top-24 h-12 w-[3px] rounded-full bg-white/10" />
        <div className="absolute -right-[4px] top-40 h-8 w-[3px] rounded-full bg-white/10" />
        <div className="absolute -left-[4px] top-28 h-16 w-[3px] rounded-full bg-white/10" />

        <div className="rounded-[40px] border border-white/10 bg-[#0B0E16] p-2 shadow-[0_30px_80px_rgba(2,12,27,0.6)]">
          <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-[#0A0A0F] px-4 pb-4 pt-5">
            <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-black/60" />

            <div className="mb-4 flex items-center justify-between pt-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3B82F6] shadow-lg shadow-[#3B82F6]/30">
                  <TrendingUp size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">PredX</p>
                  <p className="text-sm font-semibold text-slate-100">Markets</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            </div>

            <div className="rounded-[24px] border border-white/5 bg-[#0D1118] px-3 py-3">
              <div ref={chartContainerRef} className="pointer-events-none" />

              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">BTC / USD</p>
                    <FlippableValue
                      value={btc.currentPrice}
                      formatter={formatCompactPrice}
                      className="mt-1 text-2xl font-bold text-white"
                    />
                  </div>
                  <div className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-semibold text-emerald-300">
                    +2.4% today
                  </div>
                </div>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-medium text-cyan-100">
                  <span>AI</span>
                  <span className="text-cyan-300">Strong Buy</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-200">87% confidence</span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {coinRows.map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0D1118] px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                      coin.symbol === 'BTC'
                        ? 'bg-amber-400/15 text-amber-300'
                        : coin.symbol === 'ETH'
                          ? 'bg-slate-400/15 text-slate-200'
                          : 'bg-emerald-400/15 text-emerald-300'
                    }`}>
                      {coin.symbol}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-100">{coin.symbol}</p>
                      <FlippableValue
                        value={coin.price}
                        formatter={formatCompactPrice}
                        className="text-xs text-slate-400"
                      />
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${coin.tone === 'up' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {(coin.change ?? 0) >= 0 ? '+' : ''}
                    {(coin.change ?? 0).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes phone-enter {
          0% { opacity: 0; transform: translateY(48px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes phone-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
});
