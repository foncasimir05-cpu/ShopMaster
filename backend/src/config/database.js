const { Pool } = require('pg');

// Parse PG bigint (int8) columns as JS numbers instead of strings
require('pg').types.setTypeParser(20, (val) => parseInt(val, 10));

let pool = null;

function getDb() {
  if (!pool) throw new Error('Database not initialised. Call initDb() first.');
  return pool;
}

async function initDb() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  await createTables();
  console.log('PostgreSQL pool ready');
  return pool;
}

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id                      TEXT PRIMARY KEY,
        name                    TEXT NOT NULL,
        parent_tenant_id        TEXT,
        is_premium              INTEGER NOT NULL DEFAULT 0,
        subscription_plan       TEXT,
        subscription_expires_at TEXT,
        subscription_status     TEXT NOT NULL DEFAULT 'free',
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id                TEXT PRIMARY KEY,
        tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name              TEXT NOT NULL DEFAULT '',
        email             TEXT NOT NULL,
        password          TEXT NOT NULL,
        role              TEXT NOT NULL DEFAULT 'staff',
        is_active         INTEGER NOT NULL DEFAULT 1,
        security_question TEXT,
        security_answer   TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id           TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        sku          TEXT,
        barcode      TEXT,
        price        REAL NOT NULL DEFAULT 0,
        cost         REAL NOT NULL DEFAULT 0,
        stock        INTEGER NOT NULL DEFAULT 0,
        min_stock    INTEGER NOT NULL DEFAULT 0,
        category     TEXT,
        has_variants INTEGER NOT NULL DEFAULT 0,
        is_deleted   INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
        customer_id    TEXT,
        promo_id       TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id           TEXT PRIMARY KEY,
        sale_id      TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id   TEXT NOT NULL REFERENCES products(id),
        variant_id   TEXT,
        quantity     INTEGER NOT NULL,
        unit_price   REAL NOT NULL,
        cost_price   REAL NOT NULL DEFAULT 0,
        product_name TEXT,
        subtotal     REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id         TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        sale_id    TEXT REFERENCES sales(id),
        delta      INTEGER NOT NULL,
        type       TEXT NOT NULL DEFAULT 'sale',
        reason     TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS day_closures (
        id            TEXT PRIMARY KEY,
        tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        date          TEXT NOT NULL,
        total_sales   INTEGER NOT NULL DEFAULT 0,
        total_revenue REAL NOT NULL DEFAULT 0,
        cash_expected REAL NOT NULL DEFAULT 0,
        actual_cash   REAL NOT NULL DEFAULT 0,
        difference    REAL NOT NULL DEFAULT 0,
        notes         TEXT,
        closed_by     TEXT NOT NULL REFERENCES users(id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS shop_settings (
        tenant_id      TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        name           TEXT NOT NULL DEFAULT '',
        address        TEXT NOT NULL DEFAULT '',
        phone          TEXT NOT NULL DEFAULT '',
        email          TEXT NOT NULL DEFAULT '',
        tax_enabled    INTEGER NOT NULL DEFAULT 0,
        tax_rate       REAL NOT NULL DEFAULT 0,
        tax_label      TEXT NOT NULL DEFAULT 'VAT',
        currency       TEXT NOT NULL DEFAULT 'XAF',
        receipt_footer TEXT NOT NULL DEFAULT '',
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id         TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        contact    TEXT,
        phone      TEXT,
        email      TEXT,
        address    TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id          TEXT PRIMARY KEY,
        tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        supplier_id TEXT REFERENCES suppliers(id),
        status      TEXT NOT NULL DEFAULT 'pending',
        notes       TEXT,
        created_by  TEXT NOT NULL REFERENCES users(id),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id                TEXT PRIMARY KEY,
        purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id        TEXT NOT NULL REFERENCES products(id),
        qty_ordered       INTEGER NOT NULL DEFAULT 0,
        qty_received      INTEGER NOT NULL DEFAULT 0,
        unit_cost         REAL NOT NULL DEFAULT 0,
        subtotal          REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS promotions (
        id           TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        code         TEXT,
        type         TEXT NOT NULL DEFAULT 'percent',
        value        REAL NOT NULL DEFAULT 0,
        min_purchase REAL NOT NULL DEFAULT 0,
        is_active    INTEGER NOT NULL DEFAULT 1,
        expires_at   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id                 TEXT PRIMARY KEY,
        tenant_id          TEXT NOT NULL,
        campay_reference   TEXT,
        external_reference TEXT,
        amount             INTEGER NOT NULL,
        plan               TEXT NOT NULL,
        status             TEXT NOT NULL DEFAULT 'pending',
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customers (
        id             TEXT PRIMARY KEY,
        tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name           TEXT NOT NULL,
        phone          TEXT,
        email          TEXT,
        loyalty_points INTEGER NOT NULL DEFAULT 0,
        total_spent    REAL NOT NULL DEFAULT 0,
        visit_count    INTEGER NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS product_variants (
        id         TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        sku        TEXT,
        barcode    TEXT,
        price      REAL NOT NULL DEFAULT 0,
        cost       REAL NOT NULL DEFAULT 0,
        stock      INTEGER NOT NULL DEFAULT 0,
        attributes TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id          TEXT PRIMARY KEY,
        tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        amount      REAL NOT NULL,
        category    TEXT NOT NULL DEFAULT 'Other',
        description TEXT,
        date        TEXT NOT NULL,
        created_by  TEXT NOT NULL REFERENCES users(id),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sync_operations (
        client_id  TEXT NOT NULL,
        tenant_id  TEXT NOT NULL,
        type       TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'processed',
        error      TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (client_id, tenant_id)
      );
    `);
  } finally {
    client.release();
  }
}

module.exports = { initDb, getDb };
