// src/lib/month.js

const MONTH_SHAPE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Returns the text as a YYYY-MM month, or null when it is not one.
export function parseMonth(text) {
  return typeof text === 'string' && MONTH_SHAPE.test(text) ? text : null;
}

// Moves a YYYY-MM month by delta months, across year boundaries.
export function shiftMonth(ym, delta) {
  const [year, month] = ym.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  const shiftedYear = Math.floor(index / 12);
  const shiftedMonth = (index % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, '0')}`;
}
