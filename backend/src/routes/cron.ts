// Cron Routes — triggered by external cron (Vercel Cron, GitHub Actions, etc.)
// Protected by CRON_SECRET env var

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

interface CoinRow {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
}

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/** Middleware: validates the shared cron secret */
function cronAuth(req: Request, res: Response, next: () => void) {
  const secret = req.headers['x-cron-secret'] ?? req.query.secret;
  if (!secret || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/** Send an email via Resend directly */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

  const fromEmail = process.env.FROM_EMAIL ?? 'PredX <onboarding@resend.dev>';

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend error: ${err}`);
  }
}

/** Build prediction-hit email HTML */
function buildPredictionHitHtml(params: {
  coinName: string; coinSymbol: string; horizon: string;
  direction: string; targetPct: string; actualPct: string;
  currentPriceUsd: string; currentPriceGhs: string;
}): string {
  const { coinName, coinSymbol, horizon, direction, targetPct, actualPct, currentPriceUsd, currentPriceGhs } = params;
  const dirColor  = direction === 'up' ? '#22C55E' : '#EF4444';
  const appUrl    = 'https://predx-app.vercel.app';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050A14;font-family:'Inter',system-ui,sans-serif;color:#E2E8F0;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#3B82F6,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">PredX</span>
      <p style="color:#64748B;font-size:13px;margin:4px 0 0;">AI Crypto Predictions</p>
    </div>
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
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
        View Dashboard →
      </a>
    </div>
    <p style="text-align:center;font-size:12px;color:#334155;margin-top:24px;">
      PredX · AI Crypto Predictions · <a href="${appUrl}/settings" style="color:#475569;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

/** Build coin-update email HTML */
function buildCoinUpdateHtml(params: {
  coinName: string; coinSymbol: string; direction: string;
  changeValue: string; currentPriceUsd: string; currentPriceGhs: string;
}): string {
  const { coinName, coinSymbol, direction, changeValue, currentPriceUsd, currentPriceGhs } = params;
  const dirColor = direction === 'up' ? '#22C55E' : '#EF4444';
  const appUrl   = 'https://predx-app.vercel.app';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050A14;font-family:'Inter',system-ui,sans-serif;color:#E2E8F0;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#3B82F6,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">PredX</span>
      <p style="color:#64748B;font-size:13px;margin:4px 0 0;">AI Crypto Predictions</p>
    </div>
    <div style="background:#0D1526;border:1px solid #1E3050;border-radius:16px;padding:28px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="background:${dirColor}20;border-radius:10px;padding:10px;">
          <span style="font-size:24px;">${direction === 'up' ? '📈' : '📉'}</span>
        </div>
        <div>
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#64748B;">Major Price Move</p>
          <h2 style="margin:4px 0 0;font-size:20px;font-weight:800;color:#F1F5F9;">${coinName} (${coinSymbol})</h2>
        </div>
      </div>
      <div style="background:#111E35;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:1px;">24h Change</p>
        <p style="margin:8px 0 0;font-size:36px;font-weight:800;color:${dirColor};">${changeValue}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:#111E35;border-radius:10px;padding:14px;">
          <p style="margin:0;font-size:11px;color:#64748B;">Price (USD)</p>
          <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#F1F5F9;">${currentPriceUsd}</p>
        </div>
        <div style="background:#111E35;border-radius:10px;padding:14px;">
          <p style="margin:0;font-size:11px;color:#64748B;">Price (GHS)</p>
          <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#F1F5F9;">${currentPriceGhs}</p>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
        View Dashboard →
      </a>
    </div>
    <p style="text-align:center;font-size:12px;color:#334155;margin-top:24px;">
      PredX · AI Crypto Predictions · <a href="${appUrl}/settings" style="color:#475569;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

// POST /api/cron/coin-updates
// Scans top coins for major moves (>10% 24h) and emails opted-in users.
router.post('/coin-updates', cronAuth, async (_req: Request, res: Response) => {
  try {
    // 1. Fetch top 50 coins from CoinGecko
    const { data: coins } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 50,
        page: 1,
        sparkline: false,
        price_change_percentage: '24h',
      },
      timeout: 15_000,
    });

    // 2. Filter coins with |24h change| > 10%
    const movers = (coins as Array<{
      id: string; symbol: string; name: string;
      current_price: number; price_change_percentage_24h: number;
    }>).filter((c) => Math.abs(c.price_change_percentage_24h ?? 0) >= 10);

    if (movers.length === 0) {
      res.json({ sent: 0, message: 'No major movers found' });
      return;
    }

    // 3. Fetch GHS rate
    let ghsRate = 15.5;
    try {
      const { data: rateData } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5_000 });
      ghsRate = rateData?.rates?.GHS ?? ghsRate;
    } catch { /* use default */ }

    // 4. Get users with email_updates = true
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email_updates', true);

    if (profileError || !profiles?.length) {
      res.json({ sent: 0, message: profileError?.message ?? 'No users with email_updates enabled' });
      return;
    }

    // 5. Send emails directly via Resend
    const top = movers.sort((a, b) =>
      Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h)
    )[0];
    const pct = top.price_change_percentage_24h;
    const direction = pct >= 0 ? 'up' : 'down';
    const changeValue = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    const html = buildCoinUpdateHtml({
      coinName: top.name,
      coinSymbol: top.symbol.toUpperCase(),
      direction,
      changeValue,
      currentPriceUsd: `$${top.current_price.toLocaleString()}`,
      currentPriceGhs: `GHS ${(top.current_price * ghsRate).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`,
    });

    let sent = 0;
    for (const profile of profiles) {
      if (!profile.email) continue;
      try {
        await sendEmail(
          profile.email,
          `${top.symbol.toUpperCase()} moved ${changeValue} in 24h`,
          html
        );
        sent++;
      } catch { /* skip failed sends */ }
    }

    res.json({ sent, movers: movers.map((m) => m.symbol), profiles: profiles.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/cron/prediction-hits
// Checks Move Watch coins — if any hit their predicted target, broadcasts to all users.
router.post('/prediction-hits', cronAuth, async (_req: Request, res: Response) => {
  try {
    // 1. Fetch top 50 coins with 24h + 7d price changes
    const { data: coins } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 50,
        page: 1,
        sparkline: false,
        price_change_percentage: '24h,7d',
      },
      timeout: 15_000,
    });

    // 2. Build Move Watch targets (same logic as frontend) and check if hit
    const hitsFound: Array<{
      coin: CoinRow; horizon: string; targetPct: number; actualPct: number;
    }> = [];

    for (const coin of coins as CoinRow[]) {
      const day  = coin.price_change_percentage_24h ?? 0;
      const week = coin.price_change_percentage_7d_in_currency ?? 0;

      // 24h horizon: target = dayMove * 1.2 + weekMove * 0.2, capped at 8%
      const target24 = Math.min(Math.abs(day * 1.2 + week * 0.2), 8);
      if (target24 >= 1.5 && Math.abs(day) >= target24) {
        hitsFound.push({ coin, horizon: '24h', targetPct: target24, actualPct: Math.abs(day) });
      }

      // 72h horizon: target = dayMove * 0.85 + weekMove * 0.5, capped at 24%
      const target72 = Math.min(Math.abs(day * 0.85 + week * 0.5), 24);
      if (target72 >= 5 && Math.abs(day) >= target72) {
        hitsFound.push({ coin, horizon: '72h', targetPct: target72, actualPct: Math.abs(day) });
      }
    }

    if (hitsFound.length === 0) {
      res.json({ sent: 0, message: 'No prediction targets hit yet' });
      return;
    }

    // 3. Fetch GHS rate
    let ghsRate = 15.5;
    try {
      const { data: rateData } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5_000 });
      ghsRate = rateData?.rates?.GHS ?? ghsRate;
    } catch { /* use default */ }

    // 4. Get ALL signed-up users
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email');

    if (profileError || !profiles?.length) {
      res.json({ sent: 0, message: profileError?.message ?? 'No users found' });
      return;
    }

    // 5. Deduplicate hits by coin+horizon
    const seen = new Set<string>();
    const uniqueHits = hitsFound.filter(h => {
      const key = `${h.coin.id}-${h.horizon}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 6. Broadcast — send emails directly via Resend
    let sent = 0;
    for (const profile of profiles) {
      if (!profile.email) continue;
      for (const hit of uniqueHits) {
        const direction = hit.coin.price_change_percentage_24h >= 0 ? 'up' : 'down';
        const sign = direction === 'up' ? '+' : '-';
        const targetPct = `${sign}${hit.targetPct.toFixed(1)}%`;
        const actualPct = `${sign}${hit.actualPct.toFixed(1)}%`;
        const html = buildPredictionHitHtml({
          coinName: hit.coin.name,
          coinSymbol: hit.coin.symbol.toUpperCase(),
          horizon: hit.horizon,
          direction,
          targetPct,
          actualPct,
          currentPriceUsd: `$${hit.coin.current_price.toLocaleString()}`,
          currentPriceGhs: `GHS ${(hit.coin.current_price * ghsRate).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`,
        });
        try {
          await sendEmail(
            profile.email,
            `🎯 ${hit.coin.symbol.toUpperCase()} hit its ${hit.horizon} target! ${actualPct}`,
            html
          );
          sent++;
        } catch { /* skip failed sends */ }
      }
    }

    res.json({ sent, hits: uniqueHits.map(h => `${h.coin.symbol} (${h.horizon})`), users: profiles.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
