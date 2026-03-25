// Admin API client — all calls go through /admin/* proxied to backend

const BASE = '/admin';

function getToken(): string | null {
  return localStorage.getItem('predx_admin_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; email: string }>('POST', '/auth/login', { email, password }),

  verify: () =>
    request<{ valid: boolean; email: string }>('POST', '/auth/verify'),

  stats: () =>
    request<{
      users: { total: number; pro: number; free: number };
      predictions: { total: number };
      alerts: { total: number; active: number; triggered: number };
      signupTrend: { date: string; count: number }[];
    }>('GET', '/stats'),

  users: {
    list: (page = 1, limit = 20, search = '') =>
      request<{ data: User[]; total: number; page: number; limit: number }>(
        'GET', `/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
      ),
    get: (id: string) => request<User>('GET', `/users/${id}`),
    setTier: (id: string, tier: 'free' | 'pro') =>
      request<User>('PATCH', `/users/${id}/tier`, { tier }),
    delete: (id: string) => request<void>('DELETE', `/users/${id}`),
  },

  predictions: {
    list: (page = 1, limit = 20, signal?: string) =>
      request<{ data: Prediction[]; total: number; page: number; limit: number }>(
        'GET', `/predictions?page=${page}&limit=${limit}${signal ? `&signal=${signal}` : ''}`
      ),
  },

  alerts: {
    list: (page = 1, limit = 20, status = 'all') =>
      request<{ data: Alert[]; total: number; page: number; limit: number }>(
        'GET', `/alerts?page=${page}&limit=${limit}&status=${status}`
      ),
    delete: (id: string) => request<void>('DELETE', `/alerts/${id}`),
  },
};

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface User {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'pro';
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
  prediction_count?: number;
  alert_count?: number;
}

export interface Prediction {
  id: string;
  user_id: string;
  coin_id: string;
  coin_symbol: string;
  coin_name: string;
  timeframe: string;
  overall_signal: string;
  confidence_score: number;
  current_price: number;
  expires_at: string;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  coin_id: string;
  coin_symbol: string;
  condition: string;
  threshold: number;
  threshold_currency: string;
  display_threshold: number;
  is_active: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  created_at: string;
}
