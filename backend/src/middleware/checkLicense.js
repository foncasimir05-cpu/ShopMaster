const { getDb } = require('../config/database');
const { dbGet } = require('../config/dbHelpers');

const TRIAL_DAYS = 30;

module.exports = async function checkLicense(req, res, next) {
  if (!req.user) return next();
  try {
    const db = getDb();
    const tenant = await dbGet(db, 'SELECT created_at, license_key FROM tenants WHERE id = ?', [req.user.shopId]);
    if (!tenant) return next();

    if (tenant.license_key) return next(); // licensed — always allowed

    const trialExpiresAt = new Date(new Date(tenant.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > trialExpiresAt) {
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
