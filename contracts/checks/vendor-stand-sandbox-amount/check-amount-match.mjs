#!/usr/bin/env node
// lib/vendor-stand-order-amount.ts vendorStandOrderAmountMatches() against the golden matrix, and
// PARITY with the ticket path's notificationAmountMatches() (lib/tickets-notification.ts, the
// reference the stand path must mirror): both must agree on every case. Pure: no Firestore,
// network or live data.
//
// Run as: npx tsx contracts/checks/vendor-stand-sandbox-amount/check-amount-match.mjs

import { readFileSync } from 'node:fs';

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

let mod;
try {
  mod = await import('../../../lib/vendor-stand-order-amount.ts');
} catch (error) {
  console.error(`FAIL: lib/vendor-stand-order-amount.ts is missing or does not load: ${error.message}`);
  process.exit(1);
}
const { notificationAmountMatches } = await import('../../../lib/tickets-notification.ts');
const matrix = JSON.parse(readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f5/amount-match-matrix.json', import.meta.url), 'utf8'));
const fix = (order) => Object.fromEntries(Object.entries(order).map(([k, v]) => [k, v === 'NaN-sentinel' ? Number.NaN : v]));

for (const c of matrix.cases) {
  const order = fix(c.order);
  const got = mod.vendorStandOrderAmountMatches(order, c.gross);
  expect(got === c.expect, `${c.id}: vendorStandOrderAmountMatches(${JSON.stringify(c.order)}, ${c.gross}) = ${got}, expected ${c.expect}.`);
  const ticket = notificationAmountMatches(order, c.gross);
  expect(got === ticket, `${c.id}: stand helper (${got}) must agree with the ticket path's notificationAmountMatches (${ticket}).`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: ${matrix.cases.length} cases match the golden and agree with the ticket path's guard.`);
