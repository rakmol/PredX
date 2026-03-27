// Affiliate / Referral Routes
// GET  /api/affiliate/stats  — user's ref_code + referral count (auth required)
// POST /api/affiliate/record — record a referral after signup (public)

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/affiliate/stats
router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [profileRes, referralsRes] = await Promise.all([
      supabase.from('profiles').select('ref_code').eq('id', userId).single(),
      supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', userId),
    ]);

    res.json({
      refCode: profileRes.data?.ref_code ?? null,
      referralCount: referralsRes.count ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/affiliate/record
// Body: { referredId: string, refCode: string }
router.post('/record', async (req: Request, res: Response) => {
  try {
    const { referredId, refCode } = req.body as { referredId?: string; refCode?: string };

    if (!referredId || !refCode) {
      res.status(400).json({ error: 'referredId and refCode are required' });
      return;
    }

    // Find the referrer by their ref_code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id')
      .eq('ref_code', refCode.toLowerCase().trim())
      .maybeSingle();

    if (!referrer || referrer.id === referredId) {
      res.json({ recorded: false, reason: 'Referrer not found or self-referral' });
      return;
    }

    // Insert — ignore if already referred (UNIQUE on referred_id)
    const { error } = await supabase.from('referrals').upsert(
      { referrer_id: referrer.id, referred_id: referredId },
      { onConflict: 'referred_id', ignoreDuplicates: true }
    );

    if (error) throw new Error(error.message);
    res.json({ recorded: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
