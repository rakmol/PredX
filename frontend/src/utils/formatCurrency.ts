export function formatUSD(price: number, compact = false): string {
  if (price === null || price === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: price < 1 ? 4 : price < 100 ? 2 : 0,
    maximumFractionDigits: price < 1 ? 6 : price < 100 ? 2 : 0,
  }).format(price);
}

export function formatGHS(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPct(value: number, showPlus = true): string {
  const sign = value > 0 && showPlus ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export function formatPrice(price: number, currency = 'USD', compact = false): string {
  if (currency === 'GHS') return formatGHS(price);
  return formatUSD(price, compact);
}
