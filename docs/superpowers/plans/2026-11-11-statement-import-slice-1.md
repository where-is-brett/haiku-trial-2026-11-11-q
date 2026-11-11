# Statement import, slice 1: Upload a statement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/import` accepts a bank statement CSV, adds its rows, reports `Added n, skipped n`, and skips rows already stored.

**Architecture:** The HTTP app moves out of `src/server.js` into `createApp({ db, flags })`, so tests can run it with the feature switch on and an in-memory ledger. Small pure modules do the work: a CSV reader, a statement parser, a multipart field reader and a row importer. `server.js` only wires startup: env, ledger, flags, listen.

**Tech Stack:** Node 22.13+, `node:sqlite`, `node:http`, `node:test`. No new npm dependency.

**Spec:** `.wheelhouse/feature/approved.md` (read whole; it decides the duplicate rule, amount reading, 5 MB limit, encoding, and the feature switch).

## Global Constraints

- Node 22.13 or later; `node:sqlite` and `node:http` as `src/server.js` already uses them. No new npm dependency.
- Header is exactly `Date,Description,Amount`, trimmed, case-insensitive, in that column order.
- Dates are DD/MM/YYYY, read with `parseDate` from `src/lib/dates.js`, after the importer checks the pattern and the calendar day.
- Amounts are read with `parseAmount` from `src/lib/money.js`, after the importer strips brackets and applies the sign. Brackets and a leading `-` both mean money going out (negative).
- Duplicate: one for one. Each stored row (same date, description, cents) cancels at most one row of the new file. The check reads the rows stored when the upload starts.
- Upload limit: 5 MB = `5 * 1024 * 1024` bytes of file content.
- Feature switch `statement-import` in `config/feature-flags.json`, committed `false`. A missing key or missing file is off. While off, `/import` is 404 and the home page is unchanged.
- `PORT` (default 3000) and `LEDGER_DB` (default `ledger.db`, `:memory:` works) keep working.
- Error text is HTML-escaped before it is shown.

## Review Focus

1. A quoted field with a comma and a doubled quote (`"Pasta, Pizza & Co ""Deluxe"""`) is read as one field with the quotes restored.
2. A file saved with a UTF-8 byte-order mark and CRLF line endings imports, and its header is still recognised.
3. Thousands-separated amounts (`1,234.50`, `(1,234.50)`) read as 123450 and -123450 cents.
4. An impossible date (`31/02/2026`) is refused, and a leap day (`29/02/2028`) is accepted.
5. Two identical rows in one file, with nothing stored yet, are both kept.

Each line above gets its test in the task that owns the code (Tasks 2, 6, 3, 3, 4).

---

### Task 1: Feature switch file and reader

**Files:**
- Create: `config/feature-flags.json`, `src/lib/flags.js`
- Test: `tests/flags.test.js`

**Interfaces:**
- Produces: `loadFlags(path: string | URL) -> Record<string, unknown>` (missing file gives `{}`); `isOn(flags: Record<string, unknown>, name: string) -> boolean` (true only when `flags[name] === true`).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/lib/flags.js`.

- [ ] **Step 3: Implement**

`config/feature-flags.json` holds `{ "statement-import": false }`. `flags.js` uses `existsSync` and `readFileSync` (both accept a URL), and `JSON.parse`.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS, all tests in `flags.test.js` and the two existing ones.

- [ ] **Step 5: Commit**

```bash
git add config/feature-flags.json src/lib/flags.js tests/flags.test.js
git commit -m "Add the statement-import feature switch"
```

---

### Task 2: CSV reader

**Files:**
- Create: `src/lib/errors.js`, `src/lib/csv.js`
- Test: `tests/csv.test.js`

**Interfaces:**
- Produces: `class StatementError extends Error` (in `errors.js`; user-facing text, shown as is). `parseCsv(text: string) -> Array<{ line: number, fields: string[] }>`: RFC 4180 subset. Fields are raw (not trimmed). Quoted fields may hold commas, line breaks and `""`. `line` is the 1-based line where the record starts. A record that is only whitespace is skipped. An unclosed quote throws `StatementError` with `Line n has an unclosed quote`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/lib/csv.js`.

- [ ] **Step 3: Implement**

