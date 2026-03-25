// Admin Auth Middleware — validates admin JWT tokens (separate from Supabase user auth)

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminRequest extends Request {
  admin?: { email: string };
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing admin authorization' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as { email: string; role: string };
    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    req.admin = { email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}
