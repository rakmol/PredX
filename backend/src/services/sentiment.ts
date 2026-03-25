// Sentiment Analysis Service
// Aggregates Fear & Greed index + news sentiment scoring via Claude

import Anthropic from '@anthropic-ai/sdk';
import { getFearGreedIndex } from './marketData';
import { SentimentData } from '../types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simple cache for sentiment (expensive to compute)
const sentimentCache = new Map<string, { data: SentimentData; expires: number }>();

export async function getSentimentAnalysis(coinId: string, coinName: string, coinSymbol: string): Promise<SentimentData> {
  const key = `sentiment_${coinId}`;
  const cached = sentimentCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const fearGreed = await getFearGreedIndex();

  // Use Claude to reason about sentiment from coin context
  const prompt = `You are a professional crypto market analyst. Analyze the current market sentiment for ${coinName} (${coinSymbol.toUpperCase()}).

The current overall market Fear & Greed Index is ${fearGreed.value}/100 (${fearGreed.label}).

Based on your knowledge of:
1. ${coinName}'s recent price action and market position
2. General crypto market conditions as of your knowledge cutoff
3. On-chain fundamentals for ${coinName}
4. Social and news sentiment trends

Provide a JSON response ONLY (no extra text) with this exact structure:
{
  "news_sentiment_score": <number from -1.0 (very bearish) to 1.0 (very bullish)>,
  "social_sentiment_score": <number from -1.0 to 1.0>,
  "overall_sentiment": <"very_bearish" | "bearish" | "neutral" | "bullish" | "very_bullish">,
  "sentiment_summary": "<2-3 sentences summarizing sentiment for ${coinName} right now>"
}`;

  let news_sentiment_score = 0;
  let social_sentiment_score = 0;
  let overall_sentiment: SentimentData['overall_sentiment'] = 'neutral';
  let sentiment_summary = `Market sentiment for ${coinName} is currently neutral. The Fear & Greed Index stands at ${fearGreed.value} (${fearGreed.label}).`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      news_sentiment_score = parsed.news_sentiment_score ?? 0;
      social_sentiment_score = parsed.social_sentiment_score ?? 0;
      overall_sentiment = parsed.overall_sentiment ?? 'neutral';
      sentiment_summary = parsed.sentiment_summary ?? sentiment_summary;
    }
  } catch {
    // Fall back to Fear & Greed derived sentiment
    if (fearGreed.value >= 75) overall_sentiment = 'very_bullish';
    else if (fearGreed.value >= 55) overall_sentiment = 'bullish';
    else if (fearGreed.value >= 45) overall_sentiment = 'neutral';
    else if (fearGreed.value >= 25) overall_sentiment = 'bearish';
    else overall_sentiment = 'very_bearish';
    news_sentiment_score = (fearGreed.value - 50) / 50;
    social_sentiment_score = (fearGreed.value - 50) / 50;
  }

  const result: SentimentData = {
    fear_greed_index: fearGreed.value,
    fear_greed_label: fearGreed.label,
    news_sentiment_score,
    social_sentiment_score,
    overall_sentiment,
    sentiment_summary,
  };

  sentimentCache.set(key, { data: result, expires: Date.now() + 3_600_000 }); // 1 hr
  return result;
}
