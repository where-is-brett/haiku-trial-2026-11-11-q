import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openLedger } from '../src/lib/ledger.js';
import { importRows } from '../src/lib/statement.js';

const row = { date: '2026-08-02', description: 'Pennywhistle Market', cents: 10152 };

test('new rows are added', () => {
  const db = openLedger(':memory:');
  assert.deepEqual(importRows(db, [row]), { added: 1, skipped: 0 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 1);
});

test('re-importing the same rows adds nothing', () => {
  const db = openLedger(':memory:');
  importRows(db, [row, { ...row, cents: 50 }]);
  assert.deepEqual(importRows(db, [row, { ...row, cents: 50 }]), { added: 0, skipped: 2 });
});

test('one stored row cancels one identical row in the file', () => {
  const db = openLedger(':memory:');
  importRows(db, [row]);
  assert.deepEqual(importRows(db, [row, row]), { added: 1, skipped: 1 });
});

test('two identical rows with nothing stored are both kept', () => {
  const db = openLedger(':memory:');
  assert.deepEqual(importRows(db, [row, row]), { added: 2, skipped: 0 });
});
