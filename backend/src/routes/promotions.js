const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// GET /api/v1/promotions
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    res.json(await dbAll(db, 'SELECT * FROM promotions WHERE tenant_id = ? ORDER BY created_at DESC', [req.shopId]));
  } catch (err) { next(err); }
});

// POST /api/v1/promotions/validate  — must be before /:id
router.post('/validate', async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ valid: false, error: 'code is required' });
    const db = getDb();
    const promo = await dbGet(db,
      "SELECT * FROM promotions WHERE code = ? AND tenant_id = ? AND is_active = 1",
      [code.toUpperCase().trim(), req.shopId]
    );
    if (!promo) return res.json({ valid: false, error: 'Invalid or inactive promo code' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.json({ valid: false, error: 'Promo code has expired' });
    }
    const amount = Number(subtotal ?? 0);
    if (promo.min_purchase > 0 && amount < promo.min_purchase) {
      return res.json({ valid: false, error: `Minimum purchase of ${promo.min_purchase} XAF required` });
    }
    let discount = 0;
    if (promo.type === 'percent') {
      discount = Math.round(amount * (promo.value / 100) * 100) / 100;
    } else if (promo.type === 'flat') {
      discount = Math.min(promo.value, amount);
    }
    res.json({ valid: true, discount, promoName: promo.name, promoId: promo.id, type: promo.type, value: promo.value });
  } catch (err) { next(err); }
});

// POST /api/v1/promotions
router.post('/', [...v.createPromotion, validate], async (req, res, next) => {
  try {
    const { name, code, type, value, min_purchase, expires_at, is_active } = req.body;
    if (!name || !type || value == null) {
      return res.status(400).json({ error: 'name, type, and value are required' });
    }
    if (!['percent', 'flat'].includes(type)) {
      return res.status(400).json({ error: 'type must be "percent" or "flat"' });
    }
    const db = getDb();
    const normalizedCode = code ? code.toUpperCase().trim() : null;
    if (normalizedCode) {
      const exists = await dbGet(db, 'SELECT id FROM promotions WHERE code = ? AND tenant_id = ?', [normalizedCode, req.shopId]);
      if (exists) return res.status(409).json({ error: 'Promo code already exists' });
    }
    const id = uuidv4();
    await dbRun(db,
      'INSERT INTO promotions (id, tenant_id, name, code, type, value, min_purchase, expires_at, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, req.shopId, name, normalizedCode, type, Number(value), Number(min_purchase ?? 0), expires_at ?? null, is_active !== false ? 1 : 0]
    );
    res.status(201).json(await dbGet(db, 'SELECT * FROM promotions WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

// PUT /api/v1/promotions/:id
router.put('/:id', [...v.updatePromotion, validate], async (req, res, next) => {
  try {
    const { name, code, type, value, min_purchase, expires_at, is_active } = req.body;
    const db = getDb();
    const promo = await dbGet(db, 'SELECT id FROM promotions WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    const normalizedCode = code ? code.toUpperCase().trim() : null;
    await dbRun(db,
      'UPDATE promotions SET name=?, code=?, type=?, value=?, min_purchase=?, expires_at=?, is_active=? WHERE id=?',
      [name, normalizedCode, type, Number(value), Number(min_purchase ?? 0), expires_at ?? null, is_active ? 1 : 0, req.params.id]
    );
    res.json(await dbGet(db, 'SELECT * FROM promotions WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

// DELETE /api/v1/promotions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const promo = await dbGet(db, 'SELECT id FROM promotions WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    await dbRun(db, 'DELETE FROM promotions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Promotion deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
