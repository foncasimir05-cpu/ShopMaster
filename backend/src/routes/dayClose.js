const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/day-close/summary?date=YYYY-MM-DD
router.get('/summary', (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const db = getDb();

    const summary = dbGet(db, `
      SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN total ELSE 0 END), 0) as other_revenue
      FROM sales
      WHERE tenant_id = ? AND date(created_at) = ? AND status = 'completed'
    `, [req.shopId, date]);

    const byMethod = dbAll(db, `
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM sales
      WHERE tenant_id = ? AND date(created_at) = ? AND status = 'completed'
      GROUP BY payment_method
    `, [req.shopId, date]);

    const existing = dbGet(db,
      'SELECT id, actual_cash, difference, notes, created_at FROM day_closures WHERE tenant_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1',
      [req.shopId, date]
    );

    const cogsRow = dbGet(db, `
      SELECT COALESCE(SUM(si.cost_price * si.quantity),0) as total_cogs
      FROM sale_items si JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id=? AND date(s.created_at)=? AND s.status='completed'
    `, [req.shopId, date]);
    const total_cogs = cogsRow?.total_cogs ?? 0;

    res.json({
      date,
      summary: {
        ...summary,
        total_cogs,
        total_profit: Math.round(((summary?.total_revenue ?? 0) - total_cogs) * 100) / 100,
      },
      byMethod,
      existingClosure: existing ?? null,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/day-close/history
router.get('/history', (req, res, next) => {
  try {
    const db = getDb();
    const rows = dbAll(db, `
      SELECT dc.*, u.name as closed_by_name
      FROM day_closures dc
      JOIN users u ON dc.closed_by = u.id
      WHERE dc.tenant_id = ?
      ORDER BY dc.date DESC LIMIT 30
    `, [req.shopId]);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/v1/day-close
router.post('/', requireRole('admin', 'owner'), (req, res, next) => {
  try {
    const { date, total_sales, total_revenue, cash_expected, actual_cash, notes } = req.body;
    if (!date || actual_cash == null) {
      return res.status(400).json({ error: 'date and actual_cash are required' });
    }

    const db = getDb();
    const id = uuidv4();
    const difference = Number(actual_cash) - Number(cash_expected ?? 0);

    dbRun(db,
      `INSERT INTO day_closures (id, tenant_id, date, total_sales, total_revenue, cash_expected, actual_cash, difference, notes, closed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.shopId, date, total_sales ?? 0, total_revenue ?? 0,
       cash_expected ?? 0, Number(actual_cash), difference, notes ?? null, req.user.id]
    );

    res.status(201).json(dbGet(db, 'SELECT * FROM day_closures WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

module.exports = router;
