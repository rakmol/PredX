import { create } from 'zustand';
import type { PortfolioSummaryData, ExchangeConnection } from '@/types';

interface PortfolioState {
  summary: PortfolioSummaryData | null;
  connections: ExchangeConnection[];
  selectedExchange: string | null;
  setSummary: (summary: PortfolioSummaryData | null) => void;
  setConnections: (connections: ExchangeConnection[]) => void;
  selectExchange: (exchangeId: string | null) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  summary: null,
  connections: [],
  selectedExchange: null,

  setSummary: (summary) => set({ summary }),
  setConnections: (connections) => set({ connections }),
  selectExchange: (selectedExchange) => set({ selectedExchange }),
}));
