// tests/money-edge.test.js
// These pin how parseAmount behaves today; they document current behaviour, not a fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../src/lib/money.js';

test('a blank amount is NaN', () => {
  assert.ok(Number.isNaN(parseAmount('')));
});

test('an amount of only spaces is NaN', () => {
  assert.ok(Number.isNaN(parseAmount('   ')));
});

test('a negative amount is read as negative cents', () => {
  assert.equal(parseAmount('-40.00'), -4000);
});

test('an amount with a thousands comma is read as cents', () => {
  assert.equal(parseAmount('1,234.56'), 123456);
});

test('a negative amount with a thousands comma is read as negative cents', () => {
  assert.equal(parseAmount('-1,234.56'), -123456);
});
