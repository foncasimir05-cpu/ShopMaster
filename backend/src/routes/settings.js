const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticateToken } = require('../middleware/authenticateToken');

const settingsRouter = express.Router();
const usersRouter = express.Router();

settingsRouter.use(authenticateToken);
usersRouter.use(authenticateToken);

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// GET /api/v1/settings
settingsRouter.get('/', (req, res, next) => {
  try {
    const db = getDb();
    let row = db.prepare('SELECT * FROM shop_settings WHERE tenant_id = ?').get(req.shopId);
    if (!row) {
      const tenant = db.prepare('SELECT name FROM tenants WHERE id = ?').get(req.shopId);
      row = {
        tenant_id: req.shopId,
        name: tenant?.name ?? '',
        address: '',
        phone: '',
        email: '',
        tax_enabled: 0,
        tax_rate: 0,
        tax_label: 'VAT',
        currency: 'XAF',
        receipt_footer: '',
      };
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings
settingsRouter.put('/', requireRole('admin', 'owner', 'manager'), (req, res, next) => {
  try {
    const { name, address, phone, email, tax_enabled, tax_rate, tax_label, currency, receipt_footer } = req.body;
    const db = getDb();
    db.prepare(`
      INSERT INTO shop_settings
        (tenant_id, name, address, phone, email, tax_enabled, tax_rate, tax_label, currency, receipt_footer, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tenant_id) DO UPDATE SET
        name           = excluded.name,
        address        = excluded.address,
        phone          = excluded.phone,
        email          = excluded.email,
        tax_enabled    = excluded.tax_enabled,
        tax_rate       = excluded.tax_rate,
        tax_label      = excluded.tax_label,
        currency       = excluded.currency,
        receipt_footer = excluded.receipt_footer,
        updated_at     = excluded.updated_at
    `).run(
      req.shopId,
      name ?? '', address ?? '', phone ?? '', email ?? '',
      tax_enabled ? 1 : 0,
      parseFloat(tax_rate) || 0,
      tax_label ?? 'VAT',
      currency ?? 'XAF',
      receipt_footer ?? '',
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users
usersRouter.get('/', requireRole('admin', 'owner'), (req, res, next) => {
  try {
    const db = getDb();
    const users = db.prepare(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE tenant_id = ? ORDER BY created_at ASC'
    ).all(req.shopId);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users
usersRouter.post('/', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }
    if (!['admin', 'manager', 'cashier'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin, manager or cashier' });
    }
    const db = getDb();
    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    db.prepare(
      'INSERT INTO users (id, tenant_id, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.shopId, name.trim(), email.trim().toLowerCase(), hash, role);
    res.status(201).json({ id, name, email, role, is_active: 1 });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already in use for this shop' });
    }
    next(err);
  }
});

// PUT /api/v1/users/:id
usersRouter.put('/:id', requireRole('admin', 'owner'), (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.shopId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, role } = req.body;
    db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
      .run(name ?? user.name, role ?? user.role, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/:id/deactivate
usersRouter.put('/:id/deactivate', requireRole('admin', 'owner'), (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.shopId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { settingsRouter, usersRouter };
