import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openLedger, monthsOf } from '../src/lib/ledger.js';
import { importRows } from '../src/lib/statement.js';

test('months with transactions are listed once each, newest first', () => {
  const db = openLedger(':memory:');
  const dates = ['2027-01-05', '2026-12-30', '2026-08-03', '2026-08-19', '2027-01-09'];
  importRows(db, dates.map((date, i) => ({ date, description: `Row ${i}`, cents: 100 + i })));
  assert.deepEqual(monthsOf(db), ['2027-01', '2026-12', '2026-08']);
});

test('an empty ledger has no months', () => {
  const db = openLedger(':memory:');
  assert.deepEqual(monthsOf(db), []);
});
