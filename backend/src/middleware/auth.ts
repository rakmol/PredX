// Auth middleware - validates Supabase JWT tokens
// NOTE: All authenticated users are currently treated as Pro (subscription gating disabled).
// To restore tiering: change `tier: 'pro'` back to `tier: profile?.subscription_tier ?? 'free'`

import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    tier?: 'free' | 'pro';
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    tier: 'pro', // All signed-up users have full access for now
  };

  next();
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);

  if (user) {
    req.user = {
      id: user.id,
      email: user.email,
      tier: 'pro', // All signed-up users have full access for now
    };
  }

  next();
}
