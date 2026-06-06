const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');
const { signAccessToken } = require('../middleware/authenticateToken');

const router = express.Router();

// GET /api/v1/sub-shops — list branches of current shop
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const subShops = dbAll(db,
      `SELECT t.id, t.name, t.created_at,
              (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = 1) AS staff_count
       FROM tenants t WHERE t.parent_tenant_id = ?
       ORDER BY t.created_at ASC`,
      [req.shopId]
    );
    res.json({ subShops });
  } catch (err) { next(err); }
});

// POST /api/v1/sub-shops — create a branch (premium only)
router.post('/', async (req, res, next) => {
  try {
    const db = getDb();
    const tenant = dbGet(db, 'SELECT is_premium FROM tenants WHERE id = ?', [req.shopId]);
    if (!tenant?.is_premium) {
      return res.status(403).json({ error: 'Premium subscription required to create branches' });
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
    dbTransaction(db, () => {
      dbRun(db,
        'INSERT INTO tenants (id, name, parent_tenant_id) VALUES (?, ?, ?)',
        [tenantId, branchName, req.shopId]
      );
      dbRun(db,
        'INSERT INTO users (id, tenant_id, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, tenantId, adminName, adminEmail.trim().toLowerCase(), hash, 'admin']
      );
      dbRun(db,
        'INSERT INTO shop_settings (tenant_id, name) VALUES (?, ?)',
        [tenantId, branchName]
      );
    });
    res.status(201).json({ id: tenantId, name: branchName });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    next(err);
  }
});

// POST /api/v1/sub-shops/:id/switch — get access token for a branch
router.post('/:id/switch', (req, res, next) => {
  try {
    const db = getDb();
    const subShop = dbGet(db,
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
