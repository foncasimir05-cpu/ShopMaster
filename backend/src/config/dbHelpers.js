// Convert ? placeholders to $1, $2, ... for PostgreSQL
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// undefined → null so pg doesn't reject unbound params
function san(params) {
  return params.map(v => (v === undefined ? null : v));
}

async function dbGet(db, sql, params = []) {
  const result = await db.query(toPositional(sql), san(params));
  return result.rows[0] ?? null;
}

async function dbAll(db, sql, params = []) {
  const result = await db.query(toPositional(sql), san(params));
  return result.rows;
}

async function dbRun(db, sql, params = []) {
  const result = await db.query(toPositional(sql), san(params));
  return { changes: result.rowCount };
}

// Both Pool and Client have .query(), so pass either for non-transactional calls.
// For transactional calls, pass the client yielded by the callback.
async function dbTransaction(pool, fn) {
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { dbGet, dbAll, dbRun, dbTransaction };
