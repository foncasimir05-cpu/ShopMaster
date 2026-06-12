const { body } = require('express-validator');

// ── Atoms ──────────────────────────────────────────────────────────────────────

const email = (field = 'email') =>
  body(field).trim().isEmail().withMessage('Valid email is required').normalizeEmail();

const password = (field = 'password', label = 'Password') =>
  body(field).isLength({ min: 8, max: 100 }).withMessage(`${label} must be 8–100 characters`);

const requiredStr = (field, label, max = 200) =>
  body(field).trim().notEmpty().withMessage(`${label} is required`)
    .isLength({ max }).withMessage(`${label} must be at most ${max} characters`);

const optionalStr = (field, max = 200) =>
  body(field).optional({ nullable: true }).isString()
    .isLength({ max }).withMessage(`${field} must be at most ${max} characters`).trim();

const optionalFloat = (field, min = 0) =>
  body(field).optional({ nullable: true })
    .isFloat({ min }).withMessage(`${field} must be a number >= ${min}`).toFloat();

const optionalInt = (field, min = 0) =>
  body(field).optional({ nullable: true })
    .isInt({ min }).withMessage(`${field} must be an integer >= ${min}`).toInt();

const isoDate = (field) =>
  body(field).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${field} must be YYYY-MM-DD`);

// ── Auth ───────────────────────────────────────────────────────────────────────

exports.registerShop = [
  requiredStr('shopName', 'Shop name', 100),
  requiredStr('ownerName', 'Owner name', 100),
  email(),
  password(),
  requiredStr('securityQuestion', 'Security question', 500),
  requiredStr('securityAnswer', 'Security answer', 200),
];

exports.login = [
  body('email').trim().notEmpty().withMessage('email is required'),
  body('password').notEmpty().withMessage('password is required'),
  body('shopId').trim().notEmpty().withMessage('shopId is required'),
];

exports.forgot = [
  email(),
];

exports.resetPassword = [
  email(),
  body('shopId').trim().notEmpty().withMessage('shopId is required'),
  body('otp').trim().notEmpty().withMessage('otp is required'),
  password('newPassword', 'New password'),
];

exports.securityQuestion = [
  email(),
  body('shopId').trim().notEmpty().withMessage('shopId is required'),
];

exports.verifySecurity = [
  email(),
  body('shopId').trim().notEmpty().withMessage('shopId is required'),
  body('answer').trim().notEmpty().withMessage('answer is required'),
];

// ── Products ───────────────────────────────────────────────────────────────────

exports.createProduct = [
  requiredStr('name', 'Product name', 200),
  optionalFloat('price'),
  optionalFloat('cost'),
  optionalInt('stock'),
  optionalInt('min_stock'),
  optionalStr('sku', 100),
  optionalStr('barcode', 100),
  optionalStr('category', 100),
];

exports.updateProduct = [
  optionalStr('name', 200),
  optionalFloat('price'),
  optionalFloat('cost'),
  optionalInt('stock'),
  optionalInt('min_stock'),
  optionalStr('sku', 100),
  optionalStr('barcode', 100),
  optionalStr('category', 100),
];

// ── Sales ──────────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ['cash', 'mobile_money', 'card', 'transfer', 'cheque', 'other'];

exports.createSale = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').notEmpty().withMessage('Each item requires a productId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item quantity must be >= 1').toInt(),
  body('items.*.unitPrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('unitPrice must be >= 0').toFloat(),
  optionalFloat('discount'),
  body('taxRate').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('taxRate must be >= 0').toFloat(),
  body('paymentMethod').optional()
    .isIn(PAYMENT_METHODS).withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`),
];

exports.sendReceipt = [
  email(),
];

// ── Customers ──────────────────────────────────────────────────────────────────

exports.createCustomer = [
  requiredStr('name', 'Customer name', 100),
  optionalStr('phone', 20),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Valid email required').normalizeEmail(),
];

exports.updateCustomer = [
  optionalStr('name', 100),
  optionalStr('phone', 20),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Valid email required').normalizeEmail(),
];

// ── Expenses ───────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = ['Rent', 'Salaries', 'Utilities', 'Supplies', 'Transport', 'Marketing', 'Equipment', 'Other'];

exports.createExpense = [
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be greater than 0').toFloat(),
  isoDate('date'),
  body('category').optional({ nullable: true })
    .isIn(EXPENSE_CATEGORIES).withMessage(`category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
  optionalStr('description', 500),
];

exports.updateExpense = [
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('amount must be greater than 0').toFloat(),
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  body('category').optional({ nullable: true })
    .isIn(EXPENSE_CATEGORIES).withMessage(`category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
  optionalStr('description', 500),
];

// ── Suppliers ──────────────────────────────────────────────────────────────────

exports.createSupplier = [
  requiredStr('name', 'Supplier name', 100),
  optionalStr('contact', 100),
  optionalStr('phone', 20),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  optionalStr('address', 500),
];

exports.updateSupplier = [
  requiredStr('name', 'Supplier name', 100),
  optionalStr('contact', 100),
  optionalStr('phone', 20),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  optionalStr('address', 500),
];

// ── Promotions ─────────────────────────────────────────────────────────────────

exports.createPromotion = [
  requiredStr('name', 'Promotion name', 100),
  body('type').isIn(['percent', 'flat']).withMessage('type must be "percent" or "flat"'),
  body('value').isFloat({ min: 0 }).withMessage('value must be >= 0').toFloat(),
  optionalFloat('min_purchase'),
  optionalStr('code', 50),
  body('expires_at').optional({ nullable: true }).isISO8601().withMessage('expires_at must be a valid ISO date'),
];

exports.updatePromotion = [
  optionalStr('name', 100),
  body('type').optional().isIn(['percent', 'flat']).withMessage('type must be "percent" or "flat"'),
  body('value').optional().isFloat({ min: 0 }).withMessage('value must be >= 0').toFloat(),
  optionalFloat('min_purchase'),
  optionalStr('code', 50),
  body('expires_at').optional({ nullable: true }).isISO8601().withMessage('expires_at must be a valid ISO date'),
];

// ── Purchase Orders ────────────────────────────────────────────────────────────

exports.createPurchaseOrder = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').notEmpty().withMessage('Each item requires a productId'),
  body('items.*.qtyOrdered').isInt({ min: 1 }).withMessage('Each item qtyOrdered must be >= 1').toInt(),
  body('items.*.unitCost').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('unitCost must be >= 0').toFloat(),
];

// ── Settings ───────────────────────────────────────────────────────────────────

const VALID_CURRENCIES = [
  'XAF', 'XOF', 'NGN', 'GHS', 'KES', 'TZS', 'UGX', 'ZAR',
  'EGP', 'MAD', 'USD', 'EUR', 'GBP', 'CAD', 'INR', 'BRL', 'JPY',
];

exports.updateSettings = [
  optionalStr('name', 100),
  optionalStr('address', 500),
  optionalStr('phone', 30),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('tax_rate must be 0–100').toFloat(),
  body('currency').optional()
    .isIn(VALID_CURRENCIES).withMessage(`currency must be one of: ${VALID_CURRENCIES.join(', ')}`),
  optionalStr('tax_label', 20),
  optionalStr('receipt_footer', 500),
];

// ── Users ──────────────────────────────────────────────────────────────────────

exports.createUser = [
  requiredStr('name', 'Name', 100),
  email(),
  password(),
  body('role').isIn(['admin', 'manager', 'cashier']).withMessage('role must be admin, manager or cashier'),
];
