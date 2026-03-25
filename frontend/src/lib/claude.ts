import axios from 'axios';
import type { PortfolioAdvice, TopCoinAdvisorData } from '@/types/advisor';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('predx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';
export type Timeframe = '1week' | '1month' | '3months' | '6months' | '1year';
export type Currency = 'GHS' | 'USD';

interface BudgetFilterResult {
  filteredCoins: TopCoinAdvisorData[];
  affordabilityWarning?: string;
}

const STABLECOINS = new Set(['USDT', 'USDC']);
const SMALL_BUDGET_SYMBOLS = new Set(['USDT', 'USDC', 'XRP', 'ADA', 'DOGE', 'MATIC', 'POL', 'TRX', 'SHIB', 'PEPE']);
const MID_BUDGET_SYMBOLS = new Set(['ETH', 'BNB', 'SOL', 'AVAX', 'DOT', 'LINK', 'ATOM', 'NEAR']);

function toAmountGhs(amount: number, currency: Currency, ghsRate: number) {
  return currency === 'GHS' ? amount : amount * ghsRate;
}

function toAmountUsd(amount: number, currency: Currency, ghsRate: number) {
  return currency === 'USD' ? amount : amount / ghsRate;
}

function buildTierWarning(amountGhs: number) {
  if (amountGhs < 100) {
    return 'Your budget is very small - consider saving more before investing in volatile assets.';
  }
  if (amountGhs < 500) {
    return 'Small budget detected - we limited recommendations to affordable assets only.';
  }
  return undefined;
}

function coinMatchesTier(coin: TopCoinAdvisorData, amountGhs: number) {
  const symbol = coin.symbol.toUpperCase();
  const priceUsd = coin.priceUSD ?? coin.current_price;

  if (amountGhs < 100) {
    return STABLECOINS.has(symbol) || priceUsd < 1 || SMALL_BUDGET_SYMBOLS.has(symbol);
  }
  if (amountGhs < 500) {
    return SMALL_BUDGET_SYMBOLS.has(symbol) || priceUsd <= 50;
  }
  if (amountGhs < 2000) {
    return MID_BUDGET_SYMBOLS.has(symbol) || priceUsd <= 800;
  }
  if (amountGhs < 10000) {
    return true;
  }
  return true;
}

function filterAffordableCoins(
  amount: number,
  currency: Currency,
  topCoinsData: TopCoinAdvisorData[],
): BudgetFilterResult {
  const fallbackGhsRate = topCoinsData.find((coin) => (coin.priceUSD ?? coin.current_price) > 0 && (coin.priceGHS ?? 0) > 0);
  const inferredGhsRate = fallbackGhsRate
    ? (fallbackGhsRate.priceGHS ?? 0) / (fallbackGhsRate.priceUSD ?? fallbackGhsRate.current_price)
    : 15.5;

  const amountGhs = toAmountGhs(amount, currency, inferredGhsRate);
  const amountUsd = toAmountUsd(amount, currency, inferredGhsRate);
  const warning = buildTierWarning(amountGhs);

  const affordable = topCoinsData.filter((coin) => {
    const priceUsd = coin.priceUSD ?? coin.current_price;
    const priceGhs = coin.priceGHS ?? priceUsd * inferredGhsRate;
    const minInvestmentGhs = coin.minInvestmentGHS ?? priceGhs * 0.001;
    const minReachableUsd = Math.max(1, 0.5);

    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return false;
    if (minInvestmentGhs > amountGhs * 0.2) return false;
    if (amountUsd < minReachableUsd && !STABLECOINS.has(coin.symbol.toUpperCase())) return false;
    if (!coinMatchesTier({ ...coin, priceUSD: priceUsd, priceGHS: priceGhs, minInvestmentGHS: minInvestmentGhs }, amountGhs)) {
      return false;
    }

    return true;
  });

  const sortedAffordable = affordable.sort((left, right) => {
    const leftStable = STABLECOINS.has(left.symbol.toUpperCase()) ? -1 : 0;
    const rightStable = STABLECOINS.has(right.symbol.toUpperCase()) ? -1 : 0;
    if (leftStable !== rightStable) return leftStable - rightStable;
    return (left.market_cap_rank ?? 999) - (right.market_cap_rank ?? 999);
  });

  const fallback = topCoinsData
    .filter((coin) => coin.symbol.toUpperCase() === 'USDT' || coin.symbol.toUpperCase() === 'USDC')
    .slice(0, 2);

  return {
    filteredCoins: sortedAffordable.length ? sortedAffordable : fallback,
    affordabilityWarning: warning,
  };
}

export async function generateInvestmentAdvice(
  amount: number,
  currency: Currency,
  timeframe: Timeframe,
  riskLevel: RiskLevel,
  topCoinsData: TopCoinAdvisorData[],
): Promise<PortfolioAdvice> {
  const { filteredCoins, affordabilityWarning } = filterAffordableCoins(amount, currency, topCoinsData);

  const { data } = await api.post<PortfolioAdvice>('/predictions/portfolio', {
    amount,
    currency,
    timeframe,
    riskLevel,
    topCoinsData: filteredCoins,
    affordabilityWarning,
  });

  return {
    ...data,
    affordability_warning: data.affordability_warning ?? affordabilityWarning,
  };
}
