const express = require('express');
const { getDb } = require('../config/database');
const { dbGet, dbRun, dbTransaction } = require('../config/dbHelpers');

const router = express.Router();
const TRIAL_DAYS = 30;
const LICENSE_MONTHS = 12;

function buildStatus(tenant) {
  const now = new Date();

  // Trial window
  const createdAt = new Date(tenant.created_at);
  const trialExpiresAt = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const trialExpired = now > trialExpiresAt;
  const trialDaysRemaining = Math.max(0, Math.ceil((trialExpiresAt - now) / (24 * 60 * 60 * 1000)));

  // License validity
  const hasKey = !!tenant.license_key;
  const licenseExpiredByTime = hasKey && tenant.license_expires_at && now > new Date(tenant.license_expires_at);
  const isLicensed = hasKey && !licenseExpiredByTime;
  const licenseType = tenant.license_type ?? null; // 'basic' | 'pro'

  // Overall gate: blocked when trial is over AND no valid license
  const licenseExpired = (trialExpired && !isLicensed) || licenseExpiredByTime;

  return {
    isLicensed,
    licenseType,
    trialExpired,
    trialDaysRemaining,
    trialExpiresAt: trialExpiresAt.toISOString(),
    licenseActivatedAt: tenant.license_activated_at ?? null,
    licenseExpiresAt: tenant.license_expires_at ?? null,
    multiShopEnabled: isLicensed && licenseType === 'pro',
    licenseExpired,
  };
}

// GET /api/v1/license/status
router.get('/status', async (req, res, next) => {
  try {
    const db = getDb();
    const tenant = await dbGet(db,
      'SELECT created_at, license_key, license_type, license_activated_at, license_expires_at FROM tenants WHERE id = ?',
      [req.user.shopId]
    );
    if (!tenant) return res.status(404).json({ error: 'Shop not found' });
    res.json(buildStatus(tenant));
  } catch (err) { next(err); }
});

// POST /api/v1/license/activate
router.post('/activate', async (req, res, next) => {
  try {
    const key = (req.body.key ?? '').trim().toUpperCase();
    if (!key) return res.status(400).json({ error: 'License key is required' });

    const db = getDb();
    const licKey = await dbGet(db, 'SELECT key, type, claimed_by FROM license_keys WHERE key = ?', [key]);
    if (!licKey) return res.status(400).json({ error: 'Invalid license key. Check the key and try again.' });
    if (licKey.claimed_by && licKey.claimed_by !== req.user.shopId) {
      return res.status(409).json({ error: 'This license key has already been used by another shop.' });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + LICENSE_MONTHS);

    await dbTransaction(db, async (client) => {
      await dbRun(client,
        'UPDATE license_keys SET claimed_by = ?, claimed_at = ? WHERE key = ?',
        [req.user.shopId, now.toISOString(), key]
      );
      await dbRun(client,
        'UPDATE tenants SET license_key = ?, license_type = ?, license_activated_at = ?, license_expires_at = ? WHERE id = ?',
        [key, licKey.type, now.toISOString(), expiresAt.toISOString(), req.user.shopId]
      );
    });

    const tenant = await dbGet(db,
      'SELECT created_at, license_key, license_type, license_activated_at, license_expires_at FROM tenants WHERE id = ?',
      [req.user.shopId]
    );
    res.json({ success: true, ...buildStatus(tenant) });
  } catch (err) { next(err); }
});

module.exports = router;
