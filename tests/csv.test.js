import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/lib/csv.js';
import { StatementError } from '../src/lib/errors.js';

test('a quoted field keeps its comma', () => {
  assert.deepEqual(parseCsv('a,"b, c",d\n'), [{ line: 1, fields: ['a', 'b, c', 'd'] }]);
});

test('a doubled quote inside a quoted field is one quote', () => {
  assert.deepEqual(parseCsv('"say ""hi""",x'), [{ line: 1, fields: ['say "hi"', 'x'] }]);
});

test('CRLF and blank lines are handled and line numbers still count them', () => {
  assert.deepEqual(parseCsv('a,b\r\n\r\nc,d\r\n'), [
    { line: 1, fields: ['a', 'b'] },
    { line: 3, fields: ['c', 'd'] },
  ]);
});

test('a quoted field may hold a line break', () => {
  assert.deepEqual(parseCsv('"a\nb",c'), [{ line: 1, fields: ['a\nb', 'c'] }]);
});

test('an unclosed quote is a plain error', () => {
  assert.throws(() => parseCsv('a,"b\nc,d'), StatementError);
});

test('text after a closing quote is an error that names the record line', () => {
  assert.throws(
    () => parseCsv('a,"b,c\nd,"e",f\n'),
    (err) =>
      err instanceof StatementError && err.message === 'Line 1 has text after a closing quote',
  );
});

test('a quoted field directly before a comma is still one field', () => {
  assert.deepEqual(parseCsv('a,"b",c\n'), [{ line: 1, fields: ['a', 'b', 'c'] }]);
});

test('spaces after a closing quote, before a comma, are accepted', () => {
  assert.deepEqual(parseCsv('a,"b" ,c\n'), [{ line: 1, fields: ['a', 'b', 'c'] }]);
});

test('spaces before an opening quote are dropped and the quote still opens the field', () => {
  assert.deepEqual(parseCsv('a, "b,c"\n'), [{ line: 1, fields: ['a', 'b,c'] }]);
});

test('a line break inside a quoted field after a leading space stays inside the field', () => {
  assert.deepEqual(parseCsv('a, "b\nc",d\n'), [{ line: 1, fields: ['a', 'b\nc', 'd'] }]);
});

test('a quote in the middle of an unquoted field is literal', () => {
  assert.deepEqual(parseCsv('a,b"c,d\n'), [{ line: 1, fields: ['a', 'b"c', 'd'] }]);
});
