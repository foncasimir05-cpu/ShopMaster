const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/shopmaster.db';

let db;

function getDb() {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      email       TEXT NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'staff',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, email)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      sku         TEXT,
      barcode     TEXT,
      price       REAL NOT NULL DEFAULT 0,
      cost        REAL NOT NULL DEFAULT 0,
      stock       INTEGER NOT NULL DEFAULT 0,
      category    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id),
      total       REAL NOT NULL,
      discount    REAL NOT NULL DEFAULT 0,
      tax         REAL NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'completed',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id          TEXT PRIMARY KEY,
      sale_id     TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id  TEXT NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL,
      unit_price  REAL NOT NULL,
      subtotal    REAL NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id  TEXT NOT NULL REFERENCES products(id),
      sale_id     TEXT REFERENCES sales(id),
      delta       INTEGER NOT NULL,
      type        TEXT NOT NULL DEFAULT 'sale',
      reason      TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_settings (
      tenant_id       TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      name            TEXT NOT NULL DEFAULT '',
      address         TEXT NOT NULL DEFAULT '',
      phone           TEXT NOT NULL DEFAULT '',
      email           TEXT NOT NULL DEFAULT '',
      tax_enabled     INTEGER NOT NULL DEFAULT 0,
      tax_rate        REAL NOT NULL DEFAULT 0,
      tax_label       TEXT NOT NULL DEFAULT 'VAT',
      currency        TEXT NOT NULL DEFAULT 'XAF',
      receipt_footer  TEXT NOT NULL DEFAULT '',
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Idempotent migrations
  try { db.exec("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'"); } catch {}

  console.warn('Database initialised at', DB_PATH);
}

module.exports = { initDb, getDb };
