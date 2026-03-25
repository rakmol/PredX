/**
 * start-trial — Supabase Edge Function
 *
 * Activates a 7-day Pro trial for a user (no payment required).
 * Guards against reuse: users who have previously trialled cannot start again.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY          (optional — skipped if absent)
 *   PRO_FROM_EMAIL          (optional)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  userId: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = (await request.json()) as RequestBody;
    if (!userId) return json({ error: 'Missing userId.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Fetch current profile ─────────────────────────────────────────────────
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('email, username, subscription_tier, trial_used')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      return json({ error: 'Profile not found.' }, 404);
    }

    // ── Guard: already Pro or already trialled ────────────────────────────────
    if (profile.subscription_tier === 'pro') {
      return json({ error: 'Already on Pro plan.' }, 409);
    }
    if (profile.trial_used) {
      return json({ error: 'Free trial has already been used on this account.' }, 409);
    }

    // ── Activate 7-day trial ──────────────────────────────────────────────────
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: 'pro',
        subscription_expires_at: expiresAt.toISOString(),
        trial_used: true,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Trial activation error:', updateError);
      return json({ error: 'Failed to activate trial.' }, 500);
    }

    // ── Send trial welcome email ──────────────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('PRO_FROM_EMAIL') ?? 'PredX <noreply@predx.app>';

    if (resendKey && profile.email) {
      const expiry = expiresAt.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      const html = buildTrialEmail(profile.username ?? 'there', expiry);
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [profile.email],
          subject: 'Your 7-day PredX Pro trial has started',
          html,
        }),
      });
    }

    return json({ success: true, expires_at: expiresAt.toISOString() });
  } catch (err) {
    console.error('start-trial error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildTrialEmail(username: string, expiry: string): string {
  return `
    <div style="font-family: Arial, sans-serif; background: #08111f; color: #e2e8f0; padding: 32px; max-width: 520px; margin: 0 auto; border-radius: 16px;">
      <h1 style="margin: 0 0 8px; font-size: 22px;">Your Pro trial is live, @${username}!</h1>
      <p style="color: #94a3b8; margin: 0 0 20px;">
        You have <strong style="color: #60a5fa;">7 days of free Pro access</strong> — no card required.
      </p>

      <div style="background: #0d1526; border: 1px solid #1e3050; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 12px; font-size: 15px; color: #60a5fa;">Explore during your trial</h3>
        <ul style="margin: 0; padding: 0 0 0 16px; color: #cbd5e1; font-size: 14px; line-height: 1.8;">
          <li>All coins &amp; all prediction timeframes</li>
          <li>Unlimited AI predictions</li>
          <li>Exchange connection (Binance, Bybit, KuCoin)</li>
          <li>AI Investment Advisor</li>
          <li>Portfolio AI analysis + behavioral coaching</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #64748b;">
        Trial ends on <strong style="color: #e2e8f0;">${expiry}</strong>.
        Upgrade to keep access for GHS 80/month or $6/month.
      </p>
    </div>
  `;
}
