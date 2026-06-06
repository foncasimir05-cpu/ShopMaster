const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');
const { signAccessToken, authenticateToken } = require('../middleware/authenticateToken');
const { sendMail } = require('../services/mailer');

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

// POST /api/auth/forgot
router.post('/forgot', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const db = getDb();
    const users = dbAll(db,
      `SELECT u.id, u.name, u.tenant_id AS shopId, t.name AS shopName
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE LOWER(u.email) = LOWER(?)`,
      [email.trim()]
    );

    if (users.length === 0) {
      // Don't reveal whether email exists — always return shops array (empty)
      return res.json({ sent: false, shops: [] });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    users.forEach(u => {
      dbRun(db, 'DELETE FROM password_reset_tokens WHERE user_id = ?', [u.id]);
      dbRun(db,
        'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
        [uuidv4(), u.id, otp, expiresAt]
      );
    });

    const shopRows = users.map(u =>
      `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;">${u.shopName}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${u.shopId}</td>
      </tr>`
    ).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;color:#111827;">
        <h2 style="color:#1a2e4a;margin-bottom:4px;">ShopMaster — Account Recovery</h2>
        <p>Hello <strong>${users[0].name}</strong>,</p>
        <p>Your shop(s) registered to <strong>${email}</strong>:</p>
        <table style="border-collapse:collapse;width:100%;margin:12px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 14px;text-align:left;font-size:13px;">Shop Name</th>
              <th style="padding:10px 14px;text-align:left;font-size:13px;">Shop ID</th>
            </tr>
          </thead>
          <tbody>${shopRows}</tbody>
        </table>
        <p style="margin-top:20px;">Your 6-digit reset code:</p>
        <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#1a2e4a;background:#f0f4ff;padding:16px 24px;border-radius:10px;display:inline-block;margin:8px 0;">${otp}</div>
        <p style="color:#6b7280;font-size:13px;margin-top:16px;">This code expires in <strong>15 minutes</strong>. If you did not request this, ignore this email.</p>
      </div>`;

    const sent = await sendMail({ to: email.trim(), subject: 'ShopMaster — Account Recovery', html });

    const shops = users.map(u => ({ shopId: u.shopId, shopName: u.shopName }));
    const isProd = process.env.NODE_ENV === 'production';

    if (!sent) {
      console.warn(`[Forgot] OTP for ${email}: ${otp}`);
    }

    // In production with email sent: return shops but not OTP
    // In dev/no-email: return OTP too so the app can show it for testing
    res.json({ sent, shops, ...(!isProd && { devOtp: otp }) });
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, shopId, otp, newPassword } = req.body;
    if (!email || !shopId || !otp || !newPassword) {
      return res.status(400).json({ error: 'email, shopId, otp and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();
    const user = dbGet(db,
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND tenant_id = ?',
      [email.trim(), shopId.trim()]
    );
    if (!user) return res.status(404).json({ error: 'No account found with this email and Shop ID.' });

    const record = dbGet(db,
      'SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND used = 0',
      [user.id, otp.trim()]
    );
    if (!record) return res.status(400).json({ error: 'Invalid reset code. Please check and try again.' });
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    dbRun(db, 'UPDATE users SET password = ? WHERE id = ?', [hash, user.id]);
    dbRun(db, 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [record.id]);

    res.json({ success: true });
  } catch (err) { next(err); }
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
