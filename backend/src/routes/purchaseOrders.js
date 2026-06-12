const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// GET /api/v1/purchase-orders
router.get('/', (req, res, next) => {
  try {
    const { status } = req.query;
    const db = getDb();
    let query = `
      SELECT po.*, s.name as supplier_name,
             COUNT(poi.id) as item_count,
             COALESCE(SUM(poi.subtotal), 0) as total_amount
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      WHERE po.tenant_id = ?`;
    const params = [req.shopId];
    if (status && status !== 'all') { query += ' AND po.status = ?'; params.push(status); }
    query += ' GROUP BY po.id ORDER BY po.created_at DESC';
    res.json(dbAll(db, query, params));
  } catch (err) { next(err); }
});

// GET /api/v1/purchase-orders/:id
router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const po = dbGet(db,
      `SELECT po.*, s.name as supplier_name FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.id = ? AND po.tenant_id = ?`,
      [req.params.id, req.shopId]
    );
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const items = dbAll(db,
      `SELECT poi.*, p.name as product_name, p.sku, p.stock as current_stock
       FROM purchase_order_items poi
       JOIN products p ON poi.product_id = p.id
       WHERE poi.purchase_order_id = ?`,
      [req.params.id]
    );
    res.json({ ...po, items });
  } catch (err) { next(err); }
});

// POST /api/v1/purchase-orders
router.post('/', [...v.createPurchaseOrder, validate], (req, res, next) => {
  try {
    const { supplierId, items, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const db = getDb();
    const id = uuidv4();

    dbTransaction(db, () => {
      dbRun(db,
        'INSERT INTO purchase_orders (id, tenant_id, supplier_id, status, notes, created_by) VALUES (?,?,?,?,?,?)',
        [id, req.shopId, supplierId ?? null, 'pending', notes ?? null, req.user.id]
      );
      for (const item of items) {
        const product = dbGet(db, 'SELECT id FROM products WHERE id = ? AND tenant_id = ?', [item.productId, req.shopId]);
        if (!product) throw Object.assign(new Error(`Product ${item.productId} not found`), { status: 404 });
        const qty = parseInt(item.qtyOrdered, 10) || 0;
        const cost = parseFloat(item.unitCost) || 0;
        dbRun(db,
          'INSERT INTO purchase_order_items (id, purchase_order_id, product_id, qty_ordered, unit_cost, subtotal) VALUES (?,?,?,?,?,?)',
          [uuidv4(), id, item.productId, qty, cost, qty * cost]
        );
      }
    });

    res.status(201).json(dbGet(db, 'SELECT * FROM purchase_orders WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

// PUT /api/v1/purchase-orders/:id/receive
router.put('/:id/receive', (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    const db = getDb();
    const po = dbGet(db, 'SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'received') return res.status(409).json({ error: 'Already fully received' });

    dbTransaction(db, () => {
      for (const { itemId, qtyReceived } of items) {
        const qty = parseInt(qtyReceived, 10);
        if (!qty || qty <= 0) continue;
        const poItem = dbGet(db,
          'SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?',
          [itemId, req.params.id]
        );
        if (!poItem) continue;
        dbRun(db, 'UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?', [qty, itemId]);
        dbRun(db, "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?", [qty, poItem.product_id]);
        if (poItem.unit_cost > 0) {
          dbRun(db, "UPDATE products SET cost = ?, updated_at = datetime('now') WHERE id = ?", [poItem.unit_cost, poItem.product_id]);
        }
        dbRun(db,
          'INSERT INTO stock_movements (id, tenant_id, product_id, delta, type, reason) VALUES (?,?,?,?,?,?)',
          [uuidv4(), req.shopId, poItem.product_id, qty, 'purchase', `PO #${req.params.id.slice(0, 8).toUpperCase()}`]
        );
      }
      const allItems = dbAll(db, 'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
      const allReceived = allItems.every(i => i.qty_received >= i.qty_ordered);
      const newStatus = allReceived ? 'received' : 'partial';
      dbRun(db, "UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?", [newStatus, req.params.id]);
    });

    res.json({ message: 'Stock received', poId: req.params.id });
  } catch (err) { next(err); }
});

// DELETE /api/v1/purchase-orders/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const po = dbGet(db, 'SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'pending') return res.status(409).json({ error: 'Only pending orders can be deleted' });
    dbRun(db, 'DELETE FROM purchase_orders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Purchase order deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
