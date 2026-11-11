// src/lib/month.js
import { CATEGORIES, categoryOf } from './categories.js';

const MONTH_SHAPE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Returns the text as a YYYY-MM month, or null when it is not one.
export function parseMonth(text) {
  return typeof text === 'string' && MONTH_SHAPE.test(text) ? text : null;
}

// Moves a YYYY-MM month by delta months, across year boundaries.
export function shiftMonth(ym, delta) {
  const [year, month] = ym.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  const shiftedYear = Math.floor(index / 12);
  const shiftedMonth = (index % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, '0')}`;
}

// Totals in whole cents for one YYYY-MM month, one row per category in CATEGORIES order.
export function monthTotals(db, ym) {
  const byKey = new Map();
  const transactions = db.prepare('SELECT description, cents FROM transactions WHERE substr(date, 1, 7) = ?');
  for (const row of transactions.all(ym)) {
    const key = categoryOf(row.description);
    byKey.set(key, (byKey.get(key) ?? 0) + row.cents);
  }
  const rows = CATEGORIES.map(({ key, label }) => ({ key, label, cents: byKey.get(key) ?? 0 }));
  const grandCents = rows.reduce((sum, row) => sum + row.cents, 0);
  return { rows, grandCents };
}
