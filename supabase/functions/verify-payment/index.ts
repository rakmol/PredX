/**
 * verify-payment — Supabase Edge Function
 *
 * Called after Paystack or Stripe checkout succeeds.
 * 1. Verifies the payment reference with the gateway API.
 * 2. Updates profiles.subscription_tier = 'pro' and sets expiry (+30 days).
 * 3. Sends a welcome email via Resend.
 *
 * Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PAYSTACK_SECRET_KEY
 *   STRIPE_SECRET_KEY
 *   RESEND_API_KEY
 *   PRO_FROM_EMAIL  (optional, defaults to 'PredX <noreply@predx.app>')
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  reference: string;
  gateway: 'paystack' | 'stripe';
  userId: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as RequestBody;
    const { reference, gateway, userId } = body;

    if (!reference || !gateway || !userId) {
      return json({ error: 'Missing reference, gateway, or userId.' }, 400);
    }

    // ── 1. Verify payment with gateway ────────────────────────────────────────
    if (gateway === 'paystack') {
      const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!paystackKey) return json({ error: 'Paystack key not configured.' }, 500);

      const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${paystackKey}` },
      });
      const data = await res.json();

      if (!data.status || data.data?.status !== 'success') {
        return json({ error: 'Paystack payment not successful.' }, 402);
      }
    } else if (gateway === 'stripe') {
      // For Stripe we trust the session ID forwarded from the success redirect;
      // a separate webhook (create-stripe-session function) handles full verification.
      // Here we do a lightweight check that the PaymentIntent is succeeded.
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeKey) return json({ error: 'Stripe key not configured.' }, 500);

      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${reference}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const data = await res.json();

      if (data.status !== 'succeeded') {
        return json({ error: 'Stripe payment not succeeded.' }, 402);
      }
    } else {
      return json({ error: 'Unknown gateway.' }, 400);
    }

    // ── 2. Upgrade profile in Supabase ────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: 'pro',
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return json({ error: 'Failed to upgrade profile.' }, 500);
    }

    // ── 3. Fetch profile for email ────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .single();

    // ── 4. Send welcome email via Resend ──────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('PRO_FROM_EMAIL') ?? 'PredX <noreply@predx.app>';

    if (resendKey && profile?.email) {
      const html = buildWelcomeEmail(profile.username ?? 'there', expiresAt);
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [profile.email],
          subject: 'Welcome to PredX Pro 🚀',
          html,
        }),
      });
    }

    return json({ success: true, expires_at: expiresAt.toISOString() });
  } catch (err) {
    console.error('verify-payment error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error.' }, 500);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildWelcomeEmail(username: string, expiresAt: Date): string {
  const expiry = expiresAt.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  return `
    <div style="font-family: Arial, sans-serif; background: #08111f; color: #e2e8f0; padding: 32px; max-width: 520px; margin: 0 auto; border-radius: 16px;">
      <h1 style="margin: 0 0 8px; font-size: 22px;">Welcome to PredX Pro, @${username}!</h1>
      <p style="color: #94a3b8; margin: 0 0 20px;">Your upgrade is confirmed. All Pro features are now unlocked.</p>

      <div style="background: #0d1526; border: 1px solid #1e3050; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 12px; font-size: 15px; color: #60a5fa;">What you now have access to</h3>
        <ul style="margin: 0; padding: 0 0 0 16px; color: #cbd5e1; font-size: 14px; line-height: 1.8;">
          <li>All coins &amp; all prediction timeframes (24h · 7d · 30d · 90d)</li>
          <li>Unlimited AI predictions</li>
          <li>Unlimited price alerts</li>
          <li>Exchange connection (Binance, Bybit, KuCoin)</li>
          <li>AI Investment Advisor</li>
          <li>Portfolio AI analysis + behavioral coaching</li>
          <li>Priority prediction refresh</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #64748b;">
        Your Pro subscription is active until <strong style="color: #e2e8f0;">${expiry}</strong>.
        It will renew automatically each month.
      </p>
      <p style="font-size: 13px; color: #64748b; margin-top: 8px;">
        Questions? Reply to this email or visit <a href="https://predx.app" style="color: #60a5fa;">predx.app</a>.
      </p>
    </div>
  `;
}
