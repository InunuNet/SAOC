#!/usr/bin/env node
// F9 (ticketing-foundation) — design intent: "prevent accidental presentation as real pricing
// to visitors" (mission brief). This is NOT automatic from the `demo` marker merely existing
// — as of the audit that produced this contract, app/(marketing)/tickets/page.tsx's
// activeTicketTypesQuery selects every `active == true` ticketType with no show-scoping and
// no demo exclusion at all (verified directly in sanity/queries.ts and that page's render
// loop). See golden README "A real, pre-existing gap this contract closes". Proves two things
// together, because either alone is insufficient: (a) the query the public page actually uses
// SELECTS the `demo` field (so a real Sanity response carries the information the filter
// needs), and (b) the pure filter function genuinely removes demo-marked entries and nothing
// else.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f9-demo-ticket/check-public-listing-excludes-demo.mjs

import { activeTicketTypesQuery } from '../../../sanity/queries.ts';
import { filterPubliclyListableTicketTypes, DEMO_TICKET_TYPE_SLUG } from '../../../lib/demo-ticket-type.ts';

const failures = [];

// (a) The query the public /tickets page actually runs must select `demo` — a filter function
// that is correct in isolation is worthless if the page never receives the field it depends
// on. Defeating mutation: adding filterPubliclyListableTicketTypes() to page.tsx without
// adding `demo,` to the query projection — this would still pass every OTHER check in this
// contract (they all construct fixtures by hand) but fail here, the one check that inspects
// the query the real page actually sends.
if (typeof activeTicketTypesQuery !== 'string' || !activeTicketTypesQuery.includes('demo')) {
  failures.push(
    '(a) activeTicketTypesQuery does not appear to select a `demo` field — the public /tickets ' +
      'page would receive `demo: undefined` for every document regardless of the real value, ' +
      'and filterPubliclyListableTicketTypes() would never actually exclude anything in ' +
      'production.',
  );
}

// (b) The filter function itself, against a fixture shaped exactly like what
// activeTicketTypesQuery (once fixed) returns: two real ticket types (one explicitly
// demo:false, one with the field entirely absent — the pre-F9 legacy shape) and one demo type.
const fixture = [
  { _id: 'ticketType-adult', name: 'Adult', slug: 'adult', price: 250, demo: false },
  { _id: 'ticketType-child', name: 'Child', slug: 'child', price: 100 },
  { _id: 'ticketType-demo', name: 'General Admission (Demo)', slug: DEMO_TICKET_TYPE_SLUG, price: 10, demo: true },
];

const filtered = filterPubliclyListableTicketTypes(fixture);

if (filtered.length !== 2) {
  failures.push(
    `(b1) expected 2 publicly-listable ticket types after filtering, got ${filtered.length}: ${JSON.stringify(filtered.map((t) => t.slug))}.`,
  );
}
if (filtered.some((t) => t.slug === DEMO_TICKET_TYPE_SLUG)) {
  failures.push('(b2) the demo ticket type survived filtering — it would render on the live public /tickets page.');
}
if (!filtered.some((t) => t.slug === 'adult') || !filtered.some((t) => t.slug === 'child')) {
  failures.push('(b3) a REAL ticket type was incorrectly removed — filterPubliclyListableTicketTypes() must not be vacuously filtering everything.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: the public /tickets page's own query selects `demo`, and " +
    'filterPubliclyListableTicketTypes() removes exactly the demo-marked entry from a mixed ' +
    'fixture, leaving both real entries intact.',
);
process.exit(0);
