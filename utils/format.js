const numberFormatter = new Intl.NumberFormat('da-DK');
const twoDecimalFormatter = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const currencyFormatter = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
});

/**
 * Rounds amount to the nearest half krone (0.00 or 0.50)
 * Formula: floor((amount * 2) + 0.5) / 2
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount ending in .00 or .50
 */
export function roundToHalfKrone(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  return Math.floor((amount * 2) + 0.5) / 2;
}

/**
 * Formats a price with rounding to half krone, ensuring it ends in .00 or .50
 * @param {number} amount - Amount to format
 * @returns {string} Formatted price string
 */
export function formatPriceHalfKrone(amount) {
  const rounded = roundToHalfKrone(amount);
  return numberFormatter.format(rounded);
}

/**
 * Formats a price with rounding to half krone the way a price tag reads:
 * whole kroner without decimals ("1.275"), half kroner with two ("1.657,50")
 * @param {number} amount - Amount to format
 * @returns {string} Formatted price string
 */
export function formatPriceTagHalfKrone(amount) {
  const rounded = roundToHalfKrone(amount);
  return Number.isInteger(rounded)
    ? numberFormatter.format(rounded)
    : twoDecimalFormatter.format(rounded);
}

/**
 * Formats a currency amount with rounding to half krone
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrencyHalfKrone(amount) {
  const rounded = roundToHalfKrone(amount);
  return currencyFormatter.format(rounded);
}
