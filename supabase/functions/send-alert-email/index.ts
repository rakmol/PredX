const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertEmailPayload {
  email: string;
  coinId: string;
  coinSymbol: string;
  condition: 'above' | 'below';
  target: string;
  currentPriceUsd: string;
  currentPriceGhs: string;
  triggeredAt: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await request.json()) as AlertEmailPayload;
    if (!payload.email || !payload.coinSymbol || !payload.target) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('ALERTS_FROM_EMAIL') ?? 'PredX Alerts <alerts@predx.app>';

    if (!resendApiKey) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: 'RESEND_API_KEY is not configured.',
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const directionCopy = payload.condition === 'above' ? 'crossed above' : 'fell below';
    const html = `
      <div style="font-family: Arial, sans-serif; background: #08111f; color: #e2e8f0; padding: 24px;">
        <h2 style="margin: 0 0 12px;">${payload.coinSymbol} alert triggered</h2>
        <p style="margin: 0 0 16px;">Your PredX alert fired because ${payload.coinSymbol} ${directionCopy} ${payload.target}.</p>
        <div style="background: #0d1526; border: 1px solid #1e3050; border-radius: 12px; padding: 16px;">
          <p style="margin: 0 0 8px;"><strong>Current price (USD):</strong> ${payload.currentPriceUsd}</p>
          <p style="margin: 0 0 8px;"><strong>Current price (GHS):</strong> ${payload.currentPriceGhs}</p>
          <p style="margin: 0;"><strong>Triggered at:</strong> ${new Date(payload.triggeredAt).toLocaleString('en-US', { timeZone: 'Africa/Accra' })}</p>
        </div>
        <p style="margin: 16px 0 0;">Open PredX to review <strong>${payload.coinSymbol}</strong> and manage the rest of your alerts.</p>
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
        subject: `${payload.coinSymbol} alert triggered on PredX`,
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
