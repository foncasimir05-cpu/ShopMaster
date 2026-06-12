const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// GET /api/v1/customers
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const safeLimit = Math.min(Number(limit), 200);
    const offset = (Number(page) - 1) * safeLimit;
    const db = getDb();

    let where = 'WHERE tenant_id = ?';
    const params = [req.shopId];

    if (search) {
      where += ' AND (name ILIKE ? OR phone ILIKE ? OR email ILIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const countRow = await dbGet(db, `SELECT COUNT(*) as total FROM customers ${where}`, params);
    const rows = await dbAll(db,
      `SELECT * FROM customers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.set('X-Total-Count', String(countRow?.total ?? 0));
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/v1/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const customer = await dbGet(db,
      'SELECT * FROM customers WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const recentSales = await dbAll(db, `
      SELECT id, total, payment_method, created_at, status
      FROM sales
      WHERE customer_id = ? AND tenant_id = ? AND status = 'completed'
      ORDER BY created_at DESC LIMIT 10
    `, [req.params.id, req.shopId]);

    res.json({ ...customer, recentSales });
  } catch (err) { next(err); }
});

// POST /api/v1/customers
router.post('/', [...v.createCustomer, validate], async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const db = getDb();
    const id = uuidv4();
    await dbRun(db,
      'INSERT INTO customers (id, tenant_id, name, phone, email) VALUES (?,?,?,?,?)',
      [id, req.shopId, name, phone || null, email || null]
    );
    res.status(201).json(await dbGet(db, 'SELECT * FROM customers WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

// PUT /api/v1/customers/:id
router.put('/:id', [...v.updateCustomer, validate], async (req, res, next) => {
  try {
    const db = getDb();
    const existing = await dbGet(db,
      'SELECT id FROM customers WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const { name, phone, email } = req.body;
    await dbRun(db,
      `UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone), email=COALESCE(?,email),
       updated_at=NOW() WHERE id = ? AND tenant_id = ?`,
      [name || null, phone || null, email || null, req.params.id, req.shopId]
    );
    res.json(await dbGet(db, 'SELECT * FROM customers WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

module.exports = router;
