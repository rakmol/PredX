// Market Data Router
// Public endpoints for coin prices, charts, search

import { Router, Request, Response } from 'express';
import { getTopCoins, getCoinDetails, getCoinPriceHistory, getOHLCV, searchCoins, getFearGreedIndex, getGHSRate } from '../services/marketData';

const router = Router();

// GET /api/market/coins?limit=50&currency=usd
router.get('/coins', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 250);
    const currency = (req.query.currency as string) || 'usd';
    const coins = await getTopCoins(limit, currency);
    res.json(coins);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/market/coins/:coinId?currency=usd
router.get('/coins/:coinId', async (req: Request, res: Response) => {
  try {
    const currency = (req.query.currency as string) || 'usd';
    const coin = await getCoinDetails(req.params['coinId'] as string, currency);
    res.json(coin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/market/coins/:coinId/ohlcv?days=30&currency=usd
router.get('/coins/:coinId/ohlcv', async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const currency = (req.query.currency as string) || 'usd';
    const ohlcv = await getOHLCV(req.params['coinId'] as string, days, currency);
    res.json(ohlcv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/market/coins/:coinId/history?days=7&currency=usd
router.get('/coins/:coinId/history', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const currency = (req.query.currency as string) || 'usd';
    const history = await getCoinPriceHistory(req.params['coinId'] as string, days, currency);
    res.json(history);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/market/search?q=bitcoin
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    if (!query.trim()) {
      res.json([]);
      return;
    }
    const results = await searchCoins(query);
    res.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/market/fear-greed
router.get('/fear-greed', async (_req: Request, res: Response) => {
  try {
    const data = await getFearGreedIndex();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/market/ghs-rate
router.get('/ghs-rate', async (_req: Request, res: Response) => {
  try {
    const rate = await getGHSRate();
    res.json({ rate });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
