export const PLANS = {
  free: {
    name: 'Free',
    price_usd: 0,
    price_ghs: 0,
    features: {
      coins: 'Top 10 coins only',
      timeframes: '7d prediction only (24h, 30d, 90d blurred)',
      predictions: '1 AI prediction per day',
      alerts: '3 price alerts max',
      exchange: false,
      advisor: false,
      portfolioAI: false,
      priorityRefresh: false,
    },
    limits: {
      coins: 10,
      alerts: 3,
      predictions_per_day: 1,
      // Timeframes locked behind Pro
      blurred_timeframes: ['24h', '30d', '90d'] as string[],
      free_timeframe: '7d',
    },
  },
  pro: {
    name: 'Pro',
    price_usd: 6,
    price_ghs: 80,
    price_period: 'month',
    trial_days: 7,
    features: {
      coins: 'All coins',
      timeframes: 'All timeframes (24h, 7d, 30d, 90d)',
      predictions: 'Unlimited AI predictions',
      alerts: 'Unlimited price alerts',
      exchange: 'Binance, Bybit, KuCoin',
      advisor: true,
      portfolioAI: 'Portfolio AI analysis + behavioral coaching',
      priorityRefresh: true,
    },
    limits: {
      coins: Infinity,
      alerts: Infinity,
      predictions_per_day: Infinity,
      blurred_timeframes: [] as string[],
      free_timeframe: null,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Structured comparison rows for the pricing table */
export const FEATURE_COMPARISON = [
  { label: 'Coins',                   free: 'Top 10 only',             pro: 'All coins' },
  { label: 'Prediction timeframes',   free: '7d only (others blurred)', pro: '24h · 7d · 30d · 90d' },
  { label: 'AI predictions',          free: '1 per day',               pro: 'Unlimited' },
  { label: 'Price alerts',            free: 'Up to 3',                 pro: 'Unlimited' },
  { label: 'Exchange connection',     free: false,                     pro: 'Binance, Bybit, KuCoin' },
  { label: 'Investment advisor',      free: false,                     pro: true },
  { label: 'Portfolio AI analysis',   free: false,                     pro: true },
  { label: 'Behavioral coaching',     free: false,                     pro: true },
  { label: 'Priority refresh',        free: false,                     pro: true },
] as const;
