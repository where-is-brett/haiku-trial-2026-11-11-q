import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountField, parseStatement } from '../src/lib/statement.js';
import { StatementError } from '../src/lib/errors.js';

test('amounts read as signed cents', () => {
  assert.equal(parseAmountField('12.50'), 1250);
  assert.equal(parseAmountField('8.5'), 850);
  assert.equal(parseAmountField('1,234.50'), 123450);
  assert.equal(parseAmountField('(40.00)'), -4000);
  assert.equal(parseAmountField('(1,234.50)'), -123450);
  assert.equal(parseAmountField('-2112.90'), -211290);
});

test('amounts that are not money are refused', () => {
  for (const text of ['+5', '5.', '1.2.3', '', 'EUR 5', '1,23.00', '(40.00', '-(40.00)']) {
    assert.throws(() => parseAmountField(text), StatementError, text);
  }
});

test('a statement with a valid header and rows is read', () => {
  const rows = parseStatement(
    'Date,Description,Amount\r\n02/08/2026,"Pasta, Pizza & Co REF 3946",102.29\r\n19/08/2026,Marlowe Homewares,(40.00)\r\n',
  );
  assert.deepEqual(rows, [
    { date: '2026-08-02', description: 'Pasta, Pizza & Co REF 3946', cents: 10229 },
    { date: '2026-08-19', description: 'Marlowe Homewares', cents: -4000 },
  ]);
});

test('the header is trimmed and case-insensitive', () => {
  assert.deepEqual(parseStatement('  date ,DESCRIPTION,amount\n'), []);
});

test('a wrong header is refused', () => {
  assert.throws(() => parseStatement('Date,Amount,Description\n'), /The header must be Date,Description,Amount/);
});

test('a description that spans two lines is refused, naming the line where the record starts', () => {
  assert.throws(
    () => parseStatement('Date,Description,Amount\n02/08/2026,"Pasta,102.29\n03/08/2026,Shop,5.00\n04/08/2026,Foo",7.00\n'),
    (error) => error instanceof StatementError && error.message === 'Line 2 has a line break inside a field',
  );
});

test('an impossible date is refused and a leap day is accepted', () => {
  assert.throws(() => parseStatement('Date,Description,Amount\n31/02/2026,X,1.00\n'), StatementError);
  assert.equal(parseStatement('Date,Description,Amount\n29/02/2028,X,1.00\n')[0].date, '2028-02-29');
});

test('a date in year 0000 is refused', () => {
  assert.throws(
    () => parseStatement('Date,Description,Amount\n01/01/0000,Shop,5.00\n'),
    /Line 2 has a date that is not a real DD\/MM\/YYYY date/,
  );
});