One pass over the characters with an inside-quotes flag. Split records on line breaks outside quotes. Track the starting line of each record and count every line break, including those inside quotes.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.js src/lib/csv.js tests/csv.test.js
git commit -m "Read statement CSV with quoted fields"
```

---

### Task 3: Statement rows

**Files:**
- Create: `src/lib/statement.js`
- Test: `tests/statement.test.js`

**Interfaces:**
- Consumes: `parseCsv`, `StatementError`, `parseDate` (`src/lib/dates.js`), `parseAmount` (`src/lib/money.js`).
- Produces: `parseAmountField(text: string) -> number` (signed cents, throws `StatementError`); `parseStatement(text: string) -> Array<{ date: string, description: string, cents: number }>` (`date` is `YYYY-MM-DD`; throws `StatementError`).

Rules, with the messages to use:
- Header: the first non-blank record, trimmed and lower-cased, must equal `date,description,amount`. Otherwise `The header must be Date,Description,Amount`. A file with no records at all also gets this.
- Each row must have exactly 3 fields, else `Line n must have 3 fields`.
- Date: trimmed; must match `/^\d{2}\/\d{2}\/\d{4}$/` and be a real calendar day (check by `Date.UTC` round-trip), else `Line n has a date that is not a real DD/MM/YYYY date`. Then `parseDate`.
- Amount: trimmed. A value wrapped in `(` and `)` is negative and the inside is read. A value starting with `-` is negative and the rest is read. The inside must match `/^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/`, else `Line n has an amount that is not money`. Read the inside with `parseAmount`, then apply the sign.
- Description: trimmed; no other check.
- Header-only text returns `[]`.

- [ ] **Step 1: Write the failing test**

```js
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

