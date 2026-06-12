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

// Convenience alias — existing callers in POSScreen stay unchanged
export const queueSale = (data) => queueOperation('sale', data);

export async function getPendingOperations() {
  try {
    const raw = await getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(op => ({
      // Normalise old format ({ localId, data }) to new format
      clientId: op.clientId ?? op.localId,
      type:     op.type ?? 'sale',
      data:     op.data,
      queuedAt: op.queuedAt,
    }));
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
