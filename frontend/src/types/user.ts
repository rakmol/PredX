export type SubscriptionTier = 'free' | 'pro';
export type Currency = 'GHS' | 'USD';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  device_count: number;
  created_at: string;
  updated_at: string;
}

export interface PriceAlert {
  id: string;
  user_id: string;
  coin_id: string;
  coin_symbol: string;
  condition: 'above' | 'below' | 'change_pct';
  threshold: number;
  threshold_currency: 'USD' | 'GHS';
  display_threshold: number | null;
  notification_methods: Array<'in_app' | 'email'> | null;
  is_active: boolean;
  triggered_price?: number | null;
  triggered_at: string | null;
  created_at: string;
}
