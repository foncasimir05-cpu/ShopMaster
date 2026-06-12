const express = require('express');
const { getDb } = require('../config/database');
const { dbGet, dbAll } = require('../config/dbHelpers');

const router = express.Router();

function getCogsForPeriod(db, shopId, extraWhere, params) {
  const row = dbGet(db,
    `SELECT COALESCE(SUM(si.cost_price * si.quantity),0) as cogs
     FROM sale_items si JOIN sales s ON si.sale_id = s.id
     WHERE s.tenant_id=? ${extraWhere} AND s.status='completed'`,
    [shopId, ...params]
  );
  return row?.cogs ?? 0;
}

function getExpensesForPeriod(db, shopId, extraWhere, params) {
  const row = dbGet(db,
    `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE tenant_id=? ${extraWhere}`,
    [shopId, ...params]
  );
  return row?.total ?? 0;
}

// GET /api/v1/analytics/summary
router.get('/summary', (req, res, next) => {
  try {
    const db = getDb();
    const { shopId } = req;

    const today = new Date().toISOString().split('T')[0];
    const monthStr = today.substring(0, 7);
    const weekStart = getMondayStr();

    const todayRow = dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND date(created_at)=? AND status='completed'
    `, [shopId, today]);
    const todayCogs = getCogsForPeriod(db, shopId, 'AND date(s.created_at)=?', [today]);
    const todayExp = getExpensesForPeriod(db, shopId, 'AND date=?', [today]);
    todayRow.profit = Math.round((todayRow.revenue - todayCogs) * 100) / 100;
    todayRow.expenses = Math.round(todayExp * 100) / 100;
    todayRow.net_profit = Math.round((todayRow.profit - todayExp) * 100) / 100;

    const weekRow = dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND date(created_at)>=? AND status='completed'
    `, [shopId, weekStart]);
    const weekCogs = getCogsForPeriod(db, shopId, 'AND date(s.created_at)>=?', [weekStart]);
    const weekExp = getExpensesForPeriod(db, shopId, 'AND date>=?', [weekStart]);
    weekRow.profit = Math.round((weekRow.revenue - weekCogs) * 100) / 100;
    weekRow.expenses = Math.round(weekExp * 100) / 100;
    weekRow.net_profit = Math.round((weekRow.profit - weekExp) * 100) / 100;

    const monthRow = dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND strftime('%Y-%m',created_at)=? AND status='completed'
    `, [shopId, monthStr]);
    const monthCogs = getCogsForPeriod(db, shopId, "AND strftime('%Y-%m',s.created_at)=?", [monthStr]);
    const monthExp = getExpensesForPeriod(db, shopId, "AND strftime('%Y-%m',date)=?", [monthStr]);
    monthRow.profit = Math.round((monthRow.revenue - monthCogs) * 100) / 100;
    monthRow.expenses = Math.round(monthExp * 100) / 100;
    monthRow.net_profit = Math.round((monthRow.profit - monthExp) * 100) / 100;

    const allTimeRow = dbGet(db, `
      SELECT COUNT(*) as sales_count, COALESCE(SUM(total),0) as revenue
      FROM sales WHERE tenant_id=? AND status='completed'
    `, [shopId]);
    const allTimeCogs = getCogsForPeriod(db, shopId, '', []);
    const allTimeExp = getExpensesForPeriod(db, shopId, '', []);
    allTimeRow.profit = Math.round((allTimeRow.revenue - allTimeCogs) * 100) / 100;
    allTimeRow.expenses = Math.round(allTimeExp * 100) / 100;
    allTimeRow.net_profit = Math.round((allTimeRow.profit - allTimeExp) * 100) / 100;

    const avgRow = dbGet(db, `
      SELECT COALESCE(AVG(total),0) as avg_order
      FROM sales WHERE tenant_id=? AND status='completed'
        AND date(created_at) >= date('now','-30 days')
    `, [shopId]);

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
router.get('/trend', (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 90);
    const db = getDb();

    const revenueRows = dbAll(db, `
      SELECT date(created_at) as date,
             COUNT(*) as sales_count,
             COALESCE(SUM(total),0) as revenue
      FROM sales
      WHERE tenant_id=?
        AND date(created_at) >= date('now','-' || ? || ' days')
        AND status='completed'
      GROUP BY date(created_at)
      ORDER BY date ASC
    `, [req.shopId, days - 1]);

    const cogsRows = dbAll(db, `
      SELECT date(s.created_at) as date, COALESCE(SUM(si.cost_price * si.quantity),0) as cogs
      FROM sale_items si JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id=?
        AND date(s.created_at) >= date('now','-' || ? || ' days')
        AND s.status='completed'
      GROUP BY date(s.created_at)
    `, [req.shopId, days - 1]);

    const cogsMap = {};
    for (const r of cogsRows) cogsMap[r.date] = r.cogs;

    const expRows = dbAll(db, `
      SELECT date, COALESCE(SUM(amount),0) as expenses
      FROM expenses
      WHERE tenant_id=? AND date >= date('now','-' || ? || ' days')
      GROUP BY date
    `, [req.shopId, days - 1]);
    const expMap = {};
    for (const r of expRows) expMap[r.date] = r.expenses;

    res.json(fillDays(revenueRows, days, cogsMap, expMap));
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/top-products?days=30&limit=5
router.get('/top-products', (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const db = getDb();

    const rows = dbAll(db, `
      SELECT p.id, p.name, p.category,
             SUM(si.quantity) as units_sold,
             COALESCE(SUM(si.subtotal),0) as revenue,
             COALESCE(SUM(si.cost_price * si.quantity),0) as cogs
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id=?
        AND date(s.created_at) >= date('now','-' || ? || ' days')
        AND s.status='completed'
      GROUP BY si.product_id
      ORDER BY revenue DESC
      LIMIT ?
    `, [req.shopId, days, limit]);

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
router.get('/payment-breakdown', (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const db = getDb();

    const rows = dbAll(db, `
      SELECT payment_method,
             COUNT(*) as sales_count,
             COALESCE(SUM(total),0) as revenue
      FROM sales
      WHERE tenant_id=?
        AND date(created_at) >= date('now','-' || ? || ' days')
        AND status='completed'
      GROUP BY payment_method
      ORDER BY revenue DESC
    `, [req.shopId, days]);

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
