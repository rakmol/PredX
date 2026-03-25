import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from 'axios';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { PortfolioSummaryData, ExchangeConnection } from '@/types';

// These will hit backend endpoints (to be implemented in backend phase)
const portfolioClient = api.create({ baseURL: '/api' });

portfolioClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('predx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function usePortfolio() {
  const { setSummary } = usePortfolioStore();

  const query = useQuery({
    queryKey: ['portfolio'],
    queryFn: () =>
      portfolioClient.get<PortfolioSummaryData>('/portfolio/summary').then((r) => r.data),
    staleTime: 2 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setSummary(query.data);
  }, [query.data]);

  return query;
}

export function useExchangeConnections() {
  const { setConnections } = usePortfolioStore();

  const query = useQuery({
    queryKey: ['exchange-connections'],
    queryFn: () =>
      portfolioClient.get<ExchangeConnection[]>('/portfolio/connections').then((r) => r.data),
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setConnections(query.data);
  }, [query.data]);

  return query;
}
