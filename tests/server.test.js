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
