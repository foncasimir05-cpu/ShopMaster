import { getItem, setItem } from './storage';

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
