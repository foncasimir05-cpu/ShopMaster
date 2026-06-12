const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbRun } = require('../config/dbHelpers');

const router = express.Router();

const PLANS = {
  monthly: { amount: 9000,   label: 'Monthly', months: 1  },
  annual:  { amount: 108000, label: 'Annual',  months: 12 },
};

const CAMPAY_BASE = (process.env.CAMPAY_BASE_URL || 'https://www.campay.net').replace(/\/$/, '');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

async function getCampayToken() {
  const res = await fetch(`${CAMPAY_BASE}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CAMPAY_APP_USERNAME,
      password: process.env.CAMPAY_APP_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Campay auth failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

// POST /api/v1/premium/initiate
router.post('/initiate', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const { plan, phone } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan. Use monthly or annual.' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 9) return res.status(400).json({ error: 'Enter a valid mobile money phone number.' });

    if (!process.env.CAMPAY_APP_USERNAME || !process.env.CAMPAY_APP_PASSWORD) {
      return res.status(503).json({ error: 'Payment gateway not configured. Contact support.' });
    }

    const db = getDb();
    const { amount, label } = PLANS[plan];
    const externalRef = uuidv4();

    const token = await getCampayToken();

    const collectRes = await fetch(`${CAMPAY_BASE}/api/collect/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XAF',
        from: cleanPhone,
        description: `ShopMaster ${label} Premium - ${req.shopId.slice(0, 8)}`,
        external_reference: externalRef,
      }),
    });

    if (!collectRes.ok) {
      const errBody = await collectRes.json().catch(() => ({}));
      console.error('Campay collect error:', errBody);
      return res.status(502).json({ error: 'Payment initiation failed. Check your phone number and try again.' });
    }

    const collectData = await collectRes.json();
    const campayRef = collectData.reference;

    await dbRun(db,
      `INSERT INTO payments (id, tenant_id, campay_reference, external_reference, amount, plan, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [uuidv4(), req.shopId, campayRef, externalRef, amount, plan]
    );

    res.json({ reference: campayRef, message: 'Check your phone and approve the payment request.' });
  } catch (err) {
    console.error('Premium initiate error:', err.message);
    next(err);
  }
});

// GET /api/v1/premium/status/:reference
router.get('/status/:reference', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const db = getDb();
    const payment = await dbGet(db,
      'SELECT * FROM payments WHERE campay_reference = ? AND tenant_id = ?',
      [req.params.reference, req.shopId]
    );
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    if (payment.status === 'successful') {
      const tenant = await dbGet(db, 'SELECT subscription_expires_at FROM tenants WHERE id = ?', [req.shopId]);
      return res.json({ status: 'successful', expiresAt: tenant?.subscription_expires_at });
    }
    if (payment.status === 'failed') return res.json({ status: 'failed' });

    const token = await getCampayToken();
    const checkRes = await fetch(`${CAMPAY_BASE}/api/transaction/${req.params.reference}/`, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!checkRes.ok) return res.status(502).json({ error: 'Could not check payment status.' });

    const checkData = await checkRes.json();
    const campayStatus = checkData.status;

    if (campayStatus === 'SUCCESSFUL') {
      const plan = PLANS[payment.plan];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + plan.months);
      const expiresAtStr = expiresAt.toISOString();

      await dbRun(db, `UPDATE payments SET status = 'successful' WHERE campay_reference = ?`, [req.params.reference]);
      await dbRun(db,
        `UPDATE tenants SET is_premium = 1, subscription_plan = ?, subscription_expires_at = ?, subscription_status = 'active' WHERE id = ?`,
        [payment.plan, expiresAtStr, req.shopId]
      );
      return res.json({ status: 'successful', expiresAt: expiresAtStr });
    }

    if (campayStatus === 'FAILED') {
      await dbRun(db, `UPDATE payments SET status = 'failed' WHERE campay_reference = ?`, [req.params.reference]);
      return res.json({ status: 'failed' });
    }

    res.json({ status: 'pending' });
  } catch (err) {
    console.error('Premium status error:', err.message);
    next(err);
  }
});

// POST /api/v1/premium/webhook  (Campay callback — no auth required)
router.post('/webhook', async (req, res) => {
  try {
    const { reference, status } = req.body;
    if (!reference) return res.status(400).json({ error: 'Missing reference' });

    const db = getDb();
    const payment = await dbGet(db, 'SELECT * FROM payments WHERE campay_reference = ?', [reference]);
    if (!payment || payment.status === 'successful') return res.json({ received: true });

    if (status === 'SUCCESSFUL') {
      const plan = PLANS[payment.plan];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + plan.months);

      await dbRun(db, `UPDATE payments SET status = 'successful' WHERE campay_reference = ?`, [reference]);
      await dbRun(db,
        `UPDATE tenants SET is_premium = 1, subscription_plan = ?, subscription_expires_at = ?, subscription_status = 'active' WHERE id = ?`,
        [payment.plan, expiresAt.toISOString(), payment.tenant_id]
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
