#!/usr/bin/env node
// ticketing-show-window-lookup (A7) — timezone posture, stated explicitly and gated.
//
// POSTURE: this project's server runs in SAST (UTC+2) while Sanity `datetime` fields and
// Firestore/Cloud Logging timestamps are UTC (see learned.md's prior published-correction
// incident from exactly this confusion). parseUtcDatetime() therefore REQUIRES an explicit
// UTC offset designator (`Z` or `±HH:MM`) on every date string it accepts, and REJECTS
// (returns null — fail closed, same as an unparseable string) anything without one, rather
// than trusting JavaScript's own `new Date(bareString)` behaviour, which parses an
// offset-less datetime-with-time string in the process's LOCAL timezone (SAST here) per the
// ECMA-262 Date Time String Format spec. Silently accepting a bare string would shift a real
// show-window boundary by exactly 2 hours in whichever direction depends on which side of the
// comparison it lands on — admitting or refusing a capability for a genuine 2-hour window
// around the true boundary, with no error and no log line pointing at why.
//
// This check runs with TZ=Africa/Johannesburg explicitly set (see the contract's command),
// deterministically reproducing this project's real server timezone regardless of what
// timezone the CI/gate machine itself happens to be in.
//
// DEFEATING MUTATION: parseUtcDatetime() accepting a bare, offset-less datetime string (e.g.
// via an unconditional `new Date(value)` with no offset validation) instead of rejecting it —
// this is the exact implementation shape that would silently misparse in local time under
// TZ=Africa/Johannesburg. Also defeated by an implementation that, given an EXPLICIT offset
// (`Z` or `+02:00`), still shifts the resulting instant by the process's local timezone on top
// of the given offset.
//
// Run as: TZ=Africa/Johannesburg node --import tsx/esm contracts/checks/ticketing-show-window-lookup/check-utc-parsing.mjs

if (process.env.TZ !== 'Africa/Johannesburg') {
  console.error(
    `FAIL: this check must run with TZ=Africa/Johannesburg (got ${JSON.stringify(process.env.TZ)}) — ` +
      'see the contract command. Running under the wrong TZ cannot reproduce the defect this check exists to catch.',
  );
  process.exit(1);
}

import { parseUtcDatetime } from '../../../lib/show-window-lookup.ts';

const failures = [];

// Explicit Z suffix — must parse to exactly this UTC instant, unaffected by the local TZ.
const zResult = parseUtcDatetime('2027-01-15T08:00:00Z');
if (zResult === null || zResult.getTime() !== Date.UTC(2027, 0, 15, 8, 0, 0)) {
  failures.push(
    `'2027-01-15T08:00:00Z': expected instant Date.UTC(2027,0,15,8,0,0), got ${zResult ? zResult.toISOString() : 'null'}.`,
  );
}

// Explicit +02:00 offset (SAST) — 10:00 SAST is 08:00 UTC. Proves offset-aware parsing works
// generally, not only for the Z-suffix special case.
const offsetResult = parseUtcDatetime('2027-01-15T10:00:00+02:00');
if (offsetResult === null || offsetResult.getTime() !== Date.UTC(2027, 0, 15, 8, 0, 0)) {
  failures.push(
    `'2027-01-15T10:00:00+02:00': expected the SAME instant as the Z case (Date.UTC(2027,0,15,8,0,0)), ` +
      `got ${offsetResult ? offsetResult.toISOString() : 'null'}.`,
  );
}

// THE defeating case: no timezone designator at all. Under TZ=Africa/Johannesburg, a naive
// `new Date(...)` on this string would silently produce 2027-01-15T06:00:00Z (08:00 SAST) —
// two hours off the UTC instant a reviewer reading "08:00:00" would expect. Must be refused.
const bareResult = parseUtcDatetime('2027-01-15T08:00:00');
if (bareResult !== null) {
  failures.push(
    `'2027-01-15T08:00:00' (no timezone designator): expected null (rejected), got ${bareResult.toISOString()} ` +
      '— an offset-less datetime string must never be silently parsed in the local process timezone.',
  );
}

// Date-only string (no time component at all) — also must be rejected. Not the primary
// defect this check targets (a date-only ISO string IS spec-defined as UTC midnight, so it
// would not actually exhibit the 2-hour shift), but a `show.startDate`/`endDate` field is a
// Sanity `datetime` field and should never legitimately arrive without a time component;
// accepting it silently would admit a malformed document instead of failing closed.
const dateOnlyResult = parseUtcDatetime('2027-01-15');
if (dateOnlyResult !== null) {
  failures.push(
    `'2027-01-15' (date only, no time/offset): expected null (rejected), got ${dateOnlyResult.toISOString()}.`,
  );
}

// Garbage string — must be rejected, not thrown.
let threw = false;
let garbageResult = null;
try {
  garbageResult = parseUtcDatetime('not-a-date-at-all');
} catch {
  threw = true;
}
if (threw) {
  failures.push("'not-a-date-at-all': parseUtcDatetime() threw instead of returning null.");
} else if (garbageResult !== null) {
  failures.push(`'not-a-date-at-all': expected null, got ${garbageResult}.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: parseUtcDatetime() correctly parses explicit Z/offset datetimes to the true UTC ' +
    'instant under TZ=Africa/Johannesburg, and rejects (fails closed on) any offset-less, ' +
    'date-only, or garbage input rather than risk a silent 2-hour local-time misparse.',
);
process.exit(0);
