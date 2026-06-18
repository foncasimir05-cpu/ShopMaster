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

      CREATE TABLE IF NOT EXISTS push_tokens (
        id         TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL,
        platform   TEXT NOT NULL DEFAULT 'expo',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, token)
      );

      CREATE TABLE IF NOT EXISTS license_keys (
        key        TEXT PRIMARY KEY,
        type       TEXT NOT NULL DEFAULT 'pro',
        claimed_by TEXT REFERENCES tenants(id) ON DELETE SET NULL,
        claimed_at TIMESTAMPTZ
      );
    `);

    // Add columns to tenants (idempotent — IF NOT EXISTS is safe on re-deploy)
    await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_key TEXT`);
    await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_activated_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_type TEXT`);

    // Add type column to license_keys if missing (existing deployments won't have it)
    await client.query(`ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'pro'`);

    // Seed keys — ON CONFLICT DO UPDATE ensures type is always correct even on re-run
    const PRO_KEYS = [
      // Old SMPR- keys (kept for backwards compat) — treated as Pro
      'SMPR-2971A074-A879448F-65643E87', 'SMPR-60DFD81A-893C0C37-4BA58BE7',
      'SMPR-C7CB1126-8122B2AD-2CABEF0E', 'SMPR-51273678-94722202-1CFA7C97',
      'SMPR-C11B61D4-D92D7CDB-90602F43', 'SMPR-CAAA305B-7EBE3745-C649E381',
      'SMPR-3D8B859D-4485F4C9-74872A43', 'SMPR-F8201E61-F6463C4C-5EC410C8',
      'SMPR-ECEE152A-4FAC34EF-7BAD0AF5', 'SMPR-993FD48C-FBA092B3-3D91DE2C',
      'SMPR-CEC454F3-CDC6F3A3-18E43408', 'SMPR-92719D15-5EB3203F-CBF30B51',
      'SMPR-9C2C42C0-5AE8080D-D2DD76B5', 'SMPR-A8DF71B1-02784C6D-E4124E74',
      'SMPR-6920C216-0CF377E7-AF676C13', 'SMPR-F86AEA74-323F4867-1F6B0A61',
      'SMPR-8866D330-0D51B512-E5012AB9', 'SMPR-5D9E23DF-0AA55256-E46CB1DC',
      'SMPR-C52B253A-B22992D9-B22A24B5', 'SMPR-BD39D251-EEE48461-55A5A427',
      // New SMPRO- keys
      'SMPRO-8612D01D-BE9A95D4-D3169A7F', 'SMPRO-13C2B218-CA42F42F-C3981B62',
      'SMPRO-E4E6CEBD-817D38E9-1C7CA9C0', 'SMPRO-63B7007B-53736C89-CCE3DA9B',
      'SMPRO-7D0CBC10-B216E441-2A24CDE8', 'SMPRO-54C85C88-13FBDCC4-3A492AFB',
      'SMPRO-74D46571-6F5210C5-9ACD2833', 'SMPRO-35623632-D3B4EC98-9B0A285B',
      'SMPRO-DD01BAB3-3D5F2A96-EFB264BB', 'SMPRO-1A4DAF58-D69AF778-D570DE56',
      'SMPRO-AD3B5B87-6F97693F-83064BBB', 'SMPRO-0EE1AA46-138752C3-B76B234F',
      'SMPRO-844521CB-B0B6BCB3-92ED7245', 'SMPRO-192D4D42-8DB161B2-18DC8808',
      'SMPRO-9C20B250-A1FBCA9F-2EC67CFC', 'SMPRO-3B7810EE-7FCD5846-67E273EC',
      'SMPRO-5441EC76-5A8B698B-B8AC8AD2', 'SMPRO-C204939F-31858862-7BA4069D',
      'SMPRO-54B9152C-05AAD86C-5D9C81C1', 'SMPRO-9BE4E073-B5C26B2F-A1DF9296',
    ];
    const BASIC_KEYS = [
      'SMBSC-9ECE333F-4148FF41-753CB596', 'SMBSC-6828D786-26691A99-B2D34721',
      'SMBSC-737932EA-B3BF77FC-2C80AD96', 'SMBSC-4FBCF55F-45DD6710-2B6BDBB6',
      'SMBSC-4030DBA8-2DE6A38E-BBF891CE', 'SMBSC-261A89FB-F7856CAF-A729EAAA',
      'SMBSC-D52405E3-DC5C3E42-2F6A3951', 'SMBSC-8E567D99-26BEE36B-5E95705F',
      'SMBSC-046B9ADB-0788B47C-216706F8', 'SMBSC-8884B475-E80935B7-CE3EC8FD',
      'SMBSC-B8A67653-9984F21C-3AAD47AD', 'SMBSC-272167E0-DB44CEC3-3D9EA361',
      'SMBSC-7A167BA6-73695777-A7A0263E', 'SMBSC-C15D7DEC-1927A30B-2A1D0DF5',
      'SMBSC-FF32776D-C7512547-AADD1936', 'SMBSC-063048B8-D77F534B-131F8E36',
      'SMBSC-6D633555-BA6D34EC-9365A220', 'SMBSC-074FF7A9-3334671C-05420E68',
      'SMBSC-02EE6E41-E026BF08-D4232074', 'SMBSC-25151AC5-93268799-98BF8A3C',
    ];
    for (const key of PRO_KEYS) {
      await client.query(
        `INSERT INTO license_keys (key, type) VALUES ($1, 'pro')
         ON CONFLICT (key) DO UPDATE SET type = 'pro'`,
        [key]
      );
    }
    for (const key of BASIC_KEYS) {
      await client.query(
        `INSERT INTO license_keys (key, type) VALUES ($1, 'basic')
         ON CONFLICT (key) DO UPDATE SET type = 'basic'`,
        [key]
      );
    }
  } finally {
    client.release();
  }
}

module.exports = { initDb, getDb };
