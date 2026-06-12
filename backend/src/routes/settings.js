const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const { authenticateToken } = require('../middleware/authenticateToken');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

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
settingsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    let row = await dbGet(db, 'SELECT * FROM shop_settings WHERE tenant_id = ?', [req.shopId]);
    if (!row) {
      const tenant = await dbGet(db, 'SELECT name FROM tenants WHERE id = ?', [req.shopId]);
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
settingsRouter.put('/', requireRole('admin', 'owner', 'manager'), [...v.updateSettings, validate], async (req, res, next) => {
  try {
    const { name, address, phone, email, tax_enabled, tax_rate, tax_label, currency, receipt_footer } = req.body;
    const db = getDb();
    await dbRun(db, `
      INSERT INTO shop_settings
        (tenant_id, name, address, phone, email, tax_enabled, tax_rate, tax_label, currency, receipt_footer, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        name           = EXCLUDED.name,
        address        = EXCLUDED.address,
        phone          = EXCLUDED.phone,
        email          = EXCLUDED.email,
        tax_enabled    = EXCLUDED.tax_enabled,
        tax_rate       = EXCLUDED.tax_rate,
        tax_label      = EXCLUDED.tax_label,
        currency       = EXCLUDED.currency,
        receipt_footer = EXCLUDED.receipt_footer,
        updated_at     = EXCLUDED.updated_at
    `, [
      req.shopId,
      name ?? '', address ?? '', phone ?? '', email ?? '',
      tax_enabled ? 1 : 0,
      parseFloat(tax_rate) || 0,
      tax_label ?? 'VAT',
      currency ?? 'XAF',
      receipt_footer ?? '',
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/settings/premium-status
settingsRouter.get('/premium-status', async (req, res, next) => {
  try {
    const db = getDb();
    const tenant = await dbGet(db,
      'SELECT is_premium, parent_tenant_id, subscription_plan, subscription_expires_at, subscription_status FROM tenants WHERE id = ?',
      [req.shopId]
    );
    const isPremium = Boolean(tenant?.is_premium);
    const expired = isPremium && tenant?.subscription_expires_at
      ? new Date(tenant.subscription_expires_at) < new Date()
      : false;
    res.json({
      isPremium: isPremium && !expired,
      isSubShop: Boolean(tenant?.parent_tenant_id),
      subscriptionPlan: tenant?.subscription_plan ?? null,
      subscriptionExpiresAt: tenant?.subscription_expires_at ?? null,
      subscriptionStatus: expired ? 'expired' : (tenant?.subscription_status ?? 'free'),
    });
  } catch (err) { next(err); }
});

// POST /api/v1/settings/upgrade
settingsRouter.post('/upgrade', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const db = getDb();
    const tenant = await dbGet(db, 'SELECT id FROM tenants WHERE id = ?', [req.shopId]);
    if (!tenant) return res.status(404).json({ error: 'Shop not found. Please log out and log in again.' });
    await dbRun(db, 'UPDATE tenants SET is_premium = 1 WHERE id = ?', [req.shopId]);
    res.json({ isPremium: true });
  } catch (err) { next(err); }
});

// GET /api/v1/users
usersRouter.get('/', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const db = getDb();
    res.json(await dbAll(db,
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE tenant_id = ? ORDER BY created_at ASC',
      [req.shopId]
    ));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users
usersRouter.post('/', requireRole('admin', 'owner'), [...v.createUser, validate], async (req, res, next) => {
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
    await dbRun(db,
      'INSERT INTO users (id, tenant_id, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.shopId, name.trim(), email.trim().toLowerCase(), hash, role]
    );
    res.status(201).json({ id, name, email, role, is_active: 1 });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use for this shop' });
    }
    next(err);
  }
});

// PUT /api/v1/users/:id
usersRouter.put('/:id', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const db = getDb();
    const user = await dbGet(db,
      'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, role } = req.body;
    await dbRun(db,
      'UPDATE users SET name = ?, role = ? WHERE id = ?',
      [name ?? user.name, role ?? user.role, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/:id/deactivate
usersRouter.put('/:id/deactivate', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    const db = getDb();
    const user = await dbGet(db,
      'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    await dbRun(db, 'UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { settingsRouter, usersRouter };
