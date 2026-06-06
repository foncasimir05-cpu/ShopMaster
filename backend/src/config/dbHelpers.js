// Sanitise params: convert undefined → null so sql.js binds correctly
const san = p => p.map(v => (v === undefined ? null : v));

function dbGet(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(san(params));
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(san(params));
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(db, sql, params = []) {
  db.run(sql, san(params));
  if (!db._inTransaction) db._save();
  return { changes: db.getRowsModified() };
}

function dbTransaction(db, fn) {
  db.run('BEGIN');
  db._inTransaction = true;
  try {
    const result = fn();
    db.run('COMMIT');
    db._inTransaction = false;
    db._save();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    db._inTransaction = false;
    throw err;
  }
}

module.exports = { dbGet, dbAll, dbRun, dbTransaction };
