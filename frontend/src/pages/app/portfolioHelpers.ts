export type SortKey = 'value' | 'pnl' | 'change24h';
export type SortDirection = 'asc' | 'desc';
export type ExchangeName = 'binance' | 'bybit';

export interface ManualPosition {
  id: string;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  image: string;
  amountOwned: number;
  averageBuyPrice: number;
  openedAt: string;
}

export interface ExchangeConnectionRow {
  id: string;
  exchange: string;
  last_synced_at: string | null;
  created_at: string;
}

export interface ConnectedTrade {
  coin: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  quoteQty: number;
  time: string;
}

export interface ConnectedBalance {
  coin: string;
  free: number;
  locked: number;
  valueUSD: number;
}

export interface PortfolioRow {
  id: string;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  image: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  currentValueUsd: number;
  currentValueGhs: number;
  pnlUsd: number;
  pnlGhs: number;
  pnlPct: number;
  change24hUsd: number;
  change24hGhs: number;
  change24hPct: number;
  allocationPct: number;
  sparkline: number[];
  openedAt?: string;
  live: boolean;
  aiNote: string;
}

export interface InsightCard {
  title: string;
  body: string;
  tone: 'positive' | 'warning' | 'neutral';
}

export const PIE_COLORS = ['#22C55E', '#38BDF8', '#F59E0B', '#A855F7', '#F97316', '#84CC16', '#F43F5E', '#14B8A6'];
export const MANUAL_STORAGE_PREFIX = 'predx-manual-portfolio';
export const SUPPORTED_LIVE_EXCHANGES: ExchangeName[] = ['binance', 'bybit'];

export function getManualStorageKey(userId: string) {
  return `${MANUAL_STORAGE_PREFIX}:${userId}`;
}

export function getSortValue(row: PortfolioRow, key: SortKey) {
  if (key === 'value') return row.currentValueUsd;
  if (key === 'pnl') return row.pnlUsd;
  return row.change24hUsd;
}

export function buildPositionNote(row: PortfolioRow) {
  if (row.allocationPct >= 45) return `${row.coinName} now makes up ${row.allocationPct.toFixed(0)}% of your portfolio, so a sharp move here will dominate your results.`;
  if (row.pnlPct >= 20) return `${row.coinName} is strongly above your cost basis, so consider whether you want to trim or trail profits instead of letting one winner overrun the book.`;
  if (row.pnlPct <= -15) return `${row.coinName} is materially below your entry, so this is a good moment to review conviction instead of averaging down automatically.`;
  if (row.change24hPct <= -5) return `${row.coinName} is under pressure today, which can be fine if your thesis is longer-term and sizing is under control.`;
  return `${row.coinName} is behaving in line with a steady hold, with no immediate position-management red flags.`;
}

export function buildInsights(rows: PortfolioRow[], trades: ConnectedTrade[]) {
  if (!rows.length) {
    return {
      healthScore: 0,
      diversificationRating: 'Not enough data',
      diversificationMessage: 'Add a few positions to start tracking concentration and diversification.',
      coachingTips: ['Start with a small set of positions you can actually monitor.'],
      insights: [] as InsightCard[],
    };
  }

  const maxAllocation = Math.max(...rows.map((row) => row.allocationPct));
  const losers = rows.filter((row) => row.pnlPct < 0).length;
  const winners = rows.filter((row) => row.pnlPct > 0).length;
  const avgChange24h = rows.reduce((sum, row) => sum + row.change24hPct, 0) / rows.length;
  const healthScore = Math.max(
    18,
    Math.min(
      96,
      Math.round(
        100
          - Math.max(0, maxAllocation - 28) * 0.9
          - losers * 4
          + winners * 2
          + Math.max(-12, Math.min(12, avgChange24h))
      )
    )
  );

  const diversificationRating = maxAllocation <= 35 ? 'Strong' : maxAllocation <= 55 ? 'Moderate' : 'Concentrated';
  const leaderName = [...rows].sort((left, right) => right.allocationPct - left.allocationPct)[0]?.coinName ?? 'your largest asset';
  const diversificationMessage =
    maxAllocation <= 35
      ? 'Your position sizes are reasonably balanced, which helps keep single-coin shocks from driving the entire portfolio.'
      : `Your portfolio is ${maxAllocation.toFixed(0)}% in ${leaderName}, so diversification would reduce single-asset risk.`;

  const recentTrades = trades.filter((trade) => Date.now() - new Date(trade.time).getTime() <= 30 * 24 * 60 * 60 * 1000);
  const sellTrades = recentTrades.filter((trade) => trade.side === 'SELL');

  const insights: InsightCard[] = [
    {
      title: maxAllocation > 55 ? 'Concentration risk is elevated' : 'Sizing discipline looks healthy',
      body:
        maxAllocation > 55
          ? `Your largest position accounts for ${maxAllocation.toFixed(0)}% of the portfolio, which means one coin now has outsized influence on total returns.`
          : 'No single position is dominating the book, which is a strong sign that your sizing is staying under control.',
      tone: maxAllocation > 55 ? 'warning' : 'positive',
    },
    {
      title: losers > winners ? 'Losses currently outweigh winners' : 'Winners are carrying the portfolio',
      body:
        losers > winners
          ? `You have ${losers} losing positions versus ${winners} winners, so it may be time to review laggards and free up capital.`
          : `You have ${winners} profitable positions versus ${losers} laggards, which suggests your portfolio quality is improving.`,
      tone: losers > winners ? 'warning' : 'positive',
    },
  ];

  if (sellTrades.length >= 3) {
    insights.push({
      title: `You've sold ${sellTrades.length} positions in the last 30 days`,
      body: 'That turnover can be healthy, but it can also signal reactive management if most of those exits happened during down days.',
      tone: 'neutral',
    });
  }

  const coachingTips = [
    maxAllocation > 45
      ? 'Reduce top-heavy exposure by trimming your largest position or adding one to two uncorrelated holdings.'
      : 'Keep position sizing capped so a single coin does not dictate the entire portfolio outcome.',
    losers > 0
      ? 'Review losing positions against your original thesis and decide whether they are conviction holds or capital traps.'
      : 'Document why each winning position is working so you can repeat that setup deliberately.',
    avgChange24h < -2
      ? 'Avoid making big allocation changes on a red day unless your thesis has materially changed.'
      : 'Rebalance on strength rather than waiting for concentrated winners to become oversized.',
  ];

  return { healthScore, diversificationRating, diversificationMessage, coachingTips, insights };
}

export function toRowTone(row: PortfolioRow) {
  return row.pnlUsd >= 0 ? 'border-green-500/15 bg-green-500/[0.03]' : 'border-red-500/15 bg-red-500/[0.03]';
}
