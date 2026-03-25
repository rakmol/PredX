import Anthropic from '@anthropic-ai/sdk';
import { getTopCoins, getGHSRate } from './marketData';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const cache = new Map<string, { data: PortfolioAdvice; expires: number }>();

export interface CoinAllocation {
  coin: string;
  symbol: string;
  image: string;
  percentage: number;
  amount_usd: number;
  amount_ghs: number;
  units_purchasable: number;
  is_fractional: boolean;
  affordability_note: string;
  current_price: number;
  target_price: number;
  potential_value_usd: number;
  potential_value_ghs: number;
  reason: string;
}

export interface AdvisorCoinContext {
  id?: string;
  coin?: string;
  name?: string;
  symbol: string;
  image?: string;
  current_price: number;
  priceUSD?: number;
  priceGHS?: number;
  minInvestmentGHS?: number;
  marketCap?: number;
  volume24h?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap_rank?: number;
  target_price?: number;
  predicted_price?: number;
  bullish_target_price?: number;
  neutral_target_price?: number;
  bearish_target_price?: number;
  confidence_score?: number;
  prediction_horizon?: string;
  reason?: string;
}

export interface PortfolioScenario {
  total_value_usd: number;
  total_value_ghs: number;
  gain_percent: number;
}

export interface PortfolioAdvice {
  recommended_allocation: CoinAllocation[];
  total_invested_usd: number;
  total_invested_ghs: number;
  total_potential_value_usd: number;
  total_potential_value_ghs: number;
  potential_gain_percent: number;
  scenario_bullish: PortfolioScenario;
  scenario_neutral: PortfolioScenario;
  scenario_bearish: PortfolioScenario;
  strategy_summary: string;
  risk_level: string;
  timeframe: string;
  warning: string;
  affordability_warning?: string;
  generated_at: string;
  ghs_rate: number;
}

interface NormalizedAdvisorCoin {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_ghs: number;
  min_investment_ghs: number;
  market_cap: number;
  volume_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  market_cap_rank: number;
  target_price?: number;
  bullish_target_price?: number;
  neutral_target_price?: number;
  bearish_target_price?: number;
  confidence_score?: number;
  prediction_horizon?: string;
  reason?: string;
}

const TIMEFRAME_MAP: Record<string, string> = {
  '1week': '1 week',
  '1month': '1 month',
  '3months': '3 months',
  '6months': '6 months',
  '1year': '1 year',
};

const RISK_DESCRIPTION: Record<string, string> = {
  conservative: 'Prioritize capital preservation with established large-cap assets and lower volatility.',
  moderate: 'Blend stability and growth using large-cap leaders plus selected mid-cap opportunities.',
  aggressive: 'Pursue higher upside with a broader mix of majors and stronger altcoins.',
};

function isAdvisorCoinContext(
  coin: AdvisorCoinContext | Awaited<ReturnType<typeof getTopCoins>>[number],
): coin is AdvisorCoinContext {
  return 'target_price' in coin || 'predicted_price' in coin || 'confidence_score' in coin || 'coin' in coin;
}

function normalizeCoins(
  coins: (AdvisorCoinContext | Awaited<ReturnType<typeof getTopCoins>>[number])[],
  fallbackCoins: Awaited<ReturnType<typeof getTopCoins>>,
  ghsRate: number,
) {
  return coins
    .slice(0, 50)
    .map((coin, index): NormalizedAdvisorCoin => {
      const fallback = fallbackCoins.find((item) => item.symbol.toUpperCase() === coin.symbol.toUpperCase());
      const advisorCoin = isAdvisorCoinContext(coin) ? coin : undefined;
      const currentPrice = advisorCoin?.priceUSD ?? coin.current_price ?? fallback?.current_price ?? 0;
      const priceGhs = advisorCoin?.priceGHS ?? currentPrice * ghsRate;

      return {
        id: coin.id ?? fallback?.id ?? `${coin.symbol.toLowerCase()}-${index}`,
        name: coin.name ?? advisorCoin?.coin ?? fallback?.name ?? coin.symbol.toUpperCase(),
        symbol: coin.symbol.toUpperCase(),
        image: coin.image ?? fallback?.image ?? '',
        current_price: currentPrice,
        price_ghs: priceGhs,
        min_investment_ghs: advisorCoin?.minInvestmentGHS ?? priceGhs * 0.001,
        market_cap: advisorCoin?.marketCap ?? fallback?.market_cap ?? 0,
        volume_24h: advisorCoin?.volume24h ?? fallback?.total_volume ?? 0,
        price_change_percentage_24h: coin.price_change_percentage_24h ?? fallback?.price_change_percentage_24h ?? 0,
        price_change_percentage_7d_in_currency:
          coin.price_change_percentage_7d_in_currency ?? fallback?.price_change_percentage_7d_in_currency ?? 0,
        market_cap_rank: coin.market_cap_rank ?? fallback?.market_cap_rank ?? index + 1,
        target_price: advisorCoin?.target_price ?? advisorCoin?.predicted_price,
        bullish_target_price: advisorCoin?.bullish_target_price,
        neutral_target_price: advisorCoin?.neutral_target_price,
        bearish_target_price: advisorCoin?.bearish_target_price,
        confidence_score: advisorCoin?.confidence_score,
        prediction_horizon: advisorCoin?.prediction_horizon,
        reason: advisorCoin?.reason,
      };
    })
    .filter((coin) => coin.current_price > 0);
}

