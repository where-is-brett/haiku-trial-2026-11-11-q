import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { openLedger } from '../src/lib/ledger.js';
import { CATEGORIES } from '../src/lib/categories.js';
import { loadFlags, isOn } from '../src/lib/flags.js';

async function start(flags = { 'month-page': true }) {
  const db = openLedger(':memory:');
  const server = createApp({ db, flags });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  return { db, server, base, close: () => new Promise((resolve) => server.close(resolve)) };
}

function seed(db, rows) {
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  for (const [date, description, cents] of rows) insert.run(date, description, cents);
}

test('the page shows one row per category in CATEGORIES order, then the grand total', async () => {
  const { base, close } = await start();
  try {
    const res = await fetch(`${base}/month?m=2026-08`);
    assert.equal(res.status, 200);
    const keys = [...(await res.text()).matchAll(/data-category="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(keys, [...CATEGORIES.map((c) => c.key), 'all']);
  } finally {
    await close();
  }
});

test('every total is a plain decimal, and a month with no transactions shows 0.00 for each', async () => {
  const { base, close } = await start();
  try {
    const body = await (await fetch(`${base}/month?m=2026-08`)).text();
    const totals = [...body.matchAll(/data-total="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(totals.length, CATEGORIES.length + 1);
    for (const total of totals) {
      assert.match(total, /^-?\d+\.\d{2}$/);
      assert.equal(total, '0.00');
    }
  } finally {
    await close();
  }
});

test('a seeded month shows Eating out with its total', async () => {
  const { db, base, close } = await start();
  try {
    seed(db, [['2026-08-06', 'Pasta, Pizza & Co REF 3946', -4000]]);
    const body = await (await fetch(`${base}/month?m=2026-08`)).text();
    assert.match(body, /Eating out/);
    assert.match(body, /data-category="eating_out" data-total="-40\.00"/);
  } finally {
    await close();
  }
});

test('a fall shows as a minus sign and the grand total follows the rows', async () => {
  const { db, base, close } = await start();
  try {
    seed(db, [
      ['2026-08-06', 'Pasta, Pizza & Co REF 3946', -4000],
      ['2026-08-25', 'Brightwave Payroll', 1000],
    ]);
    const body = await (await fetch(`${base}/month?m=2026-08`)).text();
    assert.match(body, /data-category="eating_out" data-total="-40\.00"/);
    assert.match(body, /data-category="all" data-total="-30\.00"/);
  } finally {
    await close();
  }
});

test('previous and next links point at the months either side, across the year', async () => {
  const { base, close } = await start();
  try {
    const december = await (await fetch(`${base}/month?m=2026-12`)).text();
    assert.match(december, /href="\/month\?m=2026-11">Previous month</);
    assert.match(december, /href="\/month\?m=2027-01">Next month</);
    const january = await (await fetch(`${base}/month?m=2026-01`)).text();
    assert.match(january, /href="\/month\?m=2025-12">Previous month</);
  } finally {
    await close();
  }
});

test('a missing or bad m gets 400 and the error text, and no part of m is echoed', async () => {
  const { base, close } = await start();
  try {
    const bad = ['', '2026-13', '2026-8', '<b>x</b>', '2026-08 '];
    const urls = [`${base}/month`, ...bad.map((m) => `${base}/month?m=${encodeURIComponent(m)}`)];
    for (const url of urls) {
      const res = await fetch(url);
      const body = await res.text();
      assert.equal(res.status, 400, url);
      assert.match(body, /Choose a month as YYYY-MM/, url);
      assert.doesNotMatch(body, /<b>x<\/b>/, url);
    }
  } finally {
    await close();
  }
});

test('the page is not found when the month-page switch is off or missing', async () => {
  for (const flags of [{ 'month-page': false }, {}]) {
    const { base, close } = await start(flags);
    try {
      assert.equal((await fetch(`${base}/month?m=2026-08`)).status, 404);
    } finally {
      await close();
    }
  }
});

test('the committed switch is off', () => {
  const flags = loadFlags(new URL('../config/feature-flags.json', import.meta.url));
  assert.equal(isOn(flags, 'month-page'), false);
});
