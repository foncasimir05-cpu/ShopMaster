require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { initDb } = require('./config/database');

const newAuthRoutes = require('./auth/authRoutes');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const { settingsRouter, usersRouter } = require('./routes/settings');
const subShopsRoutes = require('./routes/subShops');
const { authenticateToken } = require('./middleware/authenticateToken');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
app.use('/api/v1/users', authenticateToken, usersRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
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
