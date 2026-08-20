// A7 — sanity/schemas/documents/ticketType.ts must define the five new fields this contract
// requires, with the right type and default, additively (every pre-existing field must remain).
// Runtime-imports the real schema module (a plain `defineType({...})` config object — pure, no
// Sanity client, no network) and inspects its `fields` array, rather than grepping the source
// text, so a field defined with different formatting/ordering still passes and a field that's
// merely mentioned in a comment does not.
//
// This check imports a module whose EXPORT currently lacks these fields — expected to fail
// (missing-field assertions) until @dev adds them to sanity/schemas/documents/ticketType.ts per
// this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f4-admission-products/check-schema-fields.mjs

import { ticketType } from '../../../sanity/schemas/documents/ticketType.ts';

const failures = [];

function fieldByName(name) {
  return (ticketType.fields ?? []).find((f) => f.name === name);
}

// (1) Every PRE-EXISTING field must still be present — additive only, nothing repurposed.
for (const name of ['name', 'slug', 'price', 'description', 'capacity', 'active', 'order', 'show', 'demo']) {
  if (!fieldByName(name)) {
    failures.push(`(1) pre-existing field '${name}' is missing — this feature must be additive only.`);
  }
}

// (2) provisional: boolean, defaults to true (machine-readable, not prose-only).
{
  const f = fieldByName('provisional');
  if (!f) {
    failures.push("(2) 'provisional' field is missing.");
  } else {
    if (f.type !== 'boolean') failures.push(`(2) 'provisional' type must be 'boolean', got '${f.type}'`);
    if (f.initialValue !== true) {
      failures.push(`(2) 'provisional' initialValue must be true, got ${JSON.stringify(f.initialValue)}`);
    }
  }
}

// (3) earlyBirdCutoff: datetime, optional (no initialValue forced).
{
  const f = fieldByName('earlyBirdCutoff');
  if (!f) {
    failures.push("(3) 'earlyBirdCutoff' field is missing.");
  } else if (f.type !== 'datetime' && f.type !== 'date') {
    failures.push(`(3) 'earlyBirdCutoff' type must be 'datetime' or 'date', got '${f.type}'`);
  }
}

// (4) releasedQuantity: number, optional.
{
  const f = fieldByName('releasedQuantity');
  if (!f) {
    failures.push("(4) 'releasedQuantity' field is missing.");
  } else if (f.type !== 'number') {
    failures.push(`(4) 'releasedQuantity' type must be 'number', got '${f.type}'`);
  }
}

// (5) requiresDaySelection: boolean, defaults false.
{
  const f = fieldByName('requiresDaySelection');
  if (!f) {
    failures.push("(5) 'requiresDaySelection' field is missing.");
  } else {
    if (f.type !== 'boolean') failures.push(`(5) 'requiresDaySelection' type must be 'boolean', got '${f.type}'`);
    if (f.initialValue !== false) {
      failures.push(`(5) 'requiresDaySelection' initialValue must be false, got ${JSON.stringify(f.initialValue)}`);
    }
  }
}

// (6) requiresAttendeeNames: boolean, defaults false.
{
  const f = fieldByName('requiresAttendeeNames');
  if (!f) {
    failures.push("(6) 'requiresAttendeeNames' field is missing.");
  } else {
    if (f.type !== 'boolean') failures.push(`(6) 'requiresAttendeeNames' type must be 'boolean', got '${f.type}'`);
    if (f.initialValue !== false) {
      failures.push(`(6) 'requiresAttendeeNames' initialValue must be false, got ${JSON.stringify(f.initialValue)}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: ticketType schema defines all five new fields additively, with correct types/defaults.');
