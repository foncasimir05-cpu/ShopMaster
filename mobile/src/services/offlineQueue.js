import { getItem, setItem } from './storage';

const PRODUCTS_KEY = 'shopmaster_products_cache';
const SALES_QUEUE_KEY = 'shopmaster_pending_sales';

export async function cacheProducts(products) {
  try { await setItem(PRODUCTS_KEY, JSON.stringify(products)); } catch {}
}

export async function getCachedProducts() {
  try {
    const raw = await getItem(PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function queueSale(saleData) {
  try {
    const raw = await getItem(SALES_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    queue.push({ localId, data: saleData, queuedAt: new Date().toISOString() });
    await setItem(SALES_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) { console.warn('queueSale error:', e); }
}

export async function getPendingSales() {
  try {
    const raw = await getItem(SALES_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function removePendingSale(localId) {
  try {
    const sales = await getPendingSales();
    await setItem(SALES_QUEUE_KEY, JSON.stringify(sales.filter(s => s.localId !== localId)));
  } catch {}
}

export async function getPendingCount() {
  const sales = await getPendingSales();
  return sales.length;
}
