import { getItem, setItem, removeItem } from './storage';

const PRODUCTS_KEY = 'shopmaster_products_cache';
const QUEUE_KEY    = 'shopmaster_pending_sales'; // keep old key — handles in-flight items

// ── Product cache ─────────────────────────────────────────────────────────────

export async function cacheProducts(products) {
  try { await setItem(PRODUCTS_KEY, JSON.stringify(products)); } catch {}
}

export async function getCachedProducts() {
  try {
    const raw = await getItem(PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Customer cache ────────────────────────────────────────────────────────────

const CUSTOMERS_KEY = 'shopmaster_customers_cache';

export async function cacheCustomers(customers) {
  try { await setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {}
}

export async function getCachedCustomers() {
  try {
    const raw = await getItem(CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Settings cache ────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'shopmaster_settings_cache';

export async function cacheSettings(s) {
  try { await setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}
export async function getCachedSettings() {
  try { const r = await getItem(SETTINGS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

// ── Sales cache (recent page) ─────────────────────────────────────────────────

const SALES_KEY = 'shopmaster_sales_cache';

export async function cacheSales(sales) {
  try { await setItem(SALES_KEY, JSON.stringify(sales)); } catch {}
}
export async function getCachedSales() {
  try { const r = await getItem(SALES_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

// ── Analytics cache ───────────────────────────────────────────────────────────

const ANALYTICS_KEY = 'shopmaster_analytics_cache';

export async function cacheAnalytics(data) {
  try { await setItem(ANALYTICS_KEY, JSON.stringify(data)); } catch {}
}
export async function getCachedAnalytics() {
  try { const r = await getItem(ANALYTICS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

// ── Promotions cache ──────────────────────────────────────────────────────────

const PROMOTIONS_KEY = 'shopmaster_promotions_cache';

export async function cachePromotions(promos) {
  try { await setItem(PROMOTIONS_KEY, JSON.stringify(promos)); } catch {}
}
export async function getCachedPromotions() {
  try { const r = await getItem(PROMOTIONS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

// ── Operations queue ──────────────────────────────────────────────────────────
// Each entry: { clientId, type, data, queuedAt }
// Old entries (pre-generalisation) had { localId, data } — handled transparently.

export async function queueOperation(type, data) {
  try {
    const raw = await getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({
      clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      data,
      queuedAt: new Date().toISOString(),
    });
    await setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) { console.warn('queueOperation error:', e); }
}

// Convenience aliases
export const queueSale           = (data) => queueOperation('sale', data);
export const queueExpense        = (data) => queueOperation('expense', data);
export const queueStockAdjust    = (data) => queueOperation('stock_adjustment', data);
export const queueCreateCustomer = (data) => queueOperation('create_customer', data);

// Pure normalisation — exported for unit tests and reuse
export function normalizeOp(op) {
  return {
    clientId: op.clientId ?? op.localId,
    type:     op.type ?? 'sale',
    data:     op.data,
    queuedAt: op.queuedAt,
  };
}

export async function getPendingOperations() {
  try {
    const raw = await getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(normalizeOp);
  } catch { return []; }
}

// Backward-compat alias
export const getPendingSales = getPendingOperations;

export async function removeOperation(clientId) {
  try {
    const raw = await getItem(QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw).filter(op =>
      (op.clientId ?? op.localId) !== clientId
    );
    await setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

// Backward-compat alias
export const removePendingSale = removeOperation;

export async function getPendingCount() {
  const ops = await getPendingOperations();
  return ops.length;
}

// ── Cache reset (call on logout so the next user starts fresh) ────────────────

export async function clearAllCaches() {
  try {
    await Promise.all([
      removeItem(PRODUCTS_KEY),
      removeItem(CUSTOMERS_KEY),
      removeItem(SETTINGS_KEY),
      removeItem(SALES_KEY),
      removeItem(ANALYTICS_KEY),
      removeItem(PROMOTIONS_KEY),
      removeItem(QUEUE_KEY),
      removeItem('last_pull_sync'),
      removeItem('shopmaster_last_synced_at'),
    ]);
  } catch {}
}
