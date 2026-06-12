const { dbAll } = require('../config/dbHelpers');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// In-memory dedup: don't send another push for the same product within 1 hour.
// This prevents spam when a product stays below min_stock across many sales.
const alerted = new Map(); // key: `${tenantId}:${productId}`, value: epochMs

function shouldAlert(tenantId, productId) {
  const key = `${tenantId}:${productId}`;
  const last = alerted.get(key);
  const now = Date.now();
  if (last && now - last < 60 * 60 * 1000) return false;
  alerted.set(key, now);
  return true;
}

async function sendPush(db, tenantId, { title, body, data = {} }) {
  try {
    const rows = await dbAll(db, 'SELECT token FROM push_tokens WHERE tenant_id = ?', [tenantId]);
    if (!rows.length) return;

    // Expo API accepts max 100 messages per request
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map(r => ({
        to: r.token,
        sound: 'default',
        title,
        body,
        data,
      }));
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
    }
  } catch (err) {
    console.error('[Push] failed:', err.message);
  }
}

async function sendLowStockPush(db, tenantId, product) {
  if (!shouldAlert(tenantId, product.id)) return;
  await sendPush(db, tenantId, {
    title: '⚠️ Low Stock Alert',
    body: `${product.name} has only ${product.stock} unit${product.stock !== 1 ? 's' : ''} left.`,
    data: { type: 'low_stock', productId: product.id },
  });
}

module.exports = { sendPush, sendLowStockPush };
