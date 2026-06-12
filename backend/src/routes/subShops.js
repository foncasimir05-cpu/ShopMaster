const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');
const { signAccessToken } = require('../middleware/authenticateToken');

const router = express.Router();

// GET /api/v1/sub-shops
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const subShops = await dbAll(db,
      `SELECT t.id, t.name, t.created_at,
              (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = 1) AS staff_count
       FROM tenants t WHERE t.parent_tenant_id = ?
       ORDER BY t.created_at ASC`,
      [req.shopId]
    );
    res.json({ subShops });
  } catch (err) { next(err); }
});

// POST /api/v1/sub-shops
router.post('/', async (req, res, next) => {
  try {
    const db = getDb();
    const tenant = await dbGet(db, 'SELECT is_premium FROM tenants WHERE id = ?', [req.shopId]);
    if (!tenant) {
      return res.status(404).json({ error: 'Shop not found. Please log out and log in again.' });
    }
    if (!tenant.is_premium) {
      return res.status(403).json({ error: 'Premium subscription required. Go to Settings → Activate Premium first.' });
    }
    const { branchName, adminName, adminEmail, adminPassword } = req.body;
    if (!branchName || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'branchName, adminName, adminEmail and adminPassword are required' });
    }
    if (adminPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const tenantId = uuidv4();
    const userId = uuidv4();
    const hash = await bcrypt.hash(adminPassword, 12);
    await dbTransaction(db, async (client) => {
      await dbRun(client,
        'INSERT INTO tenants (id, name, parent_tenant_id) VALUES (?, ?, ?)',
        [tenantId, branchName, req.shopId]
      );
      await dbRun(client,
        'INSERT INTO users (id, tenant_id, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, tenantId, adminName, adminEmail.trim().toLowerCase(), hash, 'admin']
      );
      await dbRun(client,
        'INSERT INTO shop_settings (tenant_id, name) VALUES (?, ?)',
        [tenantId, branchName]
      );
    });
    res.status(201).json({ id: tenantId, name: branchName });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    next(err);
  }
});

// POST /api/v1/sub-shops/:id/switch
router.post('/:id/switch', async (req, res, next) => {
  try {
    const db = getDb();
    const subShop = await dbGet(db,
      'SELECT id, name FROM tenants WHERE id = ? AND parent_tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!subShop) return res.status(404).json({ error: 'Branch not found or access denied' });
    const accessToken = signAccessToken({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: 'admin',
      shopId: subShop.id,
      shopName: subShop.name,
    });
    res.json({ accessToken, shopName: subShop.name, shopId: subShop.id });
  } catch (err) { next(err); }
});

module.exports = router;