test('an impossible date is refused and a leap day is accepted', () => {
  assert.throws(() => parseStatement('Date,Description,Amount\n31/02/2026,X,1.00\n'), StatementError);
  assert.equal(parseStatement('Date,Description,Amount\n29/02/2028,X,1.00\n')[0].date, '2028-02-29');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/lib/statement.js`.

- [ ] **Step 3: Implement**

Build on `parseCsv`. Validate every row before returning, so the first bad row throws and nothing is returned. Keep the message texts above exact.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/statement.js tests/statement.test.js
git commit -m "Parse statement rows and refuse bad ones"
```

---

### Task 4: Ledger and row import

**Files:**
- Create: `src/lib/ledger.js`
- Modify: `src/lib/statement.js` (add `importRows`)
- Test: `tests/import-rows.test.js`

**Interfaces:**
- Consumes: `parseStatement` output shape from Task 3.
- Produces: `openLedger(path: string) -> DatabaseSync` (opens the file, runs the same `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)` that `src/server.js` runs today); `importRows(db: DatabaseSync, rows: Array<{ date, description, cents }>) -> { added: number, skipped: number }`.

Behaviour: inside `BEGIN IMMEDIATE`, read the stored rows and count them by key `JSON.stringify([date, description, cents])`. Walk the new rows: a row whose key has a count above zero takes one from the count and is skipped; any other row is added (and is not counted for later rows in the same file). Insert the added rows in the same transaction. `COMMIT`; on any error `ROLLBACK` and rethrow.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openLedger } from '../src/lib/ledger.js';
import { importRows } from '../src/lib/statement.js';

const row = { date: '2026-08-02', description: 'Pennywhistle Market', cents: 10152 };

test('new rows are added', () => {
  const db = openLedger(':memory:');
  assert.deepEqual(importRows(db, [row]), { added: 1, skipped: 0 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 1);
});

test('re-importing the same rows adds nothing', () => {
  const db = openLedger(':memory:');
  importRows(db, [row, { ...row, cents: 50 }]);
  assert.deepEqual(importRows(db, [row, { ...row, cents: 50 }]), { added: 0, skipped: 2 });
});

test('one stored row cancels one identical row in the file', () => {
  const db = openLedger(':memory:');
  importRows(db, [row]);
  assert.deepEqual(importRows(db, [row, row]), { added: 1, skipped: 1 });
});

test('two identical rows with nothing stored are both kept', () => {
  const db = openLedger(':memory:');
  assert.deepEqual(importRows(db, [row, row]), { added: 2, skipped: 0 });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/lib/ledger.js` or `importRows` is not exported.

- [ ] **Step 3: Implement**

As in Behaviour above. Export `importRows` from `statement.js`.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ledger.js src/lib/statement.js tests/import-rows.test.js
git commit -m "Import statement rows once, one for one against stored rows"
```

---

### Task 5: Read the uploaded file

**Files:**
- Create: `src/lib/multipart.js`
- Test: `tests/multipart.test.js`

**Interfaces:**
- Produces: `readStatementField(body: Buffer, contentType: string) -> Buffer | null`. Finds the part whose `Content-Disposition` has `; name="statement"` and returns its raw bytes (no trailing CRLF). Returns `null` if no such part exists. A part with an empty file gives an empty Buffer. Takes the boundary from `boundary=` in `contentType`, quoted or not.

Implementation note: work on the Buffer with `indexOf`, never a string split on the whole body, so binary bytes survive. Parse headers as `latin1`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/lib/multipart.js`.

- [ ] **Step 3: Implement**

Split on `--boundary` with `indexOf` from the Buffer. For each part, find the header end (`\r\n\r\n`), skip parts with no header end (the closing `--`), check the disposition, and cut the content up to the CRLF before the next delimiter.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/multipart.js tests/multipart.test.js
git commit -m "Read the statement field from an upload"
```

---

### Task 6: The import page and route

**Files:**
- Create: `src/app.js`
- Test: `tests/import.test.js`

**Interfaces:**
- Consumes: `openLedger` (Task 4), `importRows`, `parseStatement`, `StatementError` (Tasks 2–4), `readStatementField` (Task 5), `isOn` (Task 1).
- Produces: `createApp({ db: DatabaseSync, flags: Record<string, unknown> }) -> http.Server`. The server is returned not listening; callers call `listen`.

Routes:
- `GET /`: the home page as `src/server.js` renders it today (`Nothing imported yet` or `n transactions imported`), unchanged.
- `GET /import` and `POST /import`: 404 (the same `Not found` text as today) unless `isOn(flags, 'statement-import')`.
- `GET /import` when on: the page with `<h2>Bank statement</h2>` and a `method="post"`, `enctype="multipart/form-data"` form holding one `<input type="file" name="statement">` and a submit button.
- `POST /import` when on: read the body up to `5 MB + 64 KiB`. Over that, respond 413 with `This file is larger than 5 MB` and `connection: close`. Take the field with `readStatementField`. Null or zero length: `Choose a statement file`. Over `5 * 1024 * 1024` bytes: `This file is larger than 5 MB`. Decode with `new TextDecoder('utf-8', { fatal: true })` (this drops a byte-order mark); a decode error gives `This file is not UTF-8 text`. Then `parseStatement`, then `importRows`. Success: 200 and the form with `<p>Added n, skipped n</p>`. A `StatementError` gives 400 and the form with the message escaped. Other errors are not caught.
- `escapeHtml` for every error text shown.

- [ ] **Step 1: Write the failing test**

```js
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

```

This file holds the five tests above. The refusal tests (wrong header, bad row, empty upload) are slice 2's.

- [ ] **Step 2: Run it and see it fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/app.js`.

- [ ] **Step 3: Implement**

`app.js` holds `page(body)` (moved from `src/server.js`, same markup), `escapeHtml`, `readBody`, and `createApp`. Keep the home page markup identical.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js tests/import.test.js
git commit -m "Add the /import page and its upload route behind the switch"
```

---

### Task 7: Startup wiring

**Files:**
- Modify: `src/server.js`
- Test: `tests/server.test.js`

**Interfaces:**
- Consumes: `createApp` (Task 6), `openLedger` (Task 4), `loadFlags` (Task 1).

`server.js` reads `PORT` and `LEDGER_DB`, opens the ledger, loads `config/feature-flags.json` once at startup (path from `new URL('../config/feature-flags.json', import.meta.url)`), creates the app and listens. Its log line stays `listening on <port>`.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('the server starts on PORT with an in-memory ledger and serves the home page', async () => {
  const child = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, PORT: '0', LEDGER_DB: ':memory:' },
  });
  try {
    const port = await new Promise((resolve, reject) => {
      child.stdout.on('data', (chunk) => {
        const match = /listening on (\d+)/.exec(chunk.toString());
        if (match) resolve(match[1]);
      });
      child.on('exit', () => reject(new Error('server exited')));
    });
    const res = await fetch(`http://localhost:${port}/`);
    assert.match(await res.text(), /Nothing imported yet/);
  } finally {
    child.kill();
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test`
Expected: FAIL. The current `server.js` ignores `PORT: 0` and its ledger is not in memory, or it times out. Read the output and confirm it is the current code's fault before you change it.

- [ ] **Step 3: Implement**

Rewrite `src/server.js` as the wiring described above. It must not contain route code.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS, every test file.

- [ ] **Step 5: Commit**

```bash
git add src/server.js tests/server.test.js
git commit -m "Wire the app at startup from env and the feature switch"
```

---

## Self-review notes

- Spec coverage for slice 1: done 1 (second upload adds nothing) in Task 6 and Task 4; done 2 (quoted descriptions) in Task 6; done 3 (`/import` shows Bank statement) in Task 6; flag behaviour in Tasks 1 and 6; the BOM and CRLF rule in Task 6; the 5 MB limit in Task 6; `PORT` and `LEDGER_DB` in Task 7. Refusal tests (wrong header, bad row, empty file) are slice 2's, though the code that refuses them lands here.
- Names checked: `parseCsv`, `StatementError`, `parseAmountField`, `parseStatement`, `importRows`, `openLedger`, `readStatementField`, `createApp`, `loadFlags`, `isOn`.
