#!/usr/bin/env node
// F3 (ticketing-foundation) — the critical negative control from spec §5.3's `door-staff`
// bundle and the mission brief's Done criteria: door-staff must NEVER resolve to
// 'export-buyer-data' or 'search-buyers' (the two POPIA-sensitive buyer-lookup/-export
// capabilities), proven by a REAL call to lib/admin-roles.ts's resolve(), not a grep of
// the source. A grep proves the string doesn't appear in a comment; it proves nothing
// about what resolve() actually returns at runtime.
//
// Positive half: door-staff DOES resolve to exactly its two intended capabilities
// (scan-checkin, lookup-booking-ref) — spec §5.3's default bundle, "recommended, not yet
// confirmed with Brad" per the spec's own note, but this is what ships today.
//
// Negative half: door-staff resolves to NONE of the other five capabilities —
// view-admin-dashboard, search-buyers, issue-comp, issue-refund, export-buyer-data — every
// one of the fixed seven not explicitly granted, not just the two named in the brief.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f3-admin-roles/check-door-staff-negative-control.mjs

import { CAPABILITIES, resolve } from '../../../lib/admin-roles.ts';

const failures = [];

const doorStaff = resolve(['door-staff']);

const expectedGranted = ['scan-checkin', 'lookup-booking-ref'];
for (const cap of expectedGranted) {
  if (!doorStaff.has(cap)) {
    failures.push(`resolve(['door-staff']) is missing expected capability '${cap}'.`);
  }
}

const expectedWithheld = CAPABILITIES.filter((cap) => !expectedGranted.includes(cap));
for (const cap of expectedWithheld) {
  if (doorStaff.has(cap)) {
    failures.push(
      `resolve(['door-staff']) unexpectedly includes '${cap}' — door-staff must never hold ` +
        'this capability (spec §5.3 negative control).'
    );
  }
}

if (doorStaff.size !== expectedGranted.length) {
  failures.push(
    `resolve(['door-staff']) has ${doorStaff.size} capabilities, expected exactly ` +
      `${expectedGranted.length} (${expectedGranted.join(', ')}).`
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: resolve(['door-staff']) is exactly {scan-checkin, lookup-booking-ref} — none of " +
    'the other five capabilities, including the two POPIA-sensitive ones, proven live.'
);
process.exit(0);
