// src/server.js
import { createApp } from './app.js';
import { openLedger } from './lib/ledger.js';
import { loadFlags } from './lib/flags.js';

const port = Number(process.env.PORT ?? 3000);
const db = openLedger(process.env.LEDGER_DB ?? 'ledger.db');
const flags = loadFlags(new URL('../config/feature-flags.json', import.meta.url));

const server = createApp({ db, flags });
server.listen(port, () => {
  console.log(`listening on ${server.address().port}`);
});
