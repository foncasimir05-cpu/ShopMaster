require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initDb, getDb } = require('./config/database');
const requestId = require('./middleware/requestId');

const newAuthRoutes = require('./auth/authRoutes');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const { settingsRouter, usersRouter } = require('./routes/settings');
const subShopsRoutes = require('./routes/subShops');
const dayCloseRoutes = require('./routes/dayClose');
const premiumRoutes = require('./routes/premium');
const analyticsRoutes = require('./routes/analytics');
const customersRoutes = require('./routes/customers');
const suppliersRoutes = require('./routes/suppliers');
const purchaseOrdersRoutes = require('./routes/purchaseOrders');
const promotionsRoutes = require('./routes/promotions');
const { router: expensesRoutes } = require('./routes/expenses');
const eventsRoutes = require('./routes/events');
const syncRoutes = require('./services/sync');
const pushTokensRoutes = require('./routes/pushTokens');
const { authenticateToken } = require('./middleware/authenticateToken');

const app = express();
const PORT = process.env.PORT || 3001;

// Correlation ID — must be first so all middleware + logs can read req.id
app.use(requestId);

// Gzip all responses — biggest mobile bandwidth win
app.use(compression());

// Request logging — 'combined' in prod (Railway captures stdout), 'dev' locally
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Security headers
app.use(helmet());

// CORS — restrict to allowed origins in production via ALLOWED_ORIGINS env var (comma-separated)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : '*';
app.use(cors({ origin: allowedOrigins }));

// Body size limit — prevents OOM from oversized payloads
app.use(express.json({ limit: '1mb' }));

// Rate limiting — tighter on auth, generous on everything else
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth',   rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth routes — mounted at both prefixes so web (/api/v1) and direct fetch (/api) both work
app.use('/api/auth', newAuthRoutes);
app.use('/api/v1/auth', newAuthRoutes);
app.use('/api/v1/products', authenticateToken, productRoutes);
app.use('/api/v1/sales', authenticateToken, salesRoutes);
app.use('/api/v1/inventory', authenticateToken, inventoryRoutes);
app.use('/api/v1/settings', authenticateToken, settingsRouter);
app.use('/api/v1/sub-shops', authenticateToken, subShopsRoutes);
app.use('/api/v1/day-close', authenticateToken, dayCloseRoutes);
app.use('/api/v1/premium/webhook', premiumRoutes); // webhook has no auth
app.use('/api/v1/premium', authenticateToken, premiumRoutes);
app.use('/api/v1/users', authenticateToken, usersRouter);
app.use('/api/v1/analytics', authenticateToken, analyticsRoutes);
app.use('/api/v1/customers', authenticateToken, customersRoutes);
app.use('/api/v1/suppliers', authenticateToken, suppliersRoutes);
app.use('/api/v1/purchase-orders', authenticateToken, purchaseOrdersRoutes);
app.use('/api/v1/promotions', authenticateToken, promotionsRoutes);
app.use('/api/v1/expenses', authenticateToken, expensesRoutes);
app.use('/api/v1/events', authenticateToken, eventsRoutes);
app.use('/api/v1/sync', authenticateToken, syncRoutes);
app.use('/api/v1/push-tokens', authenticateToken, pushTokensRoutes);

// Global error handler — structured response with correlation ID
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const codeMap = { 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'UNPROCESSABLE', 429: 'RATE_LIMITED' };
  const code = err.code || codeMap[status] || 'INTERNAL_ERROR';
  if (status >= 500) console.error(`[${req.id}]`, err.stack);
  // `error` stays a string for backward-compat; `code` and `requestId` are new fields
  res.status(status).json({
    error: err.message || 'Internal server error',
    code,
    requestId: req.id,
  });
});

// Graceful shutdown — close pg pool cleanly when Railway sends SIGTERM
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, draining pg pool...');
  try { await getDb().end(); } catch {}
  process.exit(0);
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.warn(`ShopMaster API running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});

module.exports = app;
