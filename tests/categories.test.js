// tests/categories.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, SHOPS, categoryOf } from '../src/lib/categories.js';

test('the categories are the eight keys in order', () => {
  assert.deepEqual(CATEGORIES.map((c) => c.key), [
    'groceries', 'eating_out', 'transport', 'bills',
    'shopping', 'health', 'income', 'other',
  ]);
});

test('a description with each shop name gets that shop category', () => {
  for (const { name, category } of SHOPS) {
    assert.equal(categoryOf(`${name} 0412 SYDNEY`), category);
  }
});

test('shop names match case-insensitively', () => {
  assert.equal(categoryOf('POS GREENBARROW fresh #12'), 'groceries');
});

test('a description with no shop is other', () => {
  assert.equal(categoryOf('ATM WITHDRAWAL 0900'), 'other');
});

test('the Pasta, Pizza & Co name with its comma matches eating_out', () => {
  assert.equal(categoryOf('Pasta, Pizza & Co Sydney'), 'eating_out');
  assert.equal(categoryOf('Pasta Pizza & Co Sydney'), 'other');
});

test('an empty or missing description is other', () => {
  assert.equal(categoryOf(''), 'other');
  assert.equal(categoryOf(undefined), 'other');
  assert.equal(categoryOf(null), 'other');
});

test('a description naming two shops takes the one listed first', () => {
  assert.equal(categoryOf('Lowtide Grocers and Tramline Fares'), 'groceries');
});
