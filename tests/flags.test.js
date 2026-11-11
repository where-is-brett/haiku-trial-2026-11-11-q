import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFlags, isOn } from '../src/lib/flags.js';

test('the statement-import switch is committed off', () => {
  const flags = loadFlags(new URL('../config/feature-flags.json', import.meta.url));
  assert.equal(isOn(flags, 'statement-import'), false);
});

test('a missing flags file means every switch is off', () => {
  assert.deepEqual(loadFlags(new URL('../config/no-such-file.json', import.meta.url)), {});
});

test('only a switch set to true is on', () => {
  assert.equal(isOn({ 'statement-import': true }, 'statement-import'), true);
  assert.equal(isOn({ 'statement-import': 'true' }, 'statement-import'), false);
  assert.equal(isOn({}, 'statement-import'), false);
});
