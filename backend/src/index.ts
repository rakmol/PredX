// PredX Backend — Entry Point
// Express server with all routes registered

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import marketRouter from './routes/market';
import predictionsRouter from './routes/predictions';
import alertsRouter from './routes/alerts';
import adminRouter from './routes/admin';
import cronRouter from './routes/cron';
import affiliateRouter from './routes/affiliate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security & logging middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '10kb' }));

// CORS — allow frontend and admin origins
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3002',  // Admin panel
    process.env.FRONTEND_URL ?? '',
    process.env.ADMIN_URL ?? '',
  ].filter(Boolean),
  credentials: true,
}));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use(globalLimiter);

// Routes
app.use('/api/market', marketRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/admin', adminRouter);
app.use('/api/cron', cronRouter);
app.use('/api/affiliate', affiliateRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', service: 'predx-api' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start HTTP server when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 PredX API running on http://localhost:${PORT}`);
  });
}

export default app;
