#!/usr/bin/env node
// ticketing-show-window-lookup (A3) — buildShowWindow() fail-closed matrix: missing/malformed
// Sanity date fields must resolve to `null` (refused), never to a permissive default and never
// to a thrown exception. Pure, synchronous, offline — no network, no Date.now().
//
// DEFEATING MUTATION: any of the six negative cases below returning a non-null ShowWindow
// (e.g. falling back to `new Date()` for a missing/malformed field, or trusting a malformed
// string without validating it parses), OR the one positive control (case 6) wrongly
// returning null — without a positive control, an implementation that unconditionally
// returns `null` would pass every negative case here trivially.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-show-window-lookup/check-build-window-fail-closed.mjs

import { buildShowWindow } from '../../../lib/show-window-lookup.ts';

const failures = [];

function expectNull(label, fields) {
  const result = buildShowWindow(fields);
  if (result !== null) {
    failures.push(`${label}: expected null, got ${JSON.stringify(result)}.`);
  }
}

// Case 1: no fields object at all (show doc not found upstream).
expectNull('missing fields object (null)', null);
expectNull('missing fields object (undefined)', undefined);

// Case 2: startDate absent (Sanity field never set on this document).
expectNull('startDate absent', { endDate: '2027-01-20T18:00:00Z' });

// Case 3: endDate absent.
expectNull('endDate absent', { startDate: '2027-01-15T08:00:00Z' });

// Case 4: startDate present but not a parseable date at all.
expectNull('startDate garbage string', {
  startDate: 'not-a-date',
  endDate: '2027-01-20T18:00:00Z',
});

// Case 5: endDate present but empty string.
expectNull('endDate empty string', {
  startDate: '2027-01-15T08:00:00Z',
  endDate: '',
});

// Case 5b: a field of the wrong type entirely (Sanity content the schema no longer matches,
// e.g. hand-edited to a number).
expectNull('startDate wrong type (number)', {
  startDate: 1234567890,
  endDate: '2027-01-20T18:00:00Z',
});

// Case 6 (positive control): both fields valid ISO 8601 UTC datetimes — a real window is
// returned, with the exact instants preserved.
const positive = buildShowWindow({
  startDate: '2027-01-15T08:00:00Z',
  endDate: '2027-01-20T18:00:00Z',
});
if (positive === null) {
  failures.push('positive control: valid startDate/endDate resolved to null, expected a real window.');
} else {
  if (positive.startDate.getTime() !== Date.UTC(2027, 0, 15, 8, 0, 0)) {
    failures.push(
      `positive control: startDate instant was ${positive.startDate.toISOString()}, expected 2027-01-15T08:00:00.000Z.`,
    );
  }
  if (positive.endDate.getTime() !== Date.UTC(2027, 0, 20, 18, 0, 0)) {
    failures.push(
      `positive control: endDate instant was ${positive.endDate.toISOString()}, expected 2027-01-20T18:00:00.000Z.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: buildShowWindow() fails closed (null) on a missing show, missing/malformed/wrongly-typed ' +
    'date fields, and correctly builds a real window from valid ISO 8601 UTC dates.',
);
process.exit(0);
