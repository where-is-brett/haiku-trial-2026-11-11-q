// src/lib/multipart.js

const CRLF = Buffer.from('\r\n');
const HEADER_END = Buffer.from('\r\n\r\n');

// Returns the raw bytes of the multipart part whose Content-Disposition names it "statement",
// or null when there is no such part. Works on the Buffer, never on a string split of the whole
// body, so binary bytes survive. Headers are read as latin1, which maps every byte to one character.
export function readStatementField(body, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^\s;]+))/i.exec(contentType);
  if (!match) return null;
  const boundary = match[1] ?? match[2];

  const first = Buffer.from(`--${boundary}`);
  const separator = Buffer.concat([CRLF, first]);

  const start = body.indexOf(first);
  if (start === -1) return null;

  let cursor = start + first.length;
  for (;;) {
    const next = body.indexOf(separator, cursor);
    if (next === -1) return null;
    const part = readStatementPart(body.subarray(cursor, next));
    if (part) return part;
    cursor = next + separator.length;
  }
}

// A part is the bytes between two delimiters: a CRLF, the headers, a blank line, then the content.
// Returns the content when this part is the statement field, otherwise null.
function readStatementPart(segment) {
  const headerEnd = segment.indexOf(HEADER_END);
  if (headerEnd === -1) return null;

  const headers = segment.subarray(0, headerEnd).toString('latin1');
  const disposition = /^content-disposition:[^\r\n]*/im.exec(headers);
  if (!disposition || !/;\s*name="statement"/i.test(disposition[0])) return null;

  return segment.subarray(headerEnd + HEADER_END.length);
}
