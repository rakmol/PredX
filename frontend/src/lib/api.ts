// API client — points to backend (uses VITE_API_URL in production, /api proxy in dev)

import axios from 'axios';
import type { CoinData, CoinHistoryPoint, PredictionResult, InvestmentAdvice, Horizon, Currency } from '../types';
import type { OHLCVPoint } from './coingecko';

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL: BASE });

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.error;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

// Attach auth token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('predx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Market
export const marketApi = {
  getTopCoins: (limit = 50, currency = 'usd') =>
    api.get<CoinData[]>('/market/coins', { params: { limit, currency } }).then(r => r.data),

  getCoin: (coinId: string, currency = 'usd') =>
    api.get<CoinData>(`/market/coins/${coinId}`, { params: { currency } }).then(r => r.data),

  getCoinHistory: (coinId: string, days: number, currency = 'usd') =>
    api.get<CoinHistoryPoint[]>(`/market/coins/${coinId}/history`, { params: { days, currency } }).then(r => r.data),

  getOHLCV: (coinId: string, days: number, currency = 'usd') =>
    api.get<OHLCVPoint[]>(`/market/coins/${coinId}/ohlcv`, { params: { days, currency } }).then(r => r.data),

  search: (q: string) =>
    api.get<{ id: string; symbol: string; name: string; thumb: string }[]>('/market/search', { params: { q } }).then(r => r.data),

  getFearGreed: () =>
    api.get<{ value: number; label: string }>('/market/fear-greed').then(r => r.data),

  getGhsRate: () =>
    api.get<{ rate: number }>('/market/ghs-rate').then(r => r.data.rate),
};

// Predictions
export const predictionApi = {
  getPrediction: (coinId: string, horizon: Horizon) =>
    api
      .get<PredictionResult>(`/predictions/${coinId}/${horizon}`)
      .then(r => r.data)
      .catch((error) => {
        throw new Error(getApiErrorMessage(error, 'Failed to generate forecast. Please try again.'));
      }),

  getInvestmentAdvice: (coinId: string, amount: number, currency: Currency, horizon: Horizon) =>
    api
      .post<{ advice: InvestmentAdvice; prediction: PredictionResult }>('/predictions/invest', {
        coinId, amount, currency, horizon,
      })
      .then(r => r.data)
      .catch((error) => {
        throw new Error(getApiErrorMessage(error, 'Failed to generate investment advice. Please try again.'));
      }),
};

// Alerts
export const alertsApi = {
  getAlerts: () => api.get('/alerts').then(r => r.data),
  createAlert: (data: {
    coin_id: string;
    coin_symbol: string;
    condition: string;
    threshold: number;
    threshold_currency?: 'USD' | 'GHS';
    display_threshold?: number;
    notification_methods?: Array<'in_app' | 'email'>;
  }) =>
    api.post('/alerts', data).then(r => r.data),
  deleteAlert: (id: string) => api.delete(`/alerts/${id}`),
  toggleAlert: (id: string) => api.patch(`/alerts/${id}/toggle`).then(r => r.data),
  markTriggered: (id: string, triggered_price: number) =>
    api.patch(`/alerts/${id}/trigger`, { triggered_price }).then(r => r.data),
};
