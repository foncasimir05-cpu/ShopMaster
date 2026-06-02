/**
 * Sync service — placeholder for bidirectional sync between the Express backend
 * and Expo clients. When a client reconnects after offline use it should POST
 * its local delta (new/updated records) here; the server merges and returns the
 * server delta since the client's last-sync timestamp.
 *
 * Current implementation: stub that accepts deltas and echoes the server state.
 * Replace with a proper CRDT or last-write-wins strategy as requirements grow.
 */

const express = require('express');
const { getDb } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/v1/sync
router.post('/', (req, res, next) => {
  try {
    const { lastSyncedAt } = req.body; // ISO string
    const db = getDb();
    const since = lastSyncedAt ?? '1970-01-01T00:00:00.000Z';

    const products = db
      .prepare('SELECT * FROM products WHERE tenant_id = ? AND updated_at > ?')
      .all(req.user.tenantId, since);

    res.json({
      syncedAt: new Date().toISOString(),
      products,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
