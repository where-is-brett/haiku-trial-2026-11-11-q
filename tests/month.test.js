import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMonth, shiftMonth, monthTotals } from '../src/lib/month.js';
import { CATEGORIES } from '../src/lib/categories.js';
import { openLedger } from '../src/lib/ledger.js';

test('parseMonth accepts only YYYY-MM with a month from 01 to 12', () => {
  assert.equal(parseMonth('2026-08'), '2026-08');
  for (const bad of ['2026-00', '2026-13', '2026-8', '26-08', '2026-08-01', '2026-08 ', ' 2026-08', '', undefined, null, '<b>2026-08</b>']) {
    assert.equal(parseMonth(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('shiftMonth moves a month either way and across the year', () => {
  assert.equal(shiftMonth('2026-08', -1), '2026-07');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-08', 1), '2026-09');
});

function seed(db, rows) {
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  for (const [date, description, cents] of rows) insert.run(date, description, cents);
}

test('a month with no transactions gives every category 0 and a grand total of 0', () => {
  const { rows, grandCents } = monthTotals(openLedger(':memory:'), '2026-08');
  assert.deepEqual(rows.map((r) => r.key), CATEGORIES.map((c) => c.key));
  assert.ok(rows.every((r) => r.cents === 0));
  assert.equal(grandCents, 0);
});

test('a transaction is counted in the month of its stored date, at both ends of the month', () => {
  const db = openLedger(':memory:');
  seed(db, [
    ['2026-07-31', 'Greenbarrow Fresh', -1000],
    ['2026-08-01', 'Greenbarrow Fresh', -250],
    ['2026-08-31', 'Greenbarrow Fresh', -300],
    ['2026-09-01', 'Greenbarrow Fresh', -700],
  ]);
  const { rows, grandCents } = monthTotals(db, '2026-08');
  assert.equal(rows.find((r) => r.key === 'groceries').cents, -550);
  assert.equal(grandCents, -550);
});

test('the grand total is the sum of the category totals, money back and income included', () => {
  const db = openLedger(':memory:');
  seed(db, [
    ['2026-08-03', 'Pasta, Pizza & Co', -4000],
    ['2026-08-25', 'Brightwave Payroll', 50000],
    ['2026-08-14', 'Refund from Quillon Books', 1500],
    ['2026-08-09', 'Greenbarrow Fresh', -2000],
  ]);
  const { rows, grandCents } = monthTotals(db, '2026-08');
  assert.equal(grandCents, -4000 + 50000 + 1500 - 2000);
  assert.equal(grandCents, rows.reduce((sum, r) => sum + r.cents, 0));
});

test('a description that matches no shop is counted as other', () => {
  const db = openLedger(':memory:');
  seed(db, [['2026-08-12', 'Unknown Shop', -999]]);
  const { rows } = monthTotals(db, '2026-08');
  assert.equal(rows.find((r) => r.key === 'other').cents, -999);
});
