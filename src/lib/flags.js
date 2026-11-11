// src/lib/flags.js

import { existsSync, readFileSync } from 'node:fs';

// Reads the feature switches file. A missing file gives no switches, so every switch is off.
export function loadFlags(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

// True only when the named switch is set to the boolean true.
export function isOn(flags, name) {
  return flags[name] === true;
}
