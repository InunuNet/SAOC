// A7 — sanity/queries.ts's ticketTypeBySlugQuery must select both requiresDaySelection and
// requiresAttendeeNames, additively (every field ticketing-f4-admission-products already proved
// present on this query must remain present — a field the schema declares but the query drops
// renders as nothing, this project's recurring false-green class, see showExhibitorInfoQuery's
// own comment in sanity/queries.ts for the same warning at the source).
//
// Imports the real query module (a `defineQuery` template-string wrapper) and inspects the
// resulting GROQ string's text — defineQuery returns the string itself (tagged-template-like),
// so this is a structural check on the actual query text sent to Sanity, not a comment/prose
// grep.
//
// Run as: npx tsx contracts/checks/ticketing-f5-day-attendees/check-query-fields.mjs

import { ticketTypeBySlugQuery } from '../../../sanity/queries.ts';

const failures = [];

const REQUIRED_FIELDS = [
  '_id',
  'name',
  'price',
  'capacity',
  'show',
  'releasedQuantity',
  'earlyBirdCutoff',
  'requiresDaySelection',
  'requiresAttendeeNames',
];

for (const field of REQUIRED_FIELDS) {
  // Word-boundary match against the projection body — good enough for a flat GROQ
  // object-projection field list, and avoids a false pass on a field name that only
  // appears as a substring of another identifier.
  const pattern = new RegExp(`[{,\\s]${field}\\s*[,}]`);
  if (!pattern.test(ticketTypeBySlugQuery)) {
    failures.push(`ticketTypeBySlugQuery does not select '${field}'.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`\nQuery text was:\n${ticketTypeBySlugQuery}`);
  process.exit(1);
}

console.log('PASS: ticketTypeBySlugQuery additively selects requiresDaySelection and requiresAttendeeNames, alongside every pre-existing field.');