function buildCoinsContext(coins: NormalizedAdvisorCoin[]) {
  return coins
    .map((coin, index) =>
      [
        `${index + 1}. ${coin.name} (${coin.symbol})`,
        `USD Price: $${coin.current_price.toLocaleString()}`,
        `GHS Price: GHS ${coin.price_ghs.toFixed(2)}`,
        `Min Investment GHS: ${coin.min_investment_ghs.toFixed(4)}`,
        `Market Cap: $${coin.market_cap.toLocaleString()}`,
        `24h Volume: $${coin.volume_24h.toLocaleString()}`,
        `24h Change: ${(coin.price_change_percentage_24h ?? 0).toFixed(2)}%`,
        `7d Change: ${(coin.price_change_percentage_7d_in_currency ?? 0).toFixed(2)}%`,
        `Market Cap Rank: #${coin.market_cap_rank}`,
        coin.target_price ? `Base Target: $${coin.target_price.toLocaleString()}` : null,
        coin.bullish_target_price ? `Bullish Target: $${coin.bullish_target_price.toLocaleString()}` : null,
        coin.neutral_target_price ? `Neutral Target: $${coin.neutral_target_price.toLocaleString()}` : null,
        coin.bearish_target_price ? `Bearish Target: $${coin.bearish_target_price.toLocaleString()}` : null,
        coin.confidence_score ? `Confidence: ${coin.confidence_score}%` : null,
        coin.prediction_horizon ? `Prediction Horizon: ${coin.prediction_horizon}` : null,
        coin.reason ? `Context: ${coin.reason}` : null,
      ].filter(Boolean).join(' | '),
    )
    .join('\n');
}

