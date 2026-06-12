const express = require('express');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/inventory
router.get('/', async (req, res, next) => {
  try {
    const { lowStock } = req.query;
    const db = getDb();

    let query = `SELECT id, name, sku, barcode, stock, category FROM products WHERE tenant_id = ?`;
    const params = [req.shopId];

    if (lowStock === 'true') {
      query += ' AND stock <= 5';
    }

    query += ' ORDER BY stock ASC';
    res.json(await dbAll(db, query, params));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/inventory/:productId/adjust
router.patch('/:productId/adjust', requireRole('admin'), async (req, res, next) => {
  try {
    const { delta, reason } = req.body;
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'delta (number) is required' });
    }

    const db = getDb();
    const product = await dbGet(db,
      'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.productId, req.shopId]
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newStock = Math.max(0, product.stock + delta);
    await dbRun(db,
      'UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?',
      [newStock, req.params.productId]
    );

    res.json({ productId: req.params.productId, previousStock: product.stock, newStock, delta, reason });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
