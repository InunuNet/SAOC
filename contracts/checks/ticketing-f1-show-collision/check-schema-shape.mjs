#!/usr/bin/env node
// Behavioural proof of the schema shape decision in
// contracts/golden/ticketing-f1-show-collision/README.md — imports the REAL schema
// modules and inspects the actual defineField() output, including executing each
// field's `validation` callback against a tracking mock Rule so "is this field
// required" is proved by running the developer's own validation function, not by
// grepping the source text for the string "required".
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f1-show-collision/check-schema-shape.mjs

import { show } from '../../../sanity/schemas/documents/show.ts';
import { ticketType } from '../../../sanity/schemas/documents/ticketType.ts';

const failures = [];

/** A Rule mock that records every chained method call and returns itself, so a real
 *  `(Rule) => Rule.required().min(0)` callback executes exactly as it would in Studio. */
function trackingRule() {
  const calls = [];
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        return () => {
          calls.push(prop);
          return proxy;
        };
      },
    }
  );
  return { proxy, calls };
}

function fieldNamed(fields, name) {
  return fields.find((f) => f.name === name);
}

function wasRequired(field) {
  if (typeof field?.validation !== 'function') return false;
  const { proxy, calls } = trackingRule();
  field.validation(proxy);
  return calls.includes('required');
}

// ---- show: six new fields, none required ----
const NEW_SHOW_FIELDS = [
  { name: 'edition', type: 'number' },
  { name: 'startDate', type: 'datetime' },
  { name: 'endDate', type: 'datetime' },
  { name: 'venue', type: 'showVenue' },
  { name: 'salesOpen', type: 'boolean' },
  { name: 'active', type: 'boolean' },
];

for (const expected of NEW_SHOW_FIELDS) {
  const field = fieldNamed(show.fields, expected.name);
  if (!field) {
    failures.push(`show.fields is missing '${expected.name}'`);
    continue;
  }
  if (field.type !== expected.type) {
    failures.push(
      `show.${expected.name} has type '${field.type}', expected '${expected.type}'`
    );
  }
  if (wasRequired(field)) {
    failures.push(
      `show.${expected.name} calls Rule.required() — must be optional-or-defaulted so ` +
        `no published archive document is invalidated (see README's sizing decision)`
    );
  }
}

// ---- ticketType: one new field, REQUIRED, references 'show' ----
const showRefField = fieldNamed(ticketType.fields, 'show');
if (!showRefField) {
  failures.push(`ticketType.fields is missing 'show'`);
} else {
  if (showRefField.type !== 'reference') {
    failures.push(`ticketType.show has type '${showRefField.type}', expected 'reference'`);
  }
  const toTypes = (showRefField.to ?? []).map((t) => t.type);
  if (!toTypes.includes('show')) {
    failures.push(
      `ticketType.show.to does not include { type: 'show' } (got: ${JSON.stringify(toTypes)})`
    );
  }
  if (!wasRequired(showRefField)) {
    failures.push(`ticketType.show does not call Rule.required() — the brief requires it`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: show schema carries 6 optional new fields; ticketType.show is a required reference to show.');
process.exit(0);
