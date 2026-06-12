const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbTransaction } = require('../config/dbHelpers');
const { generateInvoicePdf } = require('../services/pdf');
const { sendReceiptEmail } = require('../services/mailer');
const { publish } = require('../services/eventBus');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// ── Report routes must be registered before /:id ──────────────────────────────

// GET /api/v1/sales/report/daily?date=YYYY-MM-DD
router.get('/report/daily', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
    const db = getDb();
    const byHour = await dbAll(db, `
      SELECT TO_CHAR(created_at, 'HH24') as hour,
             COUNT(*) as sales_count,
             SUM(total) as revenue,
             SUM(discount) as total_discount
      FROM sales
      WHERE tenant_id = ? AND TO_CHAR(created_at, 'YYYY-MM-DD') = ? AND status = 'completed'
      GROUP BY TO_CHAR(created_at, 'HH24') ORDER BY hour
    `, [req.shopId, date]);
    const summary = await dbGet(db, `
      SELECT COUNT(*) as total_sales, COALESCE(SUM(total),0) as total_revenue,
             COALESCE(SUM(discount),0) as total_discount
      FROM sales WHERE tenant_id = ? AND TO_CHAR(created_at, 'YYYY-MM-DD') = ? AND status = 'completed'
    `, [req.shopId, date]);
    res.json({ date, summary, byHour });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/report/weekly?week=YYYY-WW
router.get('/report/weekly', async (req, res, next) => {
  try {
    const { week } = req.query;
    if (!week) return res.status(400).json({ error: 'week param required (YYYY-WW)' });
    const db = getDb();
    const byDay = await dbAll(db, `
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date,
             COUNT(*) as sales_count,
             SUM(total) as revenue
      FROM sales
      WHERE tenant_id = ? AND TO_CHAR(created_at, 'IYYY-IW') = ? AND status = 'completed'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') ORDER BY date
    `, [req.shopId, week]);
    const summary = await dbGet(db, `
      SELECT COUNT(*) as total_sales, COALESCE(SUM(total),0) as total_revenue
      FROM sales WHERE tenant_id = ? AND TO_CHAR(created_at, 'IYYY-IW') = ? AND status = 'completed'
    `, [req.shopId, week]);
    res.json({ week, summary, byDay });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/report/monthly?month=YYYY-MM
router.get('/report/monthly', async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });
    const db = getDb();
    const byDay = await dbAll(db, `
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date,
             COUNT(*) as sales_count,
             SUM(total) as revenue
      FROM sales
      WHERE tenant_id = ? AND TO_CHAR(created_at, 'YYYY-MM') = ? AND status = 'completed'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') ORDER BY date
    `, [req.shopId, month]);
    const summary = await dbGet(db, `
      SELECT COUNT(*) as total_sales, COALESCE(SUM(total),0) as total_revenue
      FROM sales WHERE tenant_id = ? AND TO_CHAR(created_at, 'YYYY-MM') = ? AND status = 'completed'
    `, [req.shopId, month]);
    res.json({ month, summary, byDay });
  } catch (err) { next(err); }
});

// ── CRUD ───────────────────────────────────────────────────────────────────────

// GET /api/v1/sales
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);

    let where = 'WHERE s.tenant_id = ?';
    const params = [req.shopId];
    if (startDate) { where += ' AND TO_CHAR(s.created_at, \'YYYY-MM-DD\') >= ?'; params.push(startDate); }
    if (endDate)   { where += ' AND TO_CHAR(s.created_at, \'YYYY-MM-DD\') <= ?'; params.push(endDate); }

    const sales = await dbAll(db,
      `SELECT s.*, u.email as cashier_email FROM sales s
       JOIN users u ON s.user_id = u.id
       ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const countRow = await dbGet(db,
      `SELECT COUNT(*) as total_count FROM sales s ${where}`,
      params
    );

    res.json({ sales, total_count: countRow?.total_count ?? 0, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/:id
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const sale = await dbGet(db,
      'SELECT * FROM sales WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const items = await dbAll(db,
      `SELECT si.*, p.name as product_name, p.sku,
              ROUND((si.unit_price - si.cost_price) * si.quantity, 2) as item_profit
       FROM sale_items si
       JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
      [req.params.id]
    );
    const total_cogs = items.reduce((s, i) => s + (i.cost_price ?? 0) * i.quantity, 0);
    const total_profit = Math.round((sale.total - total_cogs) * 100) / 100;
    res.json({ ...sale, items, total_cogs: Math.round(total_cogs * 100) / 100, total_profit });
  } catch (err) { next(err); }
});

