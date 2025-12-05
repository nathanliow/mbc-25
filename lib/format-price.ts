/**
 * Format price with subscript notation for very small numbers
 * For numbers < 0.01, shows format like: 0.0₆354 (6 leading zeros, then 3 significant digits)
 */

const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

/**
 * Convert a number to subscript string
 */
function toSubscript(num: number): string {
  return num
    .toString()
    .split("")
    .map((char) => {
      if (char >= "0" && char <= "9") {
        return SUBSCRIPT_DIGITS[parseInt(char)];
      }
      return char;
    })
    .join("");
}

/**
 * Format a price value
 * For very small numbers (< 0.01), uses subscript notation
 * Otherwise uses standard toFixed(2)
 */
export function formatPrice(price: number): string {
  if (price <= 0) {
    return "0.00";
  }

  // If price is >= 0.01, use standard formatting
  if (price >= 0.01) {
    return price.toFixed(2);
  }

  // For very small numbers, use subscript notation
  // Convert to string to count leading zeros
  const priceStr = price.toFixed(20); // Use high precision to avoid scientific notation
  const decimalPart = priceStr.split(".")[1];
  
  if (!decimalPart) {
    return "0.00";
  }

  // Find first non-zero digit
  let leadingZeros = 0;
  let firstNonZeroIndex = -1;
  
  for (let i = 0; i < decimalPart.length; i++) {
    if (decimalPart[i] !== "0") {
      firstNonZeroIndex = i;
      leadingZeros = i;
      break;
    }
  }

  if (firstNonZeroIndex === -1) {
    return "0.00";
  }

  // Get 3 significant digits starting from first non-zero
  const significantDigits = decimalPart
    .substring(firstNonZeroIndex, firstNonZeroIndex + 3)
    .padEnd(3, "0");

  // Format as 0.0ₙXXX where n is the number of leading zeros
  return `0.0${toSubscript(leadingZeros)}${significantDigits}`;
}

