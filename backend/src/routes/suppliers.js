const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// GET /api/v1/suppliers
router.get('/', (req, res, next) => {
  try {
    const { search } = req.query;
    const db = getDb();
    let query = 'SELECT * FROM suppliers WHERE tenant_id = ?';
    const params = [req.shopId];
    if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }
    query += ' ORDER BY name ASC';
    res.json(dbAll(db, query, params));
  } catch (err) { next(err); }
});

// POST /api/v1/suppliers
router.post('/', [...v.createSupplier, validate], (req, res, next) => {
  try {
    const { name, contact, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const db = getDb();
    const id = uuidv4();
    dbRun(db,
      'INSERT INTO suppliers (id, tenant_id, name, contact, phone, email, address) VALUES (?,?,?,?,?,?,?)',
      [id, req.shopId, name, contact ?? null, phone ?? null, email ?? null, address ?? null]
    );
    res.status(201).json(dbGet(db, 'SELECT * FROM suppliers WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

// PUT /api/v1/suppliers/:id
router.put('/:id', [...v.updateSupplier, validate], (req, res, next) => {
  try {
    const { name, contact, phone, email, address } = req.body;
    const db = getDb();
    const sup = dbGet(db, 'SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!sup) return res.status(404).json({ error: 'Supplier not found' });
    dbRun(db,
      "UPDATE suppliers SET name=?, contact=?, phone=?, email=?, address=?, updated_at=datetime('now') WHERE id=?",
      [name, contact ?? null, phone ?? null, email ?? null, address ?? null, req.params.id]
    );
    res.json(dbGet(db, 'SELECT * FROM suppliers WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

// DELETE /api/v1/suppliers/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const sup = dbGet(db, 'SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!sup) return res.status(404).json({ error: 'Supplier not found' });
    dbRun(db, 'DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Supplier deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
