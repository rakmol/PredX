/**
 * Upgrade.tsx — Pro upgrade / pricing page
 *
 * Payment flow:
 *  GHS  → Paystack inline popup  → verify-payment edge function → update profile
 *  USD  → Stripe Checkout session → verify-payment edge function → update profile (via webhook)
 *
 * Env vars required:
 *  VITE_PAYSTACK_PUBLIC_KEY  — Paystack public key
 *  VITE_SUPABASE_URL         — already set project-wide
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Zap, Gift, Shield, Star } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { FEATURE_COMPARISON, PLANS } from '@/constants/plans';

// ─── Paystack types (inline JS loaded from CDN) ───────────────────────────────
declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

type Currency = 'GHS' | 'USD';

export default function Upgrade() {
  const navigate = useNavigate();
  const { profile, updateProfile, isPro } = useAuthStore();
  const [currency, setCurrency] = useState<Currency>('GHS');
  const [loading, setLoading] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);

  // ── Load Paystack inline JS from CDN ─────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('paystack-script')) {
      setPaystackReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setPaystackReady(true);
    document.body.appendChild(script);
  }, []);

  // Redirect already-Pro users back to dashboard
  useEffect(() => {
    if (isPro()) navigate('/dashboard', { replace: true });
  }, [isPro, navigate]);

  // ── Verify payment via Edge Function and upgrade profile ──────────────────────
  async function verifyAndUpgrade(reference: string, gateway: 'paystack' | 'stripe') {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { reference, gateway, userId: profile?.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error ?? 'Payment verification failed. Contact support.');
      }

      // Update local profile so UI reflects Pro immediately
      updateProfile({ subscription_tier: 'pro', subscription_expires_at: data.expires_at });
      toast.success('Welcome to Pro! All features unlocked.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upgrade failed.');
    } finally {
      setLoading(false);
    }
  }

  // ── Start 7-day free trial (no card required) ─────────────────────────────────
  async function startTrial() {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('start-trial', {
        body: { userId: profile.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error ?? 'Could not start trial.');
      }

      updateProfile({ subscription_tier: 'pro', subscription_expires_at: data.expires_at });
      toast.success('7-day Pro trial started! Enjoy all features.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trial activation failed.');
    } finally {
      setLoading(false);
    }
  }

  // ── Pay with Paystack (GHS) ───────────────────────────────────────────────────
  function payWithPaystack() {
    if (!paystackReady || !window.PaystackPop) {
      toast.error('Payment is loading, please try again.');
      return;
    }
    if (!profile?.email) {
      toast.error('You must be logged in to upgrade.');
      return;
    }

    const ref = `predx_${profile.id}_${Date.now()}`;
    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ?? '',
      email: profile.email,
      amount: PLANS.pro.price_ghs * 100, // Paystack expects pesewas (GHS × 100)
      currency: 'GHS',
      ref,
      metadata: { userId: profile.id, username: profile.username, plan: 'pro' },
      callback: (response) => {
        verifyAndUpgrade(response.reference, 'paystack');
      },
      onClose: () => toast('Payment cancelled.', { icon: '↩️' }),
    });

    handler.openIframe();
  }

  // ── Pay with Stripe (USD) — creates a Checkout session via Edge Function ──────
  async function payWithStripe() {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-session', {
        body: { userId: profile.id, email: profile.email },
      });

      if (error || !data?.url) {
        throw new Error(data?.error ?? 'Could not create Stripe session.');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stripe redirect failed.');
      setLoading(false);
    }
  }

  const handleUpgrade = () => {
    if (currency === 'GHS') payWithPaystack();
    else payWithStripe();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 pb-24 md:pb-10">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/30 text-brand text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <Star size={12} /> Most Popular
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-3">Upgrade to Pro</h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Unlock all coins, all timeframes, unlimited predictions, and full AI analysis.
        </p>
      </div>

      {/* Currency toggle */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <button
          onClick={() => setCurrency('GHS')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            currency === 'GHS'
              ? 'bg-brand text-white'
              : 'text-slate-400 hover:text-slate-300 border border-[#1E3050]'
          }`}
        >
          GHS ₵
        </button>
        <button
          onClick={() => setCurrency('USD')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            currency === 'USD'
              ? 'bg-brand text-white'
              : 'text-slate-400 hover:text-slate-300 border border-[#1E3050]'
          }`}
        >
          USD $
        </button>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
        {/* Free card */}
        <div className="bg-[#0D1526] border border-[#1E3050] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-1">Free</h2>
          <p className="text-slate-500 text-sm mb-4">Get started with basics</p>
          <div className="mb-6">
            <span className="text-4xl font-bold text-slate-100">
              {currency === 'GHS' ? '₵0' : '$0'}
            </span>
            <span className="text-slate-500 text-sm"> / forever</span>
          </div>
          <div className="w-full py-2.5 border border-[#1E3050] text-slate-500 rounded-xl text-sm font-medium mb-6 text-center">
            Current Plan
          </div>
          <FeatureList currency={currency} plan="free" />
        </div>

        {/* Pro card */}
        <div className="bg-gradient-to-b from-brand/10 to-[#0D1526] border border-brand/40 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">
            PRO
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">Pro</h2>
          <p className="text-slate-400 text-sm mb-4">Full AI prediction power</p>
          <div className="mb-1">
            <span className="text-4xl font-bold text-white">
              {currency === 'GHS' ? `₵${PLANS.pro.price_ghs}` : `$${PLANS.pro.price_usd}`}
            </span>
            <span className="text-slate-400 text-sm"> / month</span>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            {currency === 'GHS' ? 'via Paystack · mobile money & card' : 'via Stripe · card'}
          </p>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-2.5 bg-brand hover:bg-brand/90 disabled:opacity-60 text-white rounded-xl text-sm font-bold mb-3 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            {loading ? 'Processing…' : 'Upgrade Now'}
          </button>

          <button
            onClick={startTrial}
            disabled={loading}
            className="w-full py-2 border border-brand/40 text-brand hover:bg-brand/10 disabled:opacity-60 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-6"
          >
            <Gift size={14} />
            Start 7-day free trial (no card)
          </button>

          <FeatureList currency={currency} plan="pro" />
        </div>
      </div>

      {/* Comparison table */}
      <div className="max-w-2xl mx-auto bg-[#0D1526] border border-[#1E3050] rounded-2xl overflow-hidden mb-8">
        <div className="grid grid-cols-3 text-xs font-bold text-slate-400 uppercase tracking-wide bg-[#081020] px-4 py-3">
          <span>Feature</span>
          <span className="text-center">Free</span>
          <span className="text-center text-brand">Pro</span>
        </div>
        {FEATURE_COMPARISON.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-3 items-center px-4 py-3 border-t border-[#1E3050] text-sm"
          >
            <span className="text-slate-300">{row.label}</span>
            <span className="text-center">
              {row.free === false ? (
                <X size={14} className="text-slate-600 mx-auto" />
              ) : (
                <span className="text-slate-400 text-xs">{row.free}</span>
              )}
            </span>
            <span className="text-center">
              {row.pro === true ? (
                <Check size={14} className="text-brand mx-auto" />
              ) : row.pro === false ? (
                <X size={14} className="text-slate-600 mx-auto" />
              ) : (
                <span className="text-brand text-xs font-medium">{row.pro as string}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 mb-6">
        <span className="flex items-center gap-1.5"><Shield size={12} className="text-green-500" /> Secure payment</span>
        <span className="flex items-center gap-1.5"><Check size={12} className="text-green-500" /> Cancel anytime</span>
        <span className="flex items-center gap-1.5"><Gift size={12} className="text-brand" /> 7-day free trial</span>
      </div>

      <p className="text-center text-xs text-slate-600 max-w-md mx-auto">
        All predictions include your username watermark for anti-piracy protection.
        Accounts are limited to 2 devices.
      </p>
    </div>
  );
}

// ─── Feature list sub-component ──────────────────────────────────────────────

function FeatureList({ plan }: { plan: 'free' | 'pro'; currency: Currency }) {
  const freeItems = [
    'Top 10 coins',
    '7d prediction only',
    '1 AI prediction / day',
    '3 price alerts',
  ];
  const proItems = [
    'All coins',
    'All timeframes (24h · 7d · 30d · 90d)',
    'Unlimited AI predictions',
    'Unlimited price alerts',
    'Exchange connection (Binance, Bybit, KuCoin)',
    'Investment advisor',
    'Portfolio AI analysis',
    'Behavioral coaching',
    'Priority prediction refresh',
  ];

  const items = plan === 'free' ? freeItems : proItems;
  const iconClass = plan === 'pro' ? 'text-brand' : 'text-slate-500';

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm">
          <Check size={14} className={`${iconClass} flex-shrink-0 mt-0.5`} />
          <span className={plan === 'pro' ? 'text-slate-200' : 'text-slate-400'}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
