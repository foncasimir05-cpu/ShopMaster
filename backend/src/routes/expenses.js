const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun } = require('../config/dbHelpers');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

const CATEGORIES = ['Rent', 'Salaries', 'Utilities', 'Supplies', 'Transport', 'Marketing', 'Equipment', 'Other'];

// GET /api/v1/expenses
router.get('/', (req, res, next) => {
  try {
    const { startDate, endDate, category, page = 1, limit = 50 } = req.query;
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE tenant_id = ?';
    const params = [req.shopId];
    if (startDate) { where += ' AND date >= ?'; params.push(startDate); }
    if (endDate)   { where += ' AND date <= ?'; params.push(endDate); }
    if (category)  { where += ' AND category = ?'; params.push(category); }
    const expenses = dbAll(db,
      `SELECT * FROM expenses ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const countRow = dbGet(db, `SELECT COUNT(*) as total FROM expenses ${where}`, params);
    res.json({ expenses, total: countRow?.total ?? 0 });
  } catch (err) { next(err); }
});

// GET /api/v1/expenses/summary?startDate=&endDate=
router.get('/summary', (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const db = getDb();
    let where = 'WHERE tenant_id = ?';
    const params = [req.shopId];
    if (startDate) { where += ' AND date >= ?'; params.push(startDate); }
    if (endDate)   { where += ' AND date <= ?'; params.push(endDate); }
    const total = dbGet(db, `SELECT COALESCE(SUM(amount),0) as total FROM expenses ${where}`, params);
    const byCategory = dbAll(db,
      `SELECT category, COALESCE(SUM(amount),0) as total FROM expenses ${where} GROUP BY category ORDER BY total DESC`,
      params
    );
    res.json({ total: total?.total ?? 0, byCategory });
  } catch (err) { next(err); }
});

// POST /api/v1/expenses
router.post('/', [...v.createExpense, validate], (req, res, next) => {
  try {
    const { amount, category, description, date } = req.body;
    if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: 'amount is required' });
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    const db = getDb();
    const id = uuidv4();
    dbRun(db,
      'INSERT INTO expenses (id, tenant_id, amount, category, description, date, created_by) VALUES (?,?,?,?,?,?,?)',
      [id, req.shopId, Number(amount), category || 'Other', description ?? null, date, req.user.id]
    );
    res.status(201).json(dbGet(db, 'SELECT * FROM expenses WHERE id = ?', [id]));
  } catch (err) { next(err); }
});

// PUT /api/v1/expenses/:id
router.put('/:id', [...v.updateExpense, validate], (req, res, next) => {
  try {
    const { amount, category, description, date } = req.body;
    const db = getDb();
    const exp = dbGet(db, 'SELECT id FROM expenses WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!exp) return res.status(404).json({ error: 'Expense not found' });
    dbRun(db,
      'UPDATE expenses SET amount=?, category=?, description=?, date=? WHERE id=?',
      [Number(amount), category || 'Other', description ?? null, date, req.params.id]
    );
    res.json(dbGet(db, 'SELECT * FROM expenses WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

// DELETE /api/v1/expenses/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const exp = dbGet(db, 'SELECT id FROM expenses WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!exp) return res.status(404).json({ error: 'Expense not found' });
    dbRun(db, 'DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
});

module.exports = { router, CATEGORIES };
