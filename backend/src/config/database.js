const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/shopmaster.db';
let db = null;

function getDb() {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db._inTransaction = false;
  db._save = () => {
    const data = db.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  };

  createTables();
  console.warn('Database initialised at', DB_PATH);
  return db;
}

function createTables() {
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
      is_active   INTEGER NOT NULL DEFAULT 1,
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
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id        TEXT NOT NULL REFERENCES users(id),
      total          REAL NOT NULL,
      discount       REAL NOT NULL DEFAULT 0,
      tax            REAL NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'completed',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id          TEXT PRIMARY KEY,
      sale_id     TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id  TEXT NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL,
      unit_price  REAL NOT NULL,
      subtotal    REAL NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS day_closures (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      date         TEXT NOT NULL,
      total_sales  INTEGER NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0,
      cash_expected REAL NOT NULL DEFAULT 0,
      actual_cash  REAL NOT NULL DEFAULT 0,
      difference   REAL NOT NULL DEFAULT 0,
      notes        TEXT,
      closed_by    TEXT NOT NULL REFERENCES users(id),
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0
    );

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

  // Idempotent migrations for existing databases
  try { db.run("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.run("ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'"); } catch {}
  try { db.run("ALTER TABLE tenants ADD COLUMN parent_tenant_id TEXT"); } catch {}
  try { db.run("ALTER TABLE tenants ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN security_question TEXT"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN security_answer TEXT"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0"); } catch {}
}

module.exports = { initDb, getDb };
