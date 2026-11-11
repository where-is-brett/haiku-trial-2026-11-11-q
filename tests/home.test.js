import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { openLedger } from '../src/lib/ledger.js';
import { importRows, parseStatement } from '../src/lib/statement.js';

// Rows in two months, the later one first in the file so the order on the page cannot come from the file.
const twoMonths = Buffer.from('Date,Description,Amount\n05/09/2026,Late shop,5.00\n06/08/2026,Early shop,3.00\n');

async function start(flags) {
  const db = openLedger(':memory:');
  const server = createApp({ db, flags });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  return { db, base, close: () => new Promise((resolve) => server.close(resolve)) };
}

function upload(base, bytes) {
  const form = new FormData();
  form.append('statement', new Blob([bytes], { type: 'text/csv' }), 'statement.csv');
  return fetch(`${base}/import`, { method: 'POST', body: form });
}

test('the home page lists months newest first, below the existing line', async () => {
  const { base, close } = await start({ 'statement-import': true });
  try {
    await upload(base, twoMonths);
    const html = await (await fetch(`${base}/`)).text();
    const late = html.indexOf('/month?m=2026-09');
    const early = html.indexOf('/month?m=2026-08');
    assert.ok(late >= 0, 'the 2026-09 link is missing');
    assert.ok(early >= 0, 'the 2026-08 link is missing');
    assert.ok(late < early, 'the months are not newest first');
    const line = html.indexOf('transactions imported');
    assert.ok(line >= 0, 'the existing line is missing');
    assert.ok(line < late, 'the month list is not below the existing line');
  } finally {
    await close();
  }
});

test('with the switch off the home page lists no months and keeps the existing line', async () => {
  const { db, base, close } = await start({ 'statement-import': false });
  try {
    // /import is not found while the switch is off, so the rows go in through the same importer it uses.
    importRows(db, parseStatement(twoMonths.toString('utf8')));
    const html = await (await fetch(`${base}/`)).text();
    assert.doesNotMatch(html, /\/month\?m=/);
    assert.match(html, /2 transactions imported/);
  } finally {
    await close();
  }
});

test('with the switch on and an empty ledger the home page lists no months', async () => {
  const { base, close } = await start({ 'statement-import': true });
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /Nothing imported yet/);
    assert.doesNotMatch(html, /\/month\?m=/);
  } finally {
    await close();
  }
});
