const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// GET /api/v1/suppliers
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const safeLimit = Math.min(Number(limit), 200);
    const offset = (Number(page) - 1) * safeLimit;
    const db = getDb();

    let where = 'WHERE tenant_id = ?';
    const params = [req.shopId];
    if (search) { where += ' AND name ILIKE ?'; params.push(`%${search}%`); }

    const countRow = await dbGet(db, `SELECT COUNT(*) as total FROM suppliers ${where}`, params);
    const rows = await dbAll(db,
      `SELECT * FROM suppliers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.set('X-Total-Count', String(countRow?.total ?? 0));
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/v1/suppliers
router.post('/', [...v.createSupplier, validate], async (req, res, next) => {
  try {
    const { name, contact, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const db = getDb();
    const id = uuidv4();
    await dbRun(db,
      'INSERT INTO suppliers (id, tenant_id, name, contact, phone, email, address) VALUES (?,?,?,?,?,?,?)',
      [id, req.shopId, name, contact ?? null, phone ?? null, email ?? null, address ?? null]
    );
    res.status(201).json(await dbGet(db, 'SELECT * FROM suppliers WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

// PUT /api/v1/suppliers/:id
router.put('/:id', [...v.updateSupplier, validate], async (req, res, next) => {
  try {
    const { name, contact, phone, email, address } = req.body;
    const db = getDb();
    const sup = await dbGet(db, 'SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!sup) return res.status(404).json({ error: 'Supplier not found' });
    await dbRun(db,
      'UPDATE suppliers SET name=?, contact=?, phone=?, email=?, address=?, updated_at=NOW() WHERE id=?',
      [name, contact ?? null, phone ?? null, email ?? null, address ?? null, req.params.id]
    );
    res.json(await dbGet(db, 'SELECT * FROM suppliers WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

// DELETE /api/v1/suppliers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const sup = await dbGet(db, 'SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!sup) return res.status(404).json({ error: 'Supplier not found' });
    await dbRun(db, 'DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Supplier deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
