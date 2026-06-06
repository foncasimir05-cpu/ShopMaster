const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');
const { signAccessToken, authenticateToken } = require('../middleware/authenticateToken');

const router = express.Router();

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateRefreshToken(db, userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  dbRun(db,
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    [uuidv4(), userId, token, expiresAt]
  );
  return token;
}

// POST /api/auth/register-shop
router.post('/register-shop', async (req, res, next) => {
  try {
    const { shopName, ownerName, email, password } = req.body;
    if (!shopName || !ownerName || !email || !password) {
      return res.status(400).json({ error: 'shopName, ownerName, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();
    const shopId = uuidv4();
    const userId = uuidv4();
    const hash = await bcrypt.hash(password, 12);

    dbTransaction(db, () => {
      dbRun(db, 'INSERT INTO tenants (id, name) VALUES (?, ?)', [shopId, shopName]);
      dbRun(db,
        'INSERT INTO users (id, tenant_id, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, shopId, ownerName, email, hash, 'admin']
      );
    });

    const user = { id: userId, name: ownerName, email, role: 'admin', shopId, shopName };
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken(db, userId);

    res.status(201).json({ accessToken, refreshToken, user });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered for this shop' });
    }
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, shopId } = req.body;
    if (!email || !password || !shopId) {
      return res.status(400).json({ error: 'email, password and shopId are required' });
    }

    const db = getDb();
    const row = dbGet(db,
      `SELECT u.*, t.name AS shopName
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = ? AND u.tenant_id = ?`,
      [email, shopId]
    );

    if (!row || !(await bcrypt.compare(password, row.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      shopId: row.tenant_id,
      shopName: row.shopName,
    };
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken(db, row.id);

    res.json({ accessToken, refreshToken, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

    const db = getDb();
    const stored = dbGet(db,
      `SELECT rt.*, u.id AS userId, u.name, u.email, u.role,
              u.tenant_id AS shopId, t.name AS shopName
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       JOIN tenants t ON u.tenant_id = t.id
       WHERE rt.token = ?`,
      [refreshToken]
    );

    if (!stored || new Date(stored.expires_at) < new Date()) {
      if (stored) dbRun(db, 'DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = {
      id: stored.userId,
      name: stored.name,
      email: stored.email,
      role: stored.role,
      shopId: stored.shopId,
      shopName: stored.shopName,
    };
    const accessToken = signAccessToken(user);

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res, next) => {
  try {
    const db = getDb();
    const user = dbGet(db,
      `SELECT u.id, u.name, u.email, u.role,
              u.tenant_id AS shopId, t.name AS shopName, u.created_at
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
