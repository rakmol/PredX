// Price Alerts Router
// CRUD for user price alerts stored in Supabase

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/alerts — list user's alerts
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// POST /api/alerts — create alert
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const {
    coin_id,
    coin_symbol,
    condition,
    threshold,
    threshold_currency,
    display_threshold,
    notification_methods,
  } = req.body;
  if (!coin_id || !condition || threshold == null) {
    res.status(400).json({ error: 'coin_id, condition, and threshold required' });
    return;
  }

  // NOTE: Alert limits are currently disabled — all users can create unlimited alerts.
  // To restore the free-tier limit, uncomment the block below.
  // if (req.user?.tier === 'free') { ... }

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: req.user!.id,
      coin_id,
      coin_symbol: coin_symbol?.toUpperCase(),
      condition,
      threshold,
      threshold_currency: threshold_currency ?? 'USD',
      display_threshold: display_threshold ?? threshold,
      notification_methods: notification_methods ?? ['in_app'],
      is_active: true,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

// DELETE /api/alerts/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

// PATCH /api/alerts/:id/toggle
router.patch('/:id/toggle', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: current } = await supabase
    .from('alerts')
    .select('is_active')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (!current) { res.status(404).json({ error: 'Alert not found' }); return; }

  const { data, error } = await supabase
    .from('alerts')
    .update({ is_active: !current.is_active })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// PATCH /api/alerts/:id/trigger
router.patch('/:id/trigger', requireAuth, async (req: AuthRequest, res: Response) => {
  const { triggered_price } = req.body;

  const { data, error } = await supabase
    .from('alerts')
    .update({
      is_active: false,
      triggered_at: new Date().toISOString(),
      triggered_price: triggered_price ?? null,
    })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

export default router;
