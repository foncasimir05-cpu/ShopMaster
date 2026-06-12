const express = require('express');
const { getDb } = require('../config/database');
const { dbGet, dbAll } = require('../config/dbHelpers');

const router = express.Router();

async function getCogsForPeriod(db, shopId, extraWhere, params) {
  const row = await dbGet(db,
    `SELECT COALESCE(SUM(si.cost_price * si.quantity),0) as cogs
     FROM sale_items si JOIN sales s ON si.sale_id = s.id
     WHERE s.tenant_id=? ${extraWhere} AND s.status='completed'`,
    [shopId, ...params]
  );
  return row?.cogs ?? 0;
}

async function getExpensesForPeriod(db, shopId, extraWhere, params) {
  const row = await dbGet(db,
    `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE tenant_id=? ${extraWhere}`,
    [shopId, ...params]
  );
  return row?.total ?? 0;
}

// GET /api/v1/analytics/summary
router.get('/summary', async (req, res, next) => {
  try {
    const db = getDb();
    const { shopId } = req;

    const today = new Date().toISOString().split('T')[0];
    const monthStr = today.substring(0, 7);
    const weekStart = getMondayStr();
    const thirtyDaysAgo = (() => {
      const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
    })();

    const todayRow = await dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND TO_CHAR(created_at, 'YYYY-MM-DD')=? AND status='completed'
    `, [shopId, today]);
    const todayCogs = await getCogsForPeriod(db, shopId, "AND TO_CHAR(s.created_at, 'YYYY-MM-DD')=?", [today]);
    const todayExp = await getExpensesForPeriod(db, shopId, 'AND date=?', [today]);
    todayRow.profit = Math.round((todayRow.revenue - todayCogs) * 100) / 100;
    todayRow.expenses = Math.round(todayExp * 100) / 100;
    todayRow.net_profit = Math.round((todayRow.profit - todayExp) * 100) / 100;

    const weekRow = await dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND TO_CHAR(created_at, 'YYYY-MM-DD')>=? AND status='completed'
    `, [shopId, weekStart]);
    const weekCogs = await getCogsForPeriod(db, shopId, "AND TO_CHAR(s.created_at, 'YYYY-MM-DD')>=?", [weekStart]);
    const weekExp = await getExpensesForPeriod(db, shopId, 'AND date>=?', [weekStart]);
    weekRow.profit = Math.round((weekRow.revenue - weekCogs) * 100) / 100;
    weekRow.expenses = Math.round(weekExp * 100) / 100;
    weekRow.net_profit = Math.round((weekRow.profit - weekExp) * 100) / 100;

    const monthRow = await dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND TO_CHAR(created_at, 'YYYY-MM')=? AND status='completed'
    `, [shopId, monthStr]);
    const monthCogs = await getCogsForPeriod(db, shopId, "AND TO_CHAR(s.created_at, 'YYYY-MM')=?", [monthStr]);
    const monthExp = await getExpensesForPeriod(db, shopId, 'AND SUBSTRING(date, 1, 7)=?', [monthStr]);
    monthRow.profit = Math.round((monthRow.revenue - monthCogs) * 100) / 100;
    monthRow.expenses = Math.round(monthExp * 100) / 100;
    monthRow.net_profit = Math.round((monthRow.profit - monthExp) * 100) / 100;

    const allTimeRow = await dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND status='completed'
    `, [shopId]);
    const allTimeCogs = await getCogsForPeriod(db, shopId, '', []);
    const allTimeExp = await getExpensesForPeriod(db, shopId, '', []);
    allTimeRow.profit = Math.round((allTimeRow.revenue - allTimeCogs) * 100) / 100;
    allTimeRow.expenses = Math.round(allTimeExp * 100) / 100;
    allTimeRow.net_profit = Math.round((allTimeRow.profit - allTimeExp) * 100) / 100;

    const avgRow = await dbGet(db, `
      SELECT COALESCE(AVG(total),0) as avg_order
      FROM sales WHERE tenant_id=? AND status='completed'
        AND TO_CHAR(created_at, 'YYYY-MM-DD') >= ?
    `, [shopId, thirtyDaysAgo]);

    res.set('Cache-Control', 'private, max-age=60');
    res.json({
      today: todayRow,
      week: weekRow,
      month: monthRow,
      allTime: allTimeRow,
      avgOrder30d: avgRow?.avg_order ?? 0,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/trend?days=7
router.get('/trend', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 90);
    const db = getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days - 1));
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const revenueRows = await dbAll(db, `
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date,
             COUNT(*) as sales_count,
             COALESCE(SUM(total),0) as revenue
      FROM sales
      WHERE tenant_id=?
        AND TO_CHAR(created_at, 'YYYY-MM-DD') >= ?
        AND status='completed'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY TO_CHAR(created_at, 'YYYY-MM-DD') ASC
    `, [req.shopId, cutoffStr]);

    const cogsRows = await dbAll(db, `
      SELECT TO_CHAR(s.created_at, 'YYYY-MM-DD') as date,
             COALESCE(SUM(si.cost_price * si.quantity),0) as cogs
      FROM sale_items si JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id=?
        AND TO_CHAR(s.created_at, 'YYYY-MM-DD') >= ?
        AND s.status='completed'
      GROUP BY TO_CHAR(s.created_at, 'YYYY-MM-DD')
    `, [req.shopId, cutoffStr]);

    const cogsMap = {};
    for (const r of cogsRows) cogsMap[r.date] = r.cogs;

    const expRows = await dbAll(db, `
      SELECT date, COALESCE(SUM(amount),0) as expenses
      FROM expenses
      WHERE tenant_id=? AND date >= ?
      GROUP BY date
    `, [req.shopId, cutoffStr]);
    const expMap = {};
    for (const r of expRows) expMap[r.date] = r.expenses;

    res.set('Cache-Control', 'private, max-age=120');
    res.json(fillDays(revenueRows, days, cogsMap, expMap));
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/top-products?days=30&limit=5
router.get('/top-products', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const db = getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const rows = await dbAll(db, `
      SELECT p.id, p.name, p.category,
             SUM(si.quantity) as units_sold,
             COALESCE(SUM(si.subtotal),0) as revenue,
             COALESCE(SUM(si.cost_price * si.quantity),0) as cogs
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id=?
        AND TO_CHAR(s.created_at, 'YYYY-MM-DD') >= ?
        AND s.status='completed'
      GROUP BY p.id, p.name, p.category
      ORDER BY revenue DESC
      LIMIT ?
    `, [req.shopId, cutoffStr, limit]);

    res.set('Cache-Control', 'private, max-age=300');
    res.json(rows.map(r => ({
      ...r,
      profit: Math.round((r.revenue - r.cogs) * 100) / 100,
      margin_pct: r.revenue > 0
        ? Math.round((1 - r.cogs / r.revenue) * 1000) / 10
        : 0,
    })));
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/payment-breakdown?days=30
router.get('/payment-breakdown', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const db = getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const rows = await dbAll(db, `
      SELECT payment_method,
             COUNT(*) as sales_count,
             COALESCE(SUM(total),0) as revenue
      FROM sales
      WHERE tenant_id=?
        AND TO_CHAR(created_at, 'YYYY-MM-DD') >= ?
        AND status='completed'
      GROUP BY payment_method
      ORDER BY revenue DESC
    `, [req.shopId, cutoffStr]);

    res.json(rows);
  } catch (err) { next(err); }
});

function getMondayStr() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

function fillDays(rows, days, cogsMap = {}, expMap = {}) {
  const map = {};
  for (const r of rows) map[r.date] = r;
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const rev = map[dateStr]?.revenue ?? 0;
    const cogs = cogsMap[dateStr] ?? 0;
    const exp = expMap[dateStr] ?? 0;
    const grossProfit = Math.round((rev - cogs) * 100) / 100;
    result.push({
      date: dateStr,
      sales_count: map[dateStr]?.sales_count ?? 0,
      revenue: rev,
      profit: grossProfit,
      expenses: Math.round(exp * 100) / 100,
      net_profit: Math.round((grossProfit - exp) * 100) / 100,
    });
  }
  return result;
}

module.exports = router;
