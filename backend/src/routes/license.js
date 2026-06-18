const express = require('express');
const { getDb } = require('../config/database');
const { dbGet, dbRun, dbTransaction } = require('../config/dbHelpers');

const router = express.Router();
const TRIAL_DAYS = 30;

function licenseStatus(tenant) {
  const createdAt = new Date(tenant.created_at);
  const trialExpiresAt = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const trialExpired = now > trialExpiresAt;
  const trialDaysRemaining = Math.max(0, Math.ceil((trialExpiresAt - now) / (24 * 60 * 60 * 1000)));
  const isLicensed = !!tenant.license_key;
  return {
    isLicensed,
    trialExpired,
    trialDaysRemaining,
    trialExpiresAt: trialExpiresAt.toISOString(),
    licenseActivatedAt: tenant.license_activated_at ?? null,
    multiShopEnabled: isLicensed,
    licenseExpired: trialExpired && !isLicensed,
  };
}

// GET /api/v1/license/status
router.get('/status', async (req, res, next) => {
  try {
    const db = getDb();
    const tenant = await dbGet(db,
      'SELECT created_at, license_key, license_activated_at FROM tenants WHERE id = ?',
      [req.user.shopId]
    );
    if (!tenant) return res.status(404).json({ error: 'Shop not found' });
    res.json(licenseStatus(tenant));
  } catch (err) { next(err); }
});

// POST /api/v1/license/activate
router.post('/activate', async (req, res, next) => {
  try {
    const key = (req.body.key ?? '').trim().toUpperCase();
    if (!key) return res.status(400).json({ error: 'License key is required' });

    const db = getDb();
    const licKey = await dbGet(db, 'SELECT key, claimed_by FROM license_keys WHERE key = ?', [key]);
    if (!licKey) return res.status(400).json({ error: 'Invalid license key. Check the key and try again.' });
    if (licKey.claimed_by && licKey.claimed_by !== req.user.shopId) {
      return res.status(409).json({ error: 'This license key has already been used by another shop.' });
    }

    const now = new Date().toISOString();
    await dbTransaction(db, async (client) => {
      await dbRun(client, 'UPDATE license_keys SET claimed_by = ?, claimed_at = ? WHERE key = ?', [req.user.shopId, now, key]);
      await dbRun(client, 'UPDATE tenants SET license_key = ?, license_activated_at = ? WHERE id = ?', [key, now, req.user.shopId]);
    });

    const tenant = await dbGet(db, 'SELECT created_at, license_key, license_activated_at FROM tenants WHERE id = ?', [req.user.shopId]);
    res.json({ success: true, ...licenseStatus(tenant) });
  } catch (err) { next(err); }
});

module.exports = router;