export async function generatePortfolioAdvice(
  amount: number,
  currency: 'GHS' | 'USD',
  timeframe: string,
  riskLevel: 'conservative' | 'moderate' | 'aggressive',
  topCoinsData?: AdvisorCoinContext[],
  affordabilityWarning?: string,
): Promise<PortfolioAdvice> {
  const contextKey = topCoinsData?.length
    ? topCoinsData
        .slice(0, 50)
        .map((coin) => `${coin.symbol}:${coin.priceUSD ?? coin.current_price}:${coin.target_price ?? coin.predicted_price ?? ''}`)
        .join('|')
    : 'live_market_data';
  const cacheKey = `${amount}_${currency}_${timeframe}_${riskLevel}_${contextKey}_${affordabilityWarning ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const [fallbackCoins, ghsRate] = await Promise.all([getTopCoins(50), getGHSRate()]);
  const coins = normalizeCoins(topCoinsData?.length ? topCoinsData : fallbackCoins, fallbackCoins, ghsRate);

  const amountUSD = currency === 'GHS' ? amount / ghsRate : amount;
  const amountGHS = currency === 'USD' ? amount * ghsRate : amount;
  const horizonLabel = TIMEFRAME_MAP[timeframe] ?? timeframe;
  const coinsContext = buildCoinsContext(coins);

  const prompt = `You are PredX's senior AI portfolio analyst.

Investor profile:
- Investment Amount: $${amountUSD.toFixed(2)} USD (GHS ${amountGHS.toFixed(2)})
- Time Horizon: ${horizonLabel}
- Risk Level: ${riskLevel.toUpperCase()} - ${RISK_DESCRIPTION[riskLevel]}
${affordabilityWarning ? `- Budget Note: ${affordabilityWarning}` : ''}

Pre-filtered affordable coins:
${coinsContext}

Exchange rate:
1 USD = ${ghsRate.toFixed(2)} GHS

CRITICAL RULES - follow these exactly:
- The user has ${amount.toFixed(2)} ${currency} to invest
- You can ONLY recommend coins from this pre-filtered affordable list
- NEVER recommend Bitcoin if the budget is under $100 unless suggesting a fraction worth exactly the budget
- Every recommended allocation must be reachable - if recommending 30% of the budget, that amount must buy a real amount of that coin
- Always show the exact amount in GHS and how many units or fractions that buys
- If budget is under GHS 100, lead with a gentle warning about risk and small portfolio size
- Diversification minimum: at least 2 coins unless budget is under GHS 50
- Maximum single coin allocation: 60% of budget
- Do not include any allocation whose USD amount is below $0.50

Instructions:
1. Select 2-6 coins appropriate for this risk profile and timeframe
2. Allocations must sum to exactly 100
3. Price targets must be realistic for the timeframe
4. Reasons must be exactly 1 sentence each
5. For each allocation, calculate units_purchasable = amount_usd / current_price
6. Set is_fractional to true when units_purchasable is less than 1
7. affordability_note must explicitly say how many units the user can buy with the allocation amount

Respond with ONLY valid JSON:
{
  "recommended_allocation": [
    {
      "coin": "<full name>",
      "symbol": "<uppercase symbol>",
      "percentage": <integer>,
      "amount_usd": <number>,
      "amount_ghs": <number>,
      "units_purchasable": <number>,
      "is_fractional": <boolean>,
      "affordability_note": "<example: You can buy 45 XRP with GHS 150>",
      "current_price": <number>,
      "target_price": <number>,
      "potential_value_usd": <number>,
      "potential_value_ghs": <number>,
      "reason": "<one sentence>"
    }
  ],
  "total_potential_value_usd": <number>,
  "total_potential_value_ghs": <number>,
  "potential_gain_percent": <number>,
  "scenario_bullish": { "total_value_usd": <number>, "total_value_ghs": <number>, "gain_percent": <number> },
  "scenario_neutral": { "total_value_usd": <number>, "total_value_ghs": <number>, "gain_percent": <number> },
  "scenario_bearish": { "total_value_usd": <number>, "total_value_ghs": <number>, "gain_percent": <number> },
  "strategy_summary": "<up to 3 sentences>",
  "warning": "Crypto is highly volatile. Never invest more than you can afford to lose. This is not financial advice.",
  "affordability_warning": "${affordabilityWarning ?? ''}"
}`;

  let parsed: Omit<
    PortfolioAdvice,
    'recommended_allocation' | 'total_invested_usd' | 'total_invested_ghs' | 'risk_level' | 'timeframe' | 'generated_at' | 'ghs_rate'
  > & { recommended_allocation: Array<Omit<CoinAllocation, 'image'>> };

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to generate portfolio advice after retry');
    parsed = JSON.parse(jsonMatch[0]);
  }

  const coinMap = new Map(coins.map((coin) => [coin.symbol.toUpperCase(), coin]));
  const allocations: CoinAllocation[] = parsed.recommended_allocation
    .filter((allocation) => Number(allocation.amount_usd) >= 0.5)
    .map((allocation) => {
      const coin = coinMap.get(allocation.symbol.toUpperCase());
      const units = Number(
        allocation.units_purchasable ??
          (allocation.current_price > 0 ? allocation.amount_usd / allocation.current_price : 0),
      );
      const amountGhsValue = Number(allocation.amount_ghs ?? allocation.amount_usd * ghsRate);
      const symbol = allocation.symbol.toUpperCase();
      return {
        ...allocation,
        image: coin?.image ?? '',
        units_purchasable: units,
        is_fractional: allocation.is_fractional ?? units < 1,
        affordability_note:
          allocation.affordability_note ??
          `You can buy ${units.toFixed(units >= 1 ? 2 : 6)} ${symbol} with GHS ${amountGhsValue.toFixed(2)}`,
      };
    });

  const result: PortfolioAdvice = {
    ...parsed,
    recommended_allocation: allocations,
    total_invested_usd: amountUSD,
    total_invested_ghs: amountGHS,
    risk_level: riskLevel,
    timeframe: horizonLabel,
    generated_at: new Date().toISOString(),
    ghs_rate: ghsRate,
    affordability_warning: parsed.affordability_warning || affordabilityWarning,
  };

  cache.set(cacheKey, { data: result, expires: Date.now() + 30 * 60_000 });
  return result;
}
