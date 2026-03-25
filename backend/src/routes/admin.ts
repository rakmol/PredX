// Admin Routes — full platform management (users, predictions, alerts, stats)
// Protected by admin JWT (separate from Supabase user auth)

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/* ─── Auth ─────────────────────────────────────────────────────────────────── */

// POST /admin/auth/login
router.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    res.status(500).json({ error: 'Admin credentials not configured' });
    return;
  }

  if (email !== adminEmail || password !== adminPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { email, role: 'admin' },
    process.env.ADMIN_JWT_SECRET!,
    { expiresIn: '24h' }
  );

  res.json({ token, email, expiresIn: 86400 });
});

// POST /admin/auth/verify — check if token is still valid
router.post('/auth/verify', requireAdmin, (req: AdminRequest, res: Response) => {
  res.json({ valid: true, email: req.admin!.email });
});

/* ─── Dashboard Stats ───────────────────────────────────────────────────────── */

// GET /admin/stats
router.get('/stats', requireAdmin, async (_req: AdminRequest, res: Response) => {
  const [
    usersResult,
    proUsersResult,
    predictionsResult,
    alertsResult,
    activeAlertsResult,
    triggeredAlertsResult,
    recentUsersResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'pro'),
    supabase.from('predictions').select('*', { count: 'exact', head: true }),
    supabase.from('alerts').select('*', { count: 'exact', head: true }),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).not('triggered_at', 'is', null),
    supabase
      .from('profiles')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const totalUsers = usersResult.count ?? 0;
  const proUsers = proUsersResult.count ?? 0;

  // Group recent signups by day for sparkline (last 7 days)
  const now = new Date();
  const signupsByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    signupsByDay[d.toISOString().slice(0, 10)] = 0;
  }
  (recentUsersResult.data ?? []).forEach((u) => {
    const day = (u.created_at as string).slice(0, 10);
    if (day in signupsByDay) signupsByDay[day]++;
  });
  const signupTrend = Object.entries(signupsByDay).map(([date, count]) => ({ date, count }));

  res.json({
    users: {
      total: totalUsers,
      pro: proUsers,
      free: totalUsers - proUsers,
    },
    predictions: { total: predictionsResult.count ?? 0 },
    alerts: {
      total: alertsResult.count ?? 0,
      active: activeAlertsResult.count ?? 0,
      triggered: triggeredAlertsResult.count ?? 0,
    },
    signupTrend,
  });
});

/* ─── Users ─────────────────────────────────────────────────────────────────── */

// GET /admin/users?page=1&limit=20&search=
router.get('/users', requireAdmin, async (req: AdminRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const search = (req.query.search as string || '').trim();

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('profiles')
    .select('id, email, username, avatar_url, subscription_tier, subscription_expires_at, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ data: data ?? [], total: count ?? 0, page, limit });
});

// GET /admin/users/:id
router.get('/users/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !profile) { res.status(404).json({ error: 'User not found' }); return; }

  // Get counts
  const [predCount, alertCount] = await Promise.all([
    supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', req.params.id),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', req.params.id),
  ]);

  res.json({
    ...profile,
    prediction_count: predCount.count ?? 0,
    alert_count: alertCount.count ?? 0,
  });
});

// PATCH /admin/users/:id/tier
router.patch('/users/:id/tier', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { tier } = req.body as { tier?: string };
  if (!tier || !['free', 'pro'].includes(tier)) {
    res.status(400).json({ error: 'tier must be "free" or "pro"' });
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// DELETE /admin/users/:id
router.delete('/users/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { error } = await supabase.auth.admin.deleteUser(req.params.id as string);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

/* ─── Predictions ───────────────────────────────────────────────────────────── */

// GET /admin/predictions?page=1&limit=20&coinId=&signal=
router.get('/predictions', requireAdmin, async (req: AdminRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('predictions')
    .select(
      'id, user_id, coin_id, coin_symbol, coin_name, timeframe, overall_signal, confidence_score, current_price, expires_at, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (req.query.signal) query = query.eq('overall_signal', req.query.signal);
  if (req.query.coinId) query = query.eq('coin_id', req.query.coinId);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ data: data ?? [], total: count ?? 0, page, limit });
});

/* ─── Alerts ────────────────────────────────────────────────────────────────── */

// GET /admin/alerts?page=1&limit=20&status=active|triggered|all
router.get('/alerts', requireAdmin, async (req: AdminRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const status = req.query.status as string || 'all';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('alerts')
    .select('id, user_id, coin_id, coin_symbol, condition, threshold, threshold_currency, display_threshold, is_active, triggered_at, triggered_price, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'triggered') query = query.not('triggered_at', 'is', null);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ data: data ?? [], total: count ?? 0, page, limit });
});

// DELETE /admin/alerts/:id
router.delete('/alerts/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { error } = await supabase.from('alerts').delete().eq('id', req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
