// src/lib/statement.js

import { parseCsv } from './csv.js';
import { StatementError } from './errors.js';
import { parseDate } from './dates.js';
import { parseAmount } from './money.js';

const HEADER = ['date', 'description', 'amount'];
const DATE_SHAPE = /^\d{2}\/\d{2}\/\d{4}$/;
// Plain digits, or digits with thousands separators, then an optional decimal part of 1 or 2 digits.
const AMOUNT_SHAPE = /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/;

// Reads one amount field as signed cents. Brackets and a leading '-' both mean money coming back, stored as a negative amount.
// The line is used only in the error message.
export function parseAmountField(text, line) {
  const value = String(text).trim();
  let inside = value;
  let negative = false;
  if (value.startsWith('(') && value.endsWith(')')) {
    inside = value.slice(1, -1);
    negative = true;
  } else if (value.startsWith('-')) {
    inside = value.slice(1);
    negative = true;
  }
  if (!AMOUNT_SHAPE.test(inside)) {
    throw new StatementError(`Line ${line} has an amount that is not money`);
  }
  const cents = parseAmount(inside);
  // Avoid negative zero for a value such as (0.00).
  return negative && cents !== 0 ? -cents : cents;
}

// Reads a bank statement CSV. Every row is checked before anything is returned.
export function parseStatement(text) {
  // A byte-order mark is not part of the header.
  const records = parseCsv(text.replace(/^﻿/, ''));
  if (records.length === 0 || !isHeader(records[0].fields)) {
    throw new StatementError('The header must be Date,Description,Amount');
  }
  return records.slice(1).map(({ line, fields }) => {
    // A line break inside a quoted field is refused, so nothing from the record is stored.
    if (fields.some((field) => field.includes('\n') || field.includes('\r'))) {
      throw new StatementError(`Line ${line} has a line break inside a field`);
    }
    if (fields.length !== 3) {
      throw new StatementError(`Line ${line} must have 3 fields`);
    }
    const date = fields[0].trim();
    if (!DATE_SHAPE.test(date) || !isRealDay(date)) {
      throw new StatementError(`Line ${line} has a date that is not a real DD/MM/YYYY date`);
    }
    return {
      date: parseDate(date),
      description: fields[1].trim(),
      cents: parseAmountField(fields[2], line),
    };
  });
}

function isHeader(fields) {
  return fields.length === HEADER.length
    && HEADER.every((name, i) => fields[i].trim().toLowerCase() === name);
}

// True when DD/MM/YYYY names a day that exists, so 31/02 and 29/02 of a non-leap year are refused.
// Year 0000 is not a real year, so it is refused too.
function isRealDay(text) {
  const [day, month, year] = text.split('/').map(Number);
  if (year < 1) {
    return false;
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

// Writes the rows of one upload in a single transaction. Each stored row with the same date,
// description and cents cancels at most one row of the upload. The stored rows are read inside
// the transaction, so they are the rows stored when the upload starts.
export function importRows(db, rows) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const stored = new Map();
    for (const { date, description, cents } of db.prepare('SELECT date, description, cents FROM transactions').all()) {
      const key = rowKey(date, description, cents);
      stored.set(key, (stored.get(key) ?? 0) + 1);
    }
    const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
    let added = 0;
    let skipped = 0;
    for (const { date, description, cents } of rows) {
      const key = rowKey(date, description, cents);
      const left = stored.get(key) ?? 0;
      if (left > 0) {
        stored.set(key, left - 1);
        skipped += 1;
      } else {
        insert.run(date, description, cents);
        added += 1;
      }
    }
    db.exec('COMMIT');
    return { added, skipped };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function rowKey(date, description, cents) {
  return JSON.stringify([date, description, cents]);
}
