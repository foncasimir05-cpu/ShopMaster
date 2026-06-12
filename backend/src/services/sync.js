const express = require('express');
const { getDb } = require('../config/database');
const { dbAll } = require('../config/dbHelpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/v1/sync
router.post('/', async (req, res, next) => {
  try {
    const { lastSyncedAt } = req.body;
    const db = getDb();
    const since = lastSyncedAt ?? '1970-01-01T00:00:00.000Z';

    const products = await dbAll(
      db,
      'SELECT * FROM products WHERE tenant_id = ? AND updated_at > ?',
      [req.user.tenantId, since]
    );

    res.json({ syncedAt: new Date().toISOString(), products });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