// POST /api/v1/sales
router.post('/', [...v.createSale, validate], async (req, res, next) => {
  const { items, discount = 0, taxRate = 0, paymentMethod = 'cash', customerId, promoCode } = req.body;
  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const db = getDb();
    const saleId = uuidv4();

    const result = await dbTransaction(db, async (client) => {
      if (customerId) {
        const cust = await dbGet(client, 'SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [customerId, req.shopId]);
        if (!cust) throw Object.assign(new Error('Customer not found'), { status: 404 });
      }

      let subtotal = 0;
      const resolved = [];
      for (const { productId, variantId, quantity, unitPrice } of items) {
        let price, costPrice, displayName, stockSource;

        if (variantId) {
          const variant = await dbGet(client,
            'SELECT * FROM product_variants WHERE id = ? AND product_id = ? AND tenant_id = ?',
            [variantId, productId, req.shopId]
          );
          if (!variant) throw Object.assign(new Error('Variant not found'), { status: 404 });
          if (variant.stock < quantity) throw Object.assign(new Error(`Insufficient stock for "${variant.name}"`), { status: 422 });
          price = unitPrice != null ? Number(unitPrice) : variant.price;
          costPrice = variant.cost ?? 0;
          displayName = variant.name;
          stockSource = { type: 'variant', id: variantId };
        } else {
          const product = await dbGet(client,
            'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
            [productId, req.shopId]
          );
          if (!product) throw Object.assign(new Error(`Product ${productId} not found`), { status: 404 });
          if (product.stock < quantity) throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 422 });
          price = unitPrice != null ? Number(unitPrice) : product.price;
          costPrice = product.cost ?? 0;
          displayName = product.name;
          stockSource = { type: 'product', id: productId };
        }

        const lineTotal = price * quantity;
        subtotal += lineTotal;
        resolved.push({ productId, variantId: variantId || null, quantity, price, costPrice, lineTotal, displayName, stockSource });
      }

      let promoId = null;
      let promoDiscount = 0;
      if (promoCode) {
        const promo = await dbGet(client,
          "SELECT * FROM promotions WHERE code = ? AND tenant_id = ? AND is_active = 1",
          [promoCode.toUpperCase().trim(), req.shopId]
        );
        if (promo && !(promo.expires_at && new Date(promo.expires_at) < new Date())) {
          if (promo.min_purchase <= 0 || subtotal >= promo.min_purchase) {
            if (promo.type === 'percent') promoDiscount = Math.round(subtotal * (promo.value / 100) * 100) / 100;
            else if (promo.type === 'flat') promoDiscount = Math.min(promo.value, subtotal);
            promoId = promo.id;
          }
        }
      }

      const discountAmount = Number(discount) + promoDiscount;
      const taxAmount = (subtotal - discountAmount) * Number(taxRate);
      const total = Math.max(0, subtotal - discountAmount + taxAmount);

      await dbRun(client,
        `INSERT INTO sales (id, tenant_id, user_id, total, discount, tax, payment_method, customer_id, promo_id)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [saleId, req.shopId, req.user.id, total, discountAmount, taxAmount, paymentMethod, customerId || null, promoId]
      );

      const insertedItems = [];
      for (const { productId, variantId, quantity, price, costPrice, lineTotal, displayName, stockSource } of resolved) {
        if (stockSource.type === 'variant') {
          await dbRun(client, 'UPDATE product_variants SET stock = stock - ?, updated_at = NOW() WHERE id = ?',
            [quantity, stockSource.id]);
        } else {
          await dbRun(client, 'UPDATE products SET stock = stock - ?, updated_at = NOW() WHERE id = ?',
            [quantity, productId]);
        }
        await dbRun(client,
          `INSERT INTO stock_movements (id, tenant_id, product_id, sale_id, delta, type) VALUES (?,?,?,?,?,?)`,
          [uuidv4(), req.shopId, productId, saleId, -quantity, 'sale']
        );
        const itemId = uuidv4();
        await dbRun(client,
          'INSERT INTO sale_items (id, sale_id, product_id, variant_id, quantity, unit_price, cost_price, subtotal) VALUES (?,?,?,?,?,?,?,?)',
          [itemId, saleId, productId, variantId, quantity, price, costPrice, lineTotal]
        );
        insertedItems.push({ id: itemId, product_id: productId, variant_id: variantId, product_name: displayName, quantity, unit_price: price, cost_price: costPrice, subtotal: lineTotal });
      }

      if (customerId) {
        const points = Math.floor(total / 100);
        await dbRun(client,
          `UPDATE customers SET loyalty_points = loyalty_points + ?, total_spent = total_spent + ?,
           visit_count = visit_count + 1, updated_at = NOW() WHERE id = ?`,
          [points, total, customerId]
        );
      }

      return { saleId, subtotal, discount: discountAmount, promoDiscount, tax: taxAmount, total, paymentMethod, items: insertedItems };
    });

    res.status(201).json(result);

    // After responding, check if any sold products dropped below their min_stock threshold
    // and push an SSE low_stock event to connected clients for this tenant.
    setImmediate(async () => {
      try {
        const db = getDb();
        const soldIds = result.items.map(i => i.product_id).filter(Boolean);
        for (const pid of soldIds) {
          const p = await dbGet(db,
            'SELECT id, name, stock, min_stock FROM products WHERE id = ? AND min_stock > 0 AND stock <= min_stock',
            [pid]
          );
          if (p) publish(req.shopId, 'low_stock', { productId: p.id, name: p.name, stock: p.stock, minStock: p.min_stock });
        }
      } catch {}
    });
  } catch (err) {
    console.error(`[${req.id}] Sale error:`, err.message);
    next(err);
  }
});

// DELETE /api/v1/sales/:id  — void sale + restore stock
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const sale = await dbGet(db,
      'SELECT * FROM sales WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status === 'voided') return res.status(409).json({ error: 'Sale already voided' });

    const saleItems = await dbAll(db, 'SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);

    await dbTransaction(db, async (client) => {
      for (const item of saleItems) {
        if (item.variant_id) {
          await dbRun(client,
            'UPDATE product_variants SET stock = stock + ?, updated_at = NOW() WHERE id = ?',
            [item.quantity, item.variant_id]
          );
        } else {
          await dbRun(client,
            'UPDATE products SET stock = stock + ?, updated_at = NOW() WHERE id = ?',
            [item.quantity, item.product_id]
          );
        }
        await dbRun(client,
          `INSERT INTO stock_movements (id, tenant_id, product_id, sale_id, delta, type)
           VALUES (?,?,?,?,?,?)`,
          [uuidv4(), req.shopId, item.product_id, req.params.id, item.quantity, 'void']
        );
      }
      await dbRun(client, "UPDATE sales SET status = 'voided' WHERE id = ?", [req.params.id]);
    });

    res.json({ message: 'Sale voided', saleId: req.params.id });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/:id/invoice
router.get('/:id/invoice', async (req, res, next) => {
  try {
    const db = getDb();
    const sale = await dbGet(db,
      'SELECT * FROM sales WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.shopId]
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const items = await dbAll(db,
      `SELECT si.*, p.name as product_name FROM sale_items si
       JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
      [req.params.id]
    );
    const tenant = await dbGet(db, 'SELECT * FROM tenants WHERE id = ?', [req.shopId]);
    const pdfBuffer = await generateInvoicePdf({ sale, items, tenant });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${sale.id.slice(0, 8)}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// POST /api/v1/sales/:id/send-receipt
router.post('/:id/send-receipt', [...v.sendReceipt, validate], async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const db = getDb();
    const sale = await dbGet(db, 'SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [req.params.id, req.shopId]);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const items = await dbAll(db,
      `SELECT si.*, p.name as product_name FROM sale_items si
       JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
      [req.params.id]
    );
    const shopSettings = await dbGet(db, 'SELECT * FROM shop_settings WHERE tenant_id = ?', [req.shopId]);
    await sendReceiptEmail({ to: email, shop: shopSettings, sale, items });
    res.json({ message: `Receipt sent to ${email}` });
  } catch (err) { next(err); }
});

module.exports = router;
