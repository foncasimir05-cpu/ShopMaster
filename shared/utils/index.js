/**
 * Formats a number as a currency string.
 * @param {number} amount
 * @param {string} [currency='USD']
 * @returns {string}
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

/**
 * Returns a human-readable relative time (e.g. "2 minutes ago").
 * @param {string|Date} date
 * @returns {string}
 */
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Computes cart totals from an array of CartItems.
 * @param {import('../types').CartItem[]} items
 * @param {{ discount?: number; taxRate?: number }} [opts]
 * @returns {{ subtotal: number; discount: number; tax: number; total: number }}
 */
function computeCartTotals(items, opts = {}) {
  const subtotal = items.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  const discount = opts.discount ?? 0;
  const tax = (subtotal - discount) * (opts.taxRate ?? 0);
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

/**
 * Validates that a barcode string is non-empty and alphanumeric.
 * @param {string} barcode
 * @returns {boolean}
 */
function isValidBarcode(barcode) {
  return typeof barcode === 'string' && /^[A-Za-z0-9\-_]{1,50}$/.test(barcode);
}

module.exports = { formatCurrency, timeAgo, computeCartTotals, isValidBarcode };
