import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMonth, shiftMonth } from '../src/lib/month.js';

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
