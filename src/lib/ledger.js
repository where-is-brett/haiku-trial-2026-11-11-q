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
