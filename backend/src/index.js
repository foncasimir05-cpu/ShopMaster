require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./config/database');

const authRoutes = require('./routes/auth');
const newAuthRoutes = require('./auth/authRoutes');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth routes (new canonical prefix)
app.use('/api/auth', newAuthRoutes);

// API routes (all under /api/v1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/sales', salesRoutes);
app.use('/api/v1/inventory', inventoryRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

initDb();

app.listen(PORT, () => {
  console.warn(`ShopMaster API running on http://localhost:${PORT}`);
});

module.exports = app;
