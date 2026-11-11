import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { openLedger } from '../src/lib/ledger.js';

const sample = readFileSync(new URL('../data/sample-statement.csv', import.meta.url));
const dataRows = sample.toString('utf8').split(/\r?\n/).filter((line) => line.trim()).length - 1;

async function start(flags = { 'statement-import': true }) {
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

test('a statement is imported and a second upload of it adds nothing', async () => {
  const { db, base, close } = await start();
  try {
    const first = await upload(base, sample);
    assert.match(await first.text(), new RegExp(`Added ${dataRows}, skipped 0`));
    const second = await upload(base, sample);
    assert.match(await second.text(), new RegExp(`Added 0, skipped ${dataRows}`));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, dataRows);
  } finally {
    await close();
  }
});

test('the sample statement keeps its quoted descriptions intact', async () => {
  const { db, base, close } = await start();
  try {
    await upload(base, sample);
    const row = db.prepare('SELECT date, cents FROM transactions WHERE description = ?').get('Pasta, Pizza & Co REF 3946');
    assert.deepEqual({ ...row }, { date: '2026-08-06', cents: 10229 });
  } finally {
    await close();
  }
});

test('/import shows Bank statement when the switch is on', async () => {
  const { base, close } = await start();
  try {
    const res = await fetch(`${base}/import`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Bank statement/);
  } finally {
    await close();
  }
});

test('with the switch off, or missing, /import is not found', async () => {
  for (const flags of [{ 'statement-import': false }, {}]) {
    const { base, close } = await start(flags);
    try {
      assert.equal((await fetch(`${base}/import`)).status, 404);
    } finally {
      await close();
    }
  }
});

test('a UTF-8 byte-order mark and CRLF endings are accepted', async () => {
  const { base, close } = await start();
  try {
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Date,Description,Amount\r\n02/08/2026,Test,1.00\r\n')]);
    assert.match(await (await upload(base, bytes)).text(), /Added 1, skipped 0/);
  } finally {
    await close();
  }
});
