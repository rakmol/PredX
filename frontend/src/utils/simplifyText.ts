// Plain-English explanations for technical trading terms

export const TERM_EXPLANATIONS: Record<string, string> = {
  RSI: 'measures how fast a price is moving — high RSI means it rose too fast and may slow down',
  MACD: 'tracks whether buyers or sellers are gaining the upper hand',
  'Bollinger Bands': 'shows whether the price is unusually high, low, or calm compared to recent history',
  'Moving Average': 'smooths out price data to show the overall direction a coin is heading',
  Volume: 'how many people are trading this coin — high volume means strong interest',
  Support: 'a price level the coin tends to bounce back up from when it falls',
  Resistance: 'a price level the coin struggles to break above',
  Volatility: 'how wildly the price jumps around — high volatility means bigger swings up and down',
  Bullish: 'signals suggest the price is likely to go up',
  Bearish: 'signals suggest the price is likely to go down',
  Divergence: 'the price and an indicator are moving in opposite directions — often a warning sign',
  Crossover: 'one trend line has overtaken another — usually signals a change in direction',
  Overbought: 'the price has risen so fast that a pullback is likely soon',
  Oversold: 'the price has fallen so fast that a recovery is likely soon',
};

/**
 * Returns the plain-English explanation for the first matching technical term
 * found in the given string, or an empty string if no match.
 */
export function getTermExplanation(text: string): string {
  const entry = Object.entries(TERM_EXPLANATIONS).find(([term]) =>
    text.toLowerCase().includes(term.toLowerCase()),
  );
  return entry ? entry[1] : '';
}

/**
 * Splits a risk/opportunity string on " — " into a bold observation and a
 * gray plain-English explanation. Falls back to the full string as bold with
 * an empty explanation when the separator is absent.
 */
export function splitObservation(text: string): { bold: string; plain: string } {
  const idx = text.indexOf(' — ');
  if (idx !== -1) {
    return { bold: text.slice(0, idx), plain: text.slice(idx + 3) };
  }
  // fallback: dash without surrounding spaces
  const dashIdx = text.indexOf(' - ');
  if (dashIdx !== -1) {
    return { bold: text.slice(0, dashIdx), plain: text.slice(dashIdx + 3) };
  }
  return { bold: text, plain: '' };
}
