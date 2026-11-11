// src/lib/ledger.js
import { DatabaseSync } from 'node:sqlite';

// Opens the ledger file (or ':memory:') and makes sure its transactions table exists.
export function openLedger(path) {
  const db = new DatabaseSync(path);
  db.exec(
    'CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)',
  );
  return db;
}

// Lists the YYYY-MM months that have transactions, newest first. Stored dates are YYYY-MM-DD.
export function monthsOf(db) {
  return db
    .prepare('SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC')
    .all()
    .map((row) => row.month);
}
