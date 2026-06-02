const express = require('express');
const { getDb } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/inventory  — list products with stock info
router.get('/', (req, res, next) => {
  try {
    const { lowStock } = req.query;
    const db = getDb();

    let query = `SELECT id, name, sku, barcode, stock, category FROM products WHERE tenant_id = ?`;
    const params = [req.user.tenantId];

    if (lowStock === 'true') {
      query += ' AND stock <= 5';
    }

    query += ' ORDER BY stock ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/inventory/:productId/adjust  — manual stock adjustment (admin only)
router.patch('/:productId/adjust', requireRole('admin'), (req, res, next) => {
  try {
    const { delta, reason } = req.body;
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'delta (number) is required' });
    }

    const db = getDb();
    const product = db
      .prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?')
      .get(req.params.productId, req.user.tenantId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newStock = Math.max(0, product.stock + delta);
    db.prepare(
      "UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newStock, req.params.productId);

    res.json({ productId: req.params.productId, previousStock: product.stock, newStock, delta, reason });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
