// Cron Routes — triggered by external cron (Vercel Cron, GitHub Actions, etc.)
// Protected by CRON_SECRET env var

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

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

    // 5. Send emails — one email per user with all movers batched
    const supabaseUrl = process.env.SUPABASE_URL!;
    const fnUrl = `${supabaseUrl}/functions/v1/send-coin-update`;
    let sent = 0;

    for (const profile of profiles) {
      if (!profile.email) continue;

      // Only send for the biggest mover to avoid email spam
      const top = movers.sort((a, b) =>
        Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h)
      )[0];

      const pct = top.price_change_percentage_24h;
      const direction = pct >= 0 ? 'up' : 'down';

      await fetch(fnUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: profile.email,
          coinSymbol: top.symbol.toUpperCase(),
          coinName: top.name,
          changeType: 'major_move',
          changeValue: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
          currentPriceUsd: `$${top.current_price.toLocaleString()}`,
          currentPriceGhs: `GHS ${(top.current_price * ghsRate).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`,
          direction,
        }),
      });
      sent++;
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

    type CoinRow = {
      id: string; symbol: string; name: string;
      current_price: number;
      price_change_percentage_24h: number;
      price_change_percentage_7d_in_currency: number;
    };

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

    // 5. Broadcast — send top hit to every user (deduplicate by coin+horizon)
    const seen = new Set<string>();
    const uniqueHits = hitsFound.filter(h => {
      const key = `${h.coin.id}-${h.horizon}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const fnUrl = `${process.env.SUPABASE_URL}/functions/v1/send-prediction-hit`;
    let sent = 0;

    for (const profile of profiles) {
      if (!profile.email) continue;
      for (const hit of uniqueHits) {
        const direction = hit.coin.price_change_percentage_24h >= 0 ? 'up' : 'down';
        const sign = direction === 'up' ? '+' : '-';
        await fetch(fnUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: profile.email,
            coinName: hit.coin.name,
            coinSymbol: hit.coin.symbol.toUpperCase(),
            horizon: hit.horizon,
            direction,
            targetPct: `${sign}${hit.targetPct.toFixed(1)}%`,
            actualPct: `${sign}${hit.actualPct.toFixed(1)}%`,
            currentPriceUsd: `$${hit.coin.current_price.toLocaleString()}`,
            currentPriceGhs: `GHS ${(hit.coin.current_price * ghsRate).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`,
          }),
        });
        sent++;
      }
    }

    res.json({ sent, hits: uniqueHits.map(h => `${h.coin.symbol} (${h.horizon})`), users: profiles.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
