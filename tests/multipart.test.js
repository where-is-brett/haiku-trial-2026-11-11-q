import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStatementField } from '../src/lib/multipart.js';

const part = (name, filename, content) =>
  `--XX\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: text/csv\r\n\r\n${content}\r\n`;

test('the statement part is returned as its exact bytes', () => {
  const body = Buffer.from(part('statement', 'a.csv', 'Date,Description,Amount') + '--XX--\r\n');
  assert.equal(readStatementField(body, 'multipart/form-data; boundary=XX').toString(), 'Date,Description,Amount');
});

test('bytes that are not text survive', () => {
  const head = Buffer.from('--XX\r\nContent-Disposition: form-data; name="statement"; filename="a.csv"\r\n\r\n');
  const body = Buffer.concat([head, Buffer.from([0xff, 0xfe, 0x00]), Buffer.from('\r\n--XX--\r\n')]);
  assert.deepEqual(readStatementField(body, 'multipart/form-data; boundary=XX'), Buffer.from([0xff, 0xfe, 0x00]));
});

test('a quoted boundary is accepted', () => {
  const body = Buffer.from(part('statement', 'a.csv', 'x') + '--XX--\r\n');
  assert.equal(readStatementField(body, 'multipart/form-data; boundary="XX"').toString(), 'x');
});

test('an empty file gives an empty buffer and a missing field gives null', () => {
  assert.equal(readStatementField(Buffer.from(part('statement', '', '') + '--XX--\r\n'), 'multipart/form-data; boundary=XX').length, 0);
  assert.equal(readStatementField(Buffer.from(part('other', 'a.csv', 'x') + '--XX--\r\n'), 'multipart/form-data; boundary=XX'), null);
});
