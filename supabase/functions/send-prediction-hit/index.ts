// send-prediction-hit — broadcasts to all users when a Move Watch coin hits its target
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('ALERTS_FROM_EMAIL') ?? 'PredX <onboarding@resend.dev>';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not configured.' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      email,
      coinName,
      coinSymbol,
      horizon,        // '24h' | '72h'
      direction,      // 'up' | 'down'
      targetPct,      // e.g. '+8.5%'
      actualPct,      // e.g. '+9.2%'
      currentPriceUsd,
      currentPriceGhs,
    } = await req.json();

    const dirLabel  = direction === 'up' ? '📈 Bullish' : '📉 Bearish';
    const dirColor  = direction === 'up' ? '#22C55E' : '#EF4444';
    const appUrl    = 'https://predx-app.vercel.app';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050A14;font-family:'Inter',system-ui,sans-serif;color:#E2E8F0;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#3B82F6,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">PredX</span>
      <p style="color:#64748B;font-size:13px;margin:4px 0 0;">AI Crypto Predictions</p>
    </div>

    <!-- Alert Card -->
    <div style="background:#0D1526;border:1px solid #1E3050;border-radius:16px;padding:28px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="background:${dirColor}20;border-radius:10px;padding:10px;">
          <span style="font-size:24px;">${direction === 'up' ? '🚀' : '⬇️'}</span>
        </div>
        <div>
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#64748B;">Prediction Target Hit</p>
          <h2 style="margin:4px 0 0;font-size:20px;font-weight:800;color:#F1F5F9;">${coinName} (${coinSymbol})</h2>
        </div>
      </div>

      <div style="background:#111E35;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;">
          <div>
            <p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;">Horizon</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#3B82F6;">${horizon}</p>
          </div>
          <div>
            <p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;">Target</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${dirColor};">${targetPct}</p>
          </div>
          <div>
            <p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;">Actual</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${dirColor};">${actualPct}</p>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div style="background:#111E35;border-radius:10px;padding:14px;">
          <p style="margin:0;font-size:11px;color:#64748B;">Price (USD)</p>
          <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#F1F5F9;">${currentPriceUsd}</p>
        </div>
        <div style="background:#111E35;border-radius:10px;padding:14px;">
          <p style="margin:0;font-size:11px;color:#64748B;">Price (GHS)</p>
          <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#F1F5F9;">${currentPriceGhs}</p>
        </div>
      </div>

      <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.6;">
        The PredX Move Watch predicted ${coinName} would move <strong style="color:${dirColor};">${targetPct}</strong> within ${horizon}.
        The coin has now moved <strong style="color:${dirColor};">${actualPct}</strong> — target reached! ✅
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
        View Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:12px;color:#334155;margin-top:24px;">
      PredX · AI Crypto Predictions · <a href="${appUrl}/settings" style="color:#475569;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: `🎯 ${coinSymbol} hit its ${horizon} target! ${dirLabel} ${actualPct}`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.text();
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
