const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// GET /api/v1/products
router.get('/', async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 50, slim } = req.query;
    const safeLimit = Math.min(Number(limit), 200);
    const offset = (Number(page) - 1) * safeLimit;
    const db = getDb();

    // slim=true returns only the fields the mobile POS needs for browsing
    const cols = slim === 'true'
      ? 'id, name, sku, barcode, price, cost, stock, min_stock, category, has_variants'
      : '*';

    let where = 'WHERE tenant_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)';
    const params = [req.shopId];

    if (search) {
      where += ' AND (name ILIKE ? OR sku ILIKE ? OR barcode ILIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category) {
      where += ' AND category = ?';
      params.push(category);
    }

    const countRow = await dbGet(db, `SELECT COUNT(*) as total FROM products ${where}`, params);
    const rows = await dbAll(db,
      `SELECT ${cols} FROM products ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.set('X-Total-Count', String(countRow?.total ?? 0));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/low-stock — must be before /:id
router.get('/low-stock', async (req, res, next) => {
  try {
    const db = getDb();
    res.json(await dbAll(db,
      'SELECT * FROM products WHERE tenant_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND min_stock > 0 AND stock <= min_stock ORDER BY stock ASC',
      [req.shopId]
    ));
  } catch (err) { next(err); }
});

// GET /api/v1/products/export — CSV download (must be before /:id)
router.get('/export', async (req, res, next) => {
  try {
    const db = getDb();
    const products = await dbAll(db,
      'SELECT name, sku, barcode, price, cost, stock, category, min_stock FROM products WHERE tenant_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY name ASC',
      [req.shopId]
    );
    const header = 'name,sku,barcode,price,cost,stock,category,min_stock\n';
    const rows = products.map(p =>
      [p.name, p.sku ?? '', p.barcode ?? '', p.price, p.cost, p.stock, p.category ?? '', p.min_stock]
        .map(val => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="products.csv"' });
    res.send(header + rows);
  } catch (err) { next(err); }
});

// POST /api/v1/products/import — CSV body: { csv: "..." }  (must be before /:id)
router.post('/import', async (req, res, next) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv string required' });
    const db = getDb();
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    const parseRow = (line) => {
      const result = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
        else cur += line[i];
      }
      result.push(cur);
      return result;
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
    const idx = (name) => headers.indexOf(name);

    let created = 0, updated = 0, errors = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseRow(lines[i]);
        const name = cols[idx('name')]?.trim();
        if (!name) { errors.push(`Row ${i + 1}: name is required`); continue; }
        const sku = cols[idx('sku')]?.trim() || null;
        const barcode = cols[idx('barcode')]?.trim() || null;
        const price = parseFloat(cols[idx('price')]) || 0;
        const cost = parseFloat(cols[idx('cost')]) || 0;
        const stock = parseInt(cols[idx('stock')], 10) || 0;
        const category = cols[idx('category')]?.trim() || null;
        const min_stock = parseInt(cols[idx('min_stock')], 10) || 0;

        const existing = sku
          ? await dbGet(db, 'SELECT id FROM products WHERE sku = ? AND tenant_id = ?', [sku, req.shopId])
          : null;

        if (existing) {
          await dbRun(db,
            `UPDATE products SET name=?, barcode=?, price=?, cost=?, stock=?, category=?, min_stock=?, updated_at=NOW()
             WHERE id=?`,
            [name, barcode, price, cost, stock, category, min_stock, existing.id]
          );
          updated++;
        } else {
          await dbRun(db,
            'INSERT INTO products (id, tenant_id, name, sku, barcode, price, cost, stock, category, min_stock) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [uuidv4(), req.shopId, name, sku, barcode, price, cost, stock, category, min_stock]
          );
          created++;
        }
      } catch (rowErr) {
        errors.push(`Row ${i + 1}: ${rowErr.message}`);
      }
    }
    res.json({ created, updated, errors, total: created + updated });
  } catch (err) { next(err); }
});

// GET /api/v1/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const product = await dbGet(db,
      'SELECT * FROM products WHERE id = ? AND tenant_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
      [req.params.id, req.shopId]
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products
router.post('/', [...v.createProduct, validate], async (req, res, next) => {
  try {
    const { name, sku, barcode, price, cost, stock, category, min_stock } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const db = getDb();
    const id = uuidv4();
    await dbRun(db,
      `INSERT INTO products (id, tenant_id, name, sku, barcode, price, cost, stock, category, min_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.shopId, name, sku, barcode, price ?? 0, cost ?? 0, stock ?? 0, category, min_stock ?? 0]
    );

    res.status(201).json(await dbGet(db, 'SELECT * FROM products WHERE id = ?', [id]));
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/products/:id
router.put('/:id', [...v.updateProduct, validate], async (req, res, next) => {
  try {
    const db = getDb();
    const existing = await dbGet(db,
      'SELECT id FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { name, sku, barcode, price, cost, stock, category, min_stock } = req.body;
    await dbRun(db,
      `UPDATE products SET name=COALESCE(?,name), sku=COALESCE(?,sku), barcode=COALESCE(?,barcode),
       price=COALESCE(?,price), cost=COALESCE(?,cost), stock=COALESCE(?,stock),
       category=COALESCE(?,category), min_stock=COALESCE(?,min_stock), updated_at=NOW()
       WHERE id = ? AND tenant_id = ?`,
      [name, sku, barcode, price, cost, stock, category, min_stock ?? null, req.params.id, req.shopId]
    );

    res.json(await dbGet(db, 'SELECT * FROM products WHERE id = ?', [req.params.id]));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/products/:id  (soft-delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const info = await dbRun(db,
      "UPDATE products SET is_deleted = 1, updated_at = NOW() WHERE id = ? AND tenant_id = ?",
      [req.params.id, req.shopId]
    );
    if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// ── Variant routes ─────────────────────────────────────────────────────────────

// GET /api/v1/products/:id/variants
router.get('/:id/variants', async (req, res, next) => {
  try {
    const db = getDb();
    const product = await dbGet(db, 'SELECT id FROM products WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(await dbAll(db, 'SELECT * FROM product_variants WHERE product_id = ? AND tenant_id = ? ORDER BY name ASC', [req.params.id, req.shopId]));
  } catch (err) { next(err); }
});

// POST /api/v1/products/:id/variants
router.post('/:id/variants', async (req, res, next) => {
  try {
    const db = getDb();
    const product = await dbGet(db, 'SELECT id FROM products WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, sku, barcode, price, cost, stock, attributes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    await dbRun(db,
      `INSERT INTO product_variants (id, product_id, tenant_id, name, sku, barcode, price, cost, stock, attributes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, req.params.id, req.shopId, name, sku || null, barcode || null,
       price ?? 0, cost ?? 0, stock ?? 0, attributes ? JSON.stringify(attributes) : '{}']
    );
    await dbRun(db, 'UPDATE products SET has_variants=1, updated_at=NOW() WHERE id=?', [req.params.id]);
    res.status(201).json(await dbGet(db, 'SELECT * FROM product_variants WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

// PUT /api/v1/products/:id/variants/:variantId
router.put('/:id/variants/:variantId', async (req, res, next) => {
  try {
    const db = getDb();
    const variant = await dbGet(db, 'SELECT id FROM product_variants WHERE id = ? AND product_id = ? AND tenant_id = ?',
      [req.params.variantId, req.params.id, req.shopId]);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    const { name, sku, barcode, price, cost, stock } = req.body;
    await dbRun(db,
      `UPDATE product_variants SET name=COALESCE(?,name), sku=COALESCE(?,sku), barcode=COALESCE(?,barcode),
       price=COALESCE(?,price), cost=COALESCE(?,cost), stock=COALESCE(?,stock), updated_at=NOW()
       WHERE id=?`,
      [name || null, sku || null, barcode || null, price ?? null, cost ?? null, stock ?? null, req.params.variantId]
    );
    res.json(await dbGet(db, 'SELECT * FROM product_variants WHERE id = ?', [req.params.variantId]));
  } catch (err) { next(err); }
});

// DELETE /api/v1/products/:id/variants/:variantId
router.delete('/:id/variants/:variantId', async (req, res, next) => {
  try {
    const db = getDb();
    const info = await dbRun(db,
      'DELETE FROM product_variants WHERE id = ? AND product_id = ? AND tenant_id = ?',
      [req.params.variantId, req.params.id, req.shopId]
    );
    if (info.changes === 0) return res.status(404).json({ error: 'Variant not found' });

    const remaining = await dbGet(db, 'SELECT COUNT(*) as cnt FROM product_variants WHERE product_id = ?', [req.params.id]);
    if (!remaining?.cnt) {
      await dbRun(db, 'UPDATE products SET has_variants=0, updated_at=NOW() WHERE id=?', [req.params.id]);
    }
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
