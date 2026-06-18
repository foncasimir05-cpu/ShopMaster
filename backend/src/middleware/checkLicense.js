const { getDb } = require('../config/database');
const { dbGet } = require('../config/dbHelpers');

const TRIAL_DAYS = 30;

module.exports = async function checkLicense(req, res, next) {
  if (!req.user) return next();
  try {
    const db = getDb();
    const tenant = await dbGet(db,
      'SELECT created_at, license_key, license_expires_at FROM tenants WHERE id = ?',
      [req.user.shopId]
    );
    if (!tenant) return next();

    const now = new Date();

    // Valid license that hasn't expired → always allowed
    if (tenant.license_key) {
      const licExpired = tenant.license_expires_at && now > new Date(tenant.license_expires_at);
      if (!licExpired) return next();
      // License itself has expired (past 12 months)
      return res.status(402).json({
        error: 'Your license has expired. Please renew with a new license key to continue.',
        code: 'LICENSE_EXPIRED',
      });
    }

    // No license — check if still within 30-day trial
    const trialExpiresAt = new Date(new Date(tenant.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    if (now > trialExpiresAt) {
      return res.status(402).json({
        error: 'Your 30-day free trial has ended. Enter a license key to continue using ShopMaster.',
        code: 'LICENSE_EXPIRED',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};
