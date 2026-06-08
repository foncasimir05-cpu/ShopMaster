const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');

const router = express.Router();

// GET /api/v1/products
router.get('/', (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 50 } = req.query;
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM products WHERE tenant_id = ?';
    const params = [req.shopId];

    if (search) {
      query += ' AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    res.json(dbAll(db, query, params));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/low-stock — must be before /:id
router.get('/low-stock', (req, res, next) => {
  try {
    const db = getDb();
    res.json(dbAll(db,
      'SELECT * FROM products WHERE tenant_id = ? AND min_stock > 0 AND stock <= min_stock ORDER BY stock ASC',
      [req.shopId]
    ));
  } catch (err) { next(err); }
});

// GET /api/v1/products/:id
router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const product = dbGet(db,
      'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products
router.post('/', (req, res, next) => {
  try {
    const { name, sku, barcode, price, cost, stock, category, min_stock } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const db = getDb();
    const id = uuidv4();
    dbRun(db,
      `INSERT INTO products (id, tenant_id, name, sku, barcode, price, cost, stock, category, min_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.shopId, name, sku, barcode, price ?? 0, cost ?? 0, stock ?? 0, category, min_stock ?? 0]
    );

    res.status(201).json(dbGet(db, 'SELECT * FROM products WHERE id = ?', [id]));
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/products/:id
router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const existing = dbGet(db,
      'SELECT id FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { name, sku, barcode, price, cost, stock, category, min_stock } = req.body;
    dbRun(db,
      `UPDATE products SET name=COALESCE(?,name), sku=COALESCE(?,sku), barcode=COALESCE(?,barcode),
       price=COALESCE(?,price), cost=COALESCE(?,cost), stock=COALESCE(?,stock),
       category=COALESCE(?,category), min_stock=COALESCE(?,min_stock), updated_at=datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [name, sku, barcode, price, cost, stock, category, min_stock ?? null, req.params.id, req.shopId]
    );

    res.json(dbGet(db, 'SELECT * FROM products WHERE id = ?', [req.params.id]));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/products/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const info = dbRun(db,
      'DELETE FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
