// src/lib/csv.js

import { StatementError } from './errors.js';

// Reads CSV text into records. A quoted field may hold commas, line breaks and doubled quotes.
// Fields are returned raw. A record that is only whitespace is skipped. Each record reports the
// 1-based line it starts on, counting every physical line break before it.
export function parseCsv(text) {
  const records = [];
  let fields = [];
  let field = '';
  let quoted = false;
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let recordStart = 0;

  const endRecord = (end) => {
    if (text.slice(recordStart, end).trim() !== '') {
      fields.push(field);
      records.push({ line: recordLine, fields });
    }
    fields = [];
    field = '';
    quoted = false;
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else if (ch === '\r' || ch === '\n') {
        const breakLength = ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
        field += text.slice(i, i + breakLength);
        i += breakLength;
        line += 1;
      } else {
        field += ch;
        i += 1;
      }
    } else if (quoted && (ch === ' ' || ch === '\t')) {
      i += 1;
    } else if (quoted && ch !== ',' && ch !== '\r' && ch !== '\n') {
      throw new StatementError(`Line ${recordLine} has text after a closing quote`);
    } else if (ch === '"' && field === '' && !quoted) {
      inQuotes = true;
      quoted = true;
      i += 1;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
      quoted = false;
      i += 1;
    } else if (ch === '\r' || ch === '\n') {
      endRecord(i);
      const breakLength = ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      i += breakLength;
      line += 1;
      recordLine = line;
      recordStart = i;
    } else if ((ch === ' ' || ch === '\t') && field === '') {
      // Blanks at the start of a field that lead into an opening quote are dropped, so the quote opens.
      let next = i;
      while (text[next] === ' ' || text[next] === '\t') next += 1;
      if (text[next] === '"') {
        i = next;
      } else {
        field += ch;
        i += 1;
      }
    } else {
      field += ch;
      i += 1;
    }
  }

  if (inQuotes) {
    throw new StatementError(`Line ${recordLine} has an unclosed quote`);
  }
  endRecord(text.length);
  return records;
}
