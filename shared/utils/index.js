/**
 * Formats a number using Intl.NumberFormat for the given currency code and locale.
 * @param {number|null|undefined} amount
 * @param {string} [currency='XAF']
 * @param {string} [locale]
 * @returns {string}
 */
function formatCurrency(amount, currency, locale) {
  const code = currency ?? 'XAF';
  const n = amount === null || amount === undefined ? 0 : Number(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toLocaleString(locale)}`;
  }
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
