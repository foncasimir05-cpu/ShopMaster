const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');

const router = express.Router();

// POST /api/v1/sync/batch
// Accepts operations queued while offline and processes them idempotently.
// Body:  { operations: [{ clientId, type, data }] }
// Reply: { results: [{ clientId, status, data?, error? }] }
router.post('/batch', async (req, res, next) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ error: 'operations array required' });
    }
    if (operations.length > 100) {
      return res.status(400).json({ error: 'Max 100 operations per batch' });
    }

    const db = getDb();
    const results = [];

    for (const op of operations) {
      const { clientId, type, data } = op;
      if (!clientId || !type) {
        results.push({ clientId, status: 'error', error: 'clientId and type are required' });
        continue;
      }

      // Idempotency: skip if already processed
      const existing = await dbGet(db,
        'SELECT status FROM sync_operations WHERE client_id = ? AND tenant_id = ?',
        [clientId, req.shopId]
      );
      if (existing) {
        results.push({ clientId, status: existing.status === 'error' ? 'error' : 'already_processed' });
        continue;
      }

      try {
        let resultData;
        if (type === 'sale')             resultData = await processSale(db, req.shopId, req.user.id, data);
        else if (type === 'expense')     resultData = await processExpense(db, req.shopId, req.user.id, data);
        else if (type === 'stock_adjustment') resultData = await processAdjustment(db, req.shopId, data);
        else throw new Error(`Unknown operation type: ${type}`);

        await dbRun(db,
          'INSERT INTO sync_operations (client_id, tenant_id, type, status) VALUES (?,?,?,?)',
          [clientId, req.shopId, type, 'processed']
        );
        results.push({ clientId, status: 'ok', data: resultData });
      } catch (opErr) {
        // Record the failure so retries don't reprocess corrupt data
        await dbRun(db,
          'INSERT INTO sync_operations (client_id, tenant_id, type, status, error) VALUES (?,?,?,?,?)',
          [clientId, req.shopId, type, 'error', opErr.message]
        ).catch(() => {});
        results.push({ clientId, status: 'error', error: opErr.message });
      }
    }

    res.json({ results });
  } catch (err) { next(err); }
});

// GET /api/v1/sync/pull?since=ISO_TIMESTAMP
// Returns products, customers and promotions changed since the given timestamp.
router.get('/pull', async (req, res, next) => {
  try {
    const since = req.query.since || '1970-01-01T00:00:00.000Z';
    const db = getDb();

    const [products, customers, promotions] = await Promise.all([
      dbAll(db,
        'SELECT id, name, sku, barcode, price, cost, stock, min_stock, category, has_variants, is_deleted, updated_at FROM products WHERE tenant_id = ? AND updated_at > ?',
        [req.shopId, since]
      ),
      dbAll(db,
        'SELECT id, name, phone, email, loyalty_points, updated_at FROM customers WHERE tenant_id = ? AND updated_at > ?',
        [req.shopId, since]
      ),
      dbAll(db,
        'SELECT * FROM promotions WHERE tenant_id = ? AND is_active = 1 AND updated_at > ?',
        [req.shopId, since]
      ),
    ]);

    res.json({ syncedAt: new Date().toISOString(), products, customers, promotions });
  } catch (err) { next(err); }
});

// ── Operation handlers ────────────────────────────────────────────────────────

async function processSale(db, shopId, userId, data) {
  const { items, discount = 0, taxRate = 0, paymentMethod = 'cash', customerId } = data || {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('items required');

  const saleId = uuidv4();

  return await dbTransaction(db, async (client) => {
    let subtotal = 0;
    const resolved = [];

    for (const { productId, quantity, unitPrice } of items) {
      const product = await dbGet(client,
        'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
        [productId, shopId]
      );
      if (!product) throw new Error(`Product ${productId} not found`);
      if (product.stock < quantity) throw new Error(`Insufficient stock for "${product.name}"`);

      const price = unitPrice != null ? Number(unitPrice) : product.price;
      const lineTotal = price * quantity;
      subtotal += lineTotal;
      resolved.push({ productId, quantity, price, costPrice: product.cost ?? 0, lineTotal });
    }

    const discountAmount = Number(discount);
    const taxAmount = (subtotal - discountAmount) * Number(taxRate);
    const total = Math.max(0, subtotal - discountAmount + taxAmount);

    await dbRun(client,
      'INSERT INTO sales (id, tenant_id, user_id, total, discount, tax, payment_method, customer_id) VALUES (?,?,?,?,?,?,?,?)',
      [saleId, shopId, userId, total, discountAmount, taxAmount, paymentMethod, customerId || null]
    );

    for (const { productId, quantity, price, costPrice, lineTotal } of resolved) {
      await dbRun(client, 'UPDATE products SET stock = stock - ?, updated_at = NOW() WHERE id = ?', [quantity, productId]);
      await dbRun(client,
        'INSERT INTO stock_movements (id, tenant_id, product_id, sale_id, delta, type) VALUES (?,?,?,?,?,?)',
        [uuidv4(), shopId, productId, saleId, -quantity, 'sale']
      );
      await dbRun(client,
        'INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, cost_price, subtotal) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), saleId, productId, quantity, price, costPrice, lineTotal]
      );
    }

    return { saleId, total };
  });
}

async function processExpense(db, shopId, userId, data) {
  const { description, amount, category, date } = data || {};
  if (!description || !amount) throw new Error('description and amount required');

  const id = uuidv4();
  await dbRun(db,
    'INSERT INTO expenses (id, tenant_id, created_by, description, amount, category, date) VALUES (?,?,?,?,?,?,?)',
    [id, shopId, userId, description, Number(amount), category || 'Other', date || new Date().toISOString().split('T')[0]]
  );
  return { expenseId: id };
}

async function processAdjustment(db, shopId, data) {
  const { productId, quantity, note } = data || {};
  if (!productId || quantity == null) throw new Error('productId and quantity required');

  const product = await dbGet(db,
    'SELECT id FROM products WHERE id = ? AND tenant_id = ?',
    [productId, shopId]
  );
  if (!product) throw new Error('Product not found');

  await dbRun(db, 'UPDATE products SET stock = stock + ?, updated_at = NOW() WHERE id = ?', [quantity, productId]);
  await dbRun(db,
    'INSERT INTO stock_movements (id, tenant_id, product_id, delta, type, reason) VALUES (?,?,?,?,?,?)',
    [uuidv4(), shopId, productId, quantity, 'adjustment', note || null]
  );
  return { adjusted: true, newDelta: quantity };
}

module.exports = router;
