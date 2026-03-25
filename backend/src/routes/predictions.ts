// Predictions Router
// GET /api/predictions/:coinId/:horizon — generate a prediction
// POST /api/predictions/invest         — investment advice
// POST /api/predictions/portfolio      — multi-coin portfolio advice

import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import { getCoinDetails, getOHLCV, getGHSRate } from '../services/marketData';
import { getSentimentAnalysis } from '../services/sentiment';
import { computeTechnicals } from '../utils/technicals';
import { generatePrediction, generateInvestmentAdvice } from '../services/prediction';
import { generatePortfolioAdvice } from '../services/portfolioAdvisor';

const router = Router();

const forecastLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many forecast refreshes. Please wait a moment.' },
});

const advisorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

// GET /api/predictions/:coinId/:horizon
// All authenticated users receive full predictions (no blurring).
router.get('/:coinId/:horizon', forecastLimiter, optionalAuth, async (req: AuthRequest, res: Response) => {
  const coinId = req.params['coinId'] as string;
  const horizon = req.params['horizon'] as string;

  try {
    if (!['24h', '7d', '30d', '90d'].includes(horizon)) {
      res.status(400).json({ error: 'Invalid horizon. Use 24h, 7d, 30d, or 90d' });
      return;
    }

    const days = horizon === '24h' ? 7 : horizon === '7d' ? 30 : horizon === '30d' ? 90 : 180;

    // Fetch market data, OHLCV, and sentiment concurrently.
    // Each step has its own internal timeout & fallback — surface a clear error if something fails.
    let coin, ohlcv, sentiment;
    try {
      [coin, ohlcv, sentiment] = await Promise.all([
        getCoinDetails(coinId),
        getOHLCV(coinId, days),
        getSentimentAnalysis(coinId, '', coinId),
      ]);
    } catch (dataErr: unknown) {
      const message = dataErr instanceof Error ? dataErr.message : 'Market data unavailable';
      // Rate limit from CoinGecko
      if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
        res.status(429).json({ error: 'Market data rate limit reached. Please wait 30 seconds and try again.' });
        return;
      }
      // Coin not found
      if (message.includes('not found') || message.includes('404')) {
        res.status(404).json({ error: `Coin "${coinId}" not found.` });
        return;
      }
      res.status(503).json({ error: 'Unable to fetch market data right now. Please try again in a moment.' });
      return;
    }

    const technicals = computeTechnicals(ohlcv);
    const prediction = await generatePrediction(
      coin,
      technicals,
      sentiment,
      horizon as '24h' | '7d' | '30d' | '90d'
    );

    // All users get full prediction data — no blurring
    res.json({ ...prediction, is_blurred: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[prediction]', coinId, horizon, message);

    // Don't leak raw AI provider errors to the client
    if (message.toLowerCase().includes('anthropic') || message.toLowerCase().includes('claude')) {
      res.status(503).json({ error: 'AI analysis is temporarily unavailable. A rule-based forecast was generated instead.' });
      return;
    }

    res.status(500).json({ error: 'Failed to generate forecast. Please try again.' });
  }
});

// POST /api/predictions/invest
// AI investment advisor endpoint
router.post('/invest', advisorLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { coinId, amount, currency, horizon } = req.body;

    if (!coinId || !amount || !currency) {
      res.status(400).json({ error: 'coinId, amount, and currency are required' });
      return;
    }
    if (!['GHS', 'USD'].includes(currency)) {
      res.status(400).json({ error: 'Currency must be GHS or USD' });
      return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    const h = horizon ?? '7d';
    const days = h === '24h' ? 7 : h === '7d' ? 30 : 90;

    const [coin, ohlcv, sentiment, ghsRate] = await Promise.all([
      getCoinDetails(coinId),
      getOHLCV(coinId, days),
      getSentimentAnalysis(coinId, '', coinId),
      getGHSRate(),
    ]);

    const technicals = computeTechnicals(ohlcv);
    const prediction = await generatePrediction(coin, technicals, sentiment, h as '24h' | '7d' | '30d' | '90d');
    const advice = await generateInvestmentAdvice(coin, prediction, amount, currency, ghsRate);

    res.json({ advice, prediction: { ...prediction, is_blurred: false } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[invest]', message);
    res.status(500).json({ error: 'Failed to generate investment advice. Please try again.' });
  }
});

// POST /api/predictions/portfolio
// Multi-coin portfolio allocation advisor
router.post('/portfolio', advisorLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, currency, timeframe, riskLevel, topCoinsData, affordabilityWarning } = req.body;

    if (!amount || !currency || !timeframe || !riskLevel) {
      res.status(400).json({ error: 'amount, currency, timeframe, and riskLevel are required' });
      return;
    }
    if (!['GHS', 'USD'].includes(currency)) {
      res.status(400).json({ error: 'currency must be GHS or USD' });
      return;
    }
    if (!['conservative', 'moderate', 'aggressive'].includes(riskLevel)) {
      res.status(400).json({ error: 'riskLevel must be conservative, moderate, or aggressive' });
      return;
    }
    if (!['1week', '1month', '3months', '6months', '1year'].includes(timeframe)) {
      res.status(400).json({ error: 'timeframe must be 1week, 1month, 3months, 6months, or 1year' });
      return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const advice = await generatePortfolioAdvice(amount, currency, timeframe, riskLevel, topCoinsData, affordabilityWarning);
    res.json(advice);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[portfolio]', message);
    res.status(500).json({ error: 'Failed to generate portfolio advice. Please try again.' });
  }
});

export default router;
