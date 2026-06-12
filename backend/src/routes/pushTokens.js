const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbRun } = require('../config/dbHelpers');

const router = express.Router();

// POST /api/v1/push-tokens — register a device push token for this user
router.post('/', async (req, res, next) => {
  try {
    const { token, platform = 'expo' } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }
    const db = getDb();
    await dbRun(db,
      `INSERT INTO push_tokens (id, tenant_id, user_id, token, platform)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, token) DO NOTHING`,
      [uuidv4(), req.shopId, req.user.id, token.trim(), platform]
    );
    res.json({ registered: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/push-tokens — unregister token on logout
router.delete('/', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });
    const db = getDb();
    await dbRun(db,
      'DELETE FROM push_tokens WHERE user_id = ? AND token = ?',
      [req.user.id, token]
    );
    res.json({ removed: true });
  } catch (err) { next(err); }
});

module.exports = router;
