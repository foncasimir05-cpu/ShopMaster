const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbRun, dbTransaction } = require('../config/dbHelpers');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { shopName, email, password } = req.body;
    if (!shopName || !email || !password) {
      return res.status(400).json({ error: 'shopName, email and password are required' });
    }

    const db = getDb();
    const tenantId = uuidv4();
    const userId = uuidv4();
    const hash = await bcrypt.hash(password, 10);

    await dbTransaction(db, async (client) => {
      await dbRun(client, 'INSERT INTO tenants (id, name) VALUES (?, ?)', [tenantId, shopName]);
      await dbRun(client,
        'INSERT INTO users (id, tenant_id, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [userId, tenantId, email, hash, 'admin']
      );
    });

    const token = signToken({ userId, tenantId, role: 'admin' });
    res.status(201).json({ token, tenantId, userId });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered for this shop' });
    }
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, tenantId } = req.body;
    if (!email || !password || !tenantId) {
      return res.status(400).json({ error: 'email, password and tenantId are required' });
    }

    const db = getDb();
    const user = await dbGet(db, 'SELECT * FROM users WHERE email = ? AND tenant_id = ?', [email, tenantId]);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, tenantId, role: user.role });
    res.json({ token, userId: user.id, role: user.role });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const user = await dbGet(db, 'SELECT id, email, role, tenant_id, created_at FROM users WHERE id = ?', [req.user.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
