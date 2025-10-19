/**
 * Format token amounts with M/B suffixes
 */
export function formatTokenAmount(amount: number, includeToken = true): string {
  const billion = 1_000_000_000;
  const million = 1_000_000;
  
  let formatted: string;
  
  if (amount >= billion) {
    formatted = `${(amount / billion).toFixed(2)}B`;
  } else if (amount >= million) {
    formatted = `${(amount / million).toFixed(2)}M`;
  } else if (amount >= 1000) {
    formatted = `${(amount / 1000).toFixed(2)}K`;
  } else {
    formatted = amount.toFixed(2);
  }
  
  return includeToken ? `${formatted} GARG` : formatted;
}

/**
 * Format large numbers with commas and optional M/B suffix
 */
export function formatNumber(num: number): string {
  const billion = 1_000_000_000;
  const million = 1_000_000;
  
  if (num >= billion) {
    return `${(num / billion).toFixed(2)}B`;
  } else if (num >= million) {
    return `${(num / million).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  } else {
    return num.toLocaleString();
  }
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
