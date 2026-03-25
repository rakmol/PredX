// Coin Update Email — sends major price move and new prediction notifications
// Pattern mirrors send-alert-email/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinUpdatePayload {
  email: string;
  coinSymbol: string;
  coinName: string;
  changeType: 'major_move' | 'new_prediction' | 'sentiment_shift';
  changeValue: string;       // e.g. "+12.4%" or "STRONG BUY" or "Extreme Fear → Greed"
  currentPriceUsd: string;
  currentPriceGhs: string;
  direction: 'up' | 'down' | 'neutral';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await request.json()) as CoinUpdatePayload;
    if (!payload.email || !payload.coinSymbol || !payload.changeType) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('ALERTS_FROM_EMAIL') ?? 'PredX Updates <updates@predx.app>';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not configured.' }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const typeLabels: Record<CoinUpdatePayload['changeType'], string> = {
      major_move:      `Major price move: ${payload.changeValue}`,
      new_prediction:  `New AI prediction: ${payload.changeValue}`,
      sentiment_shift: `Sentiment shift: ${payload.changeValue}`,
    };

    const subjectLabel = typeLabels[payload.changeType];
    const arrowEmoji = payload.direction === 'up' ? '📈' : payload.direction === 'down' ? '📉' : '↔️';
    const arrowColor = payload.direction === 'up' ? '#22c55e' : payload.direction === 'down' ? '#ef4444' : '#94a3b8';

    const html = `
      <div style="font-family: Arial, sans-serif; background: #08111f; color: #e2e8f0; padding: 24px; max-width: 480px; margin: auto; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <span style="font-size: 28px;">${arrowEmoji}</span>
          <div>
            <h2 style="margin: 0; font-size: 18px;">${payload.coinName} (${payload.coinSymbol}) update</h2>
            <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">PredX Market Intelligence</p>
          </div>
        </div>

        <div style="background: #0d1526; border: 1px solid #1e3050; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Update</p>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: ${arrowColor};">${subjectLabel}</p>
        </div>

        <div style="background: #0d1526; border: 1px solid #1e3050; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px;"><strong>Current price (USD):</strong> ${payload.currentPriceUsd}</p>
          <p style="margin: 0 0 8px;"><strong>Current price (GHS):</strong> ${payload.currentPriceGhs}</p>
          <p style="margin: 0; font-size: 12px; color: #64748b;">As of ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Accra' })} (Ghana time)</p>
        </div>

        <a href="https://predx.app/coin/${payload.coinSymbol.toLowerCase()}"
           style="display: block; background: #3b82f6; color: white; text-align: center; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-bottom: 16px;">
          View Full Prediction on PredX →
        </a>

        <p style="font-size: 11px; color: #475569; margin: 0;">
          You're receiving this because you have coin update emails enabled on PredX.
          <a href="https://predx.app/settings" style="color: #3b82f6;">Manage preferences</a>
        </p>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.email],
        subject: `${arrowEmoji} ${payload.coinSymbol} — ${subjectLabel} | PredX`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
