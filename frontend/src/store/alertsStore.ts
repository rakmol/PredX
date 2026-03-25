import { create } from 'zustand';
import type { PriceAlert } from '@/types';

interface AlertsState {
  alerts: PriceAlert[];
  setAlerts: (alerts: PriceAlert[]) => void;
  addAlert: (alert: PriceAlert) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],

  setAlerts: (alerts) => set({ alerts }),

  addAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts] })),

  removeAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

  toggleAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, is_active: !a.is_active } : a,
      ),
    })),
}));
