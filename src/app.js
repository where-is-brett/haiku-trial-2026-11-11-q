// src/app.js
import http from 'node:http';
import { StatementError } from './lib/errors.js';
import { isOn } from './lib/flags.js';
import { readStatementField } from './lib/multipart.js';
import { importRows, parseStatement } from './lib/statement.js';

const SWITCH = 'statement-import';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// The file plus room for the multipart headers around it.
const MAX_BODY_BYTES = MAX_FILE_BYTES + 64 * 1024;
const TOO_LARGE = 'This file is larger than 5 MB';

// Builds the HTTP app over an open ledger. The server is returned, not listening.
export function createApp({ db, flags }) {
  return http.createServer(async (req, res) => {
    try {
      await route(req, res, db, flags);
    } catch (error) {
      // Nothing thrown here may reach Node as an unhandled rejection, which would end the process.
      console.error(error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }
      res.end('Something went wrong');
    }
  });
}

async function route(req, res, db, flags) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions').get();
    const body = n === 0 ? '<p>Nothing imported yet</p>' : `<p>${n} transactions imported</p>`;
    sendHtml(res, 200, page(body));
    return;
  }
  if (url.pathname === '/import' && isOn(flags, SWITCH)) {
    if (req.method === 'GET') {
      sendHtml(res, 200, importPage(''));
      return;
    }
    if (req.method === 'POST') {
      await handleUpload(req, res, db);
      return;
    }
  }
  notFound(res);
}

async function handleUpload(req, res, db) {
  let body;
  try {
    body = await readBody(req, MAX_BODY_BYTES);
  } catch (error) {
    if (!(error instanceof BodyTooLarge)) throw error;
    res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
    res.end(TOO_LARGE);
    return;
  }

  try {
    const file = readStatementField(body, req.headers['content-type'] ?? '');
    if (file === null || file.length === 0) {
      throw new StatementError('Choose a statement file');
    }
    if (file.length > MAX_FILE_BYTES) {
      throw new StatementError(TOO_LARGE);
    }
    const { added, skipped } = importRows(db, parseStatement(decodeUtf8(file)));
    sendHtml(res, 200, importPage(`<p>Added ${added}, skipped ${skipped}</p>`));
  } catch (error) {
    if (!(error instanceof StatementError)) throw error;
    sendHtml(res, 400, importPage(`<p>${escapeHtml(error.message)}</p>`));
  }
}

// Strict UTF-8: bytes that are not valid UTF-8 are refused. A leading byte-order mark is dropped
// by the decoder, which is what a statement saved by a spreadsheet needs.
function decodeUtf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new StatementError('This file is not UTF-8 text');
  }
}

function importPage(message) {
  return page(`<h2>Bank statement</h2>
${message}
<form method="post" enctype="multipart/form-data">
<input type="file" name="statement">
<button type="submit">Import</button>
</form>`);
}

class BodyTooLarge extends Error {}

// Collects the request body up to the limit. Past the limit it rejects, and it drops the rest of
// the body without keeping it.
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        reject(new BodyTooLarge());
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendHtml(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spending tracker</title></head>
<body>
<main>
<h1>Spending tracker</h1>
${body}
</main>
</body>
</html>
`;
}
