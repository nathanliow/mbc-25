export function formatNumber(value: number, maxDecimals: number = 4): string {
  if (!Number.isFinite(value)) return "0";

  const abs = Math.abs(value);

  // Integers or effectively integers → no decimals
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return Math.round(value).toLocaleString("en-US");
  }

  // General case: trim trailing zeros up to maxDecimals
  const fixed = value.toFixed(maxDecimals);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed;
}


