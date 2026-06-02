const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { generateInvoicePdf } = require('../services/pdf');

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/sales
router.get('/', (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const sales = db
      .prepare(
        `SELECT s.*, u.email as cashier_email FROM sales s
         JOIN users u ON s.user_id = u.id
         WHERE s.tenant_id = ? ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
      )
      .all(req.user.tenantId, Number(limit), offset);
    res.json(sales);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sales/:id  (includes items)
router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const sale = db
      .prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?')
      .get(req.params.id, req.user.tenantId);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const items = db
      .prepare(
        `SELECT si.*, p.name as product_name, p.sku FROM sale_items si
         JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = ?`
      )
      .all(req.params.id);

    res.json({ ...sale, items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sales  — create a new sale (cart checkout)
router.post('/', (req, res, next) => {
  try {
    const { items, discount = 0, tax = 0 } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const db = getDb();
    const saleId = uuidv4();

    const createSale = db.transaction(() => {
      let subtotal = 0;

      const insertedItems = items.map(({ productId, quantity }) => {
        const product = db
          .prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?')
          .get(productId, req.user.tenantId);
        if (!product) throw Object.assign(new Error(`Product ${productId} not found`), { status: 404 });
        if (product.stock < quantity) {
          throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 422 });
        }

        const lineTotal = product.price * quantity;
        subtotal += lineTotal;

        db.prepare(
          'UPDATE products SET stock = stock - ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).run(quantity, productId);

        const itemId = uuidv4();
        db.prepare(
          'INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)'
        ).run(itemId, saleId, productId, quantity, product.price, lineTotal);

        return { id: itemId, product_id: productId, product_name: product.name, quantity, unit_price: product.price, subtotal: lineTotal };
      });

      const total = subtotal - Number(discount) + Number(tax);
      db.prepare(
        'INSERT INTO sales (id, tenant_id, user_id, total, discount, tax) VALUES (?,?,?,?,?,?)'
      ).run(saleId, req.user.tenantId, req.user.userId, total, discount, tax);

      return { saleId, total, discount, tax, items: insertedItems };
    });

    const result = createSale();
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sales/:id/invoice  — download PDF invoice
router.get('/:id/invoice', async (req, res, next) => {
  try {
    const db = getDb();
    const sale = db
      .prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?')
      .get(req.params.id, req.user.tenantId);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const items = db
      .prepare(
        `SELECT si.*, p.name as product_name FROM sale_items si
         JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`
      )
      .all(req.params.id);

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.user.tenantId);
    const pdfBuffer = await generateInvoicePdf({ sale, items, tenant });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${sale.id.slice(0, 8)}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
