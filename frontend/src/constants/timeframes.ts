import type { Horizon } from '@/types';

export const HORIZONS: { value: Horizon; label: string; description: string }[] = [
  { value: '24h', label: '24 Hours', description: 'Short-term swing' },
  { value: '7d',  label: '7 Days',   description: 'Weekly outlook' },
  { value: '30d', label: '30 Days',  description: 'Monthly trend' },
  { value: '90d', label: '90 Days',  description: 'Quarterly forecast' },
];

export const CHART_DAYS: { label: string; days: number }[] = [
  { label: '1D',  days: 1 },
  { label: '7D',  days: 7 },
  { label: '1M',  days: 30 },
  { label: '3M',  days: 90 },
  { label: '1Y',  days: 365 },
];
