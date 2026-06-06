const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');
const { generateInvoicePdf } = require('../services/pdf');

const router = express.Router();

// ── Report routes must be registered before /:id ──────────────────────────────

// GET /api/v1/sales/report/daily?date=YYYY-MM-DD
router.get('/report/daily', (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
    const db = getDb();
    const byHour = dbAll(db, `
      SELECT strftime('%H', created_at) as hour,
             COUNT(*) as sales_count,
             SUM(total) as revenue,
             SUM(discount) as total_discount
      FROM sales
      WHERE tenant_id = ? AND date(created_at) = ? AND status = 'completed'
      GROUP BY hour ORDER BY hour
    `, [req.shopId, date]);
    const summary = dbGet(db, `
      SELECT COUNT(*) as total_sales, COALESCE(SUM(total),0) as total_revenue,
             COALESCE(SUM(discount),0) as total_discount
      FROM sales WHERE tenant_id = ? AND date(created_at) = ? AND status = 'completed'
    `, [req.shopId, date]);
    res.json({ date, summary, byHour });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/report/weekly?week=YYYY-WW
router.get('/report/weekly', (req, res, next) => {
  try {
    const { week } = req.query;
    if (!week) return res.status(400).json({ error: 'week param required (YYYY-WW)' });
    const db = getDb();
    const byDay = dbAll(db, `
      SELECT strftime('%Y-%m-%d', created_at) as date,
             COUNT(*) as sales_count,
             SUM(total) as revenue
      FROM sales
      WHERE tenant_id = ? AND strftime('%Y-%W', created_at) = ? AND status = 'completed'
      GROUP BY date ORDER BY date
    `, [req.shopId, week]);
    const summary = dbGet(db, `
      SELECT COUNT(*) as total_sales, COALESCE(SUM(total),0) as total_revenue
      FROM sales WHERE tenant_id = ? AND strftime('%Y-%W', created_at) = ? AND status = 'completed'
    `, [req.shopId, week]);
    res.json({ week, summary, byDay });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/report/monthly?month=YYYY-MM
router.get('/report/monthly', (req, res, next) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });
    const db = getDb();
    const byDay = dbAll(db, `
      SELECT strftime('%Y-%m-%d', created_at) as date,
             COUNT(*) as sales_count,
             SUM(total) as revenue
      FROM sales
      WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = ? AND status = 'completed'
      GROUP BY date ORDER BY date
    `, [req.shopId, month]);
    const summary = dbGet(db, `
      SELECT COUNT(*) as total_sales, COALESCE(SUM(total),0) as total_revenue
      FROM sales WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = ? AND status = 'completed'
    `, [req.shopId, month]);
    res.json({ month, summary, byDay });
  } catch (err) { next(err); }
});

// ── CRUD ───────────────────────────────────────────────────────────────────────

// GET /api/v1/sales
router.get('/', (req, res, next) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);

    let where = 'WHERE s.tenant_id = ?';
    const params = [req.shopId];
    if (startDate) { where += ' AND date(s.created_at) >= ?'; params.push(startDate); }
    if (endDate)   { where += ' AND date(s.created_at) <= ?'; params.push(endDate); }

    const sales = dbAll(db,
      `SELECT s.*, u.email as cashier_email FROM sales s
       JOIN users u ON s.user_id = u.id
       ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const countRow = dbGet(db,
      `SELECT COUNT(*) as total_count FROM sales s ${where}`,
      params
    );

    res.json({ sales, total_count: countRow?.total_count ?? 0, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/:id
router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const sale = dbGet(db,
      'SELECT * FROM sales WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const items = dbAll(db,
      `SELECT si.*, p.name as product_name, p.sku FROM sale_items si
       JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
      [req.params.id]
    );
    res.json({ ...sale, items });
  } catch (err) { next(err); }
});

// POST /api/v1/sales
router.post('/', (req, res, next) => {
  const { items, discount = 0, taxRate = 0, paymentMethod = 'cash' } = req.body;
  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const db = getDb();
    const saleId = uuidv4();

    const result = dbTransaction(db, () => {
      // Validate all items and compute totals before any writes
      let subtotal = 0;
      const resolved = items.map(({ productId, quantity, unitPrice }) => {
        const product = dbGet(db,
          'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
          [productId, req.shopId]
        );
        if (!product) throw Object.assign(new Error(`Product ${productId} not found`), { status: 404 });
        if (product.stock < quantity) {
          throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 422 });
        }
        const price = unitPrice != null ? Number(unitPrice) : product.price;
        const lineTotal = price * quantity;
        subtotal += lineTotal;
        return { product, productId, quantity, price, lineTotal };
      });

      const discountAmount = Number(discount);
      const taxAmount = (subtotal - discountAmount) * Number(taxRate);
      const total = subtotal - discountAmount + taxAmount;

      // Insert parent sales row first (sale_items + stock_movements FK-reference it)
      dbRun(db,
        `INSERT INTO sales (id, tenant_id, user_id, total, discount, tax, payment_method)
         VALUES (?,?,?,?,?,?,?)`,
        [saleId, req.shopId, req.user.id, total, discountAmount, taxAmount, paymentMethod]
      );

      const insertedItems = resolved.map(({ product, productId, quantity, price, lineTotal }) => {
        dbRun(db,
          "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?",
          [quantity, productId]
        );
        dbRun(db,
          `INSERT INTO stock_movements (id, tenant_id, product_id, sale_id, delta, type)
           VALUES (?,?,?,?,?,?)`,
          [uuidv4(), req.shopId, productId, saleId, -quantity, 'sale']
        );
        const itemId = uuidv4();
        dbRun(db,
          'INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)',
          [itemId, saleId, productId, quantity, price, lineTotal]
        );
        return {
          id: itemId, product_id: productId, product_name: product.name,
          quantity, unit_price: price, subtotal: lineTotal,
        };
      });

      return { saleId, subtotal, discount: discountAmount, tax: taxAmount, total, paymentMethod, items: insertedItems };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Sale insert error:', err.message);
    console.error('Sale data:', { shopId: req.shopId, cashierId: req.user?.id, items });
    next(err);
  }
});

// DELETE /api/v1/sales/:id  — void sale + restore stock
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const sale = dbGet(db,
      'SELECT * FROM sales WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status === 'voided') return res.status(409).json({ error: 'Sale already voided' });

    const saleItems = dbAll(db, 'SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);

    dbTransaction(db, () => {
      for (const item of saleItems) {
        dbRun(db,
          "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?",
          [item.quantity, item.product_id]
        );
        dbRun(db,
          `INSERT INTO stock_movements (id, tenant_id, product_id, sale_id, delta, type)
           VALUES (?,?,?,?,?,?)`,
          [uuidv4(), req.shopId, item.product_id, req.params.id, item.quantity, 'void']
        );
      }
      dbRun(db, "UPDATE sales SET status = 'voided' WHERE id = ?", [req.params.id]);
    });

    res.json({ message: 'Sale voided', saleId: req.params.id });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/:id/invoice
router.get('/:id/invoice', async (req, res, next) => {
  try {
    const db = getDb();
    const sale = dbGet(db,
      'SELECT * FROM sales WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const items = dbAll(db,
      `SELECT si.*, p.name as product_name FROM sale_items si
       JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
      [req.params.id]
    );
    const tenant = dbGet(db, 'SELECT * FROM tenants WHERE id = ?', [req.shopId]);
    const pdfBuffer = await generateInvoicePdf({ sale, items, tenant });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${sale.id.slice(0, 8)}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

module.exports = router;
