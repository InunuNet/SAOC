#!/usr/bin/env node
// F8 (ticketing-foundation) — comp attribution (mission brief: "which staff uid issued it, and
// when") and injected time — mirrors F4's ShowWindowLookup, F5's builders, F6's mint/verify: no
// Date.now()/`new Date()` inside a pure construction module. Proven against the real
// buildCompOrderInput().
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f8-comp-tickets/check-attribution-injected-time.mjs

import { buildCompOrderInput } from '../../../lib/comp-tickets.ts';

const failures = [];

const baseInput = {
  showId: 'nationalShow',
  attendeeName: 'Test Attendee',
  attendeeEmail: 'attendee@example.com',
  ticketType: 'general-admission',
  issuedByEmail: 'door-manager@example.com',
  bookingRef: 'SAOC-2027-COMPATTR01',
};

// (1) compedBy records the issuing staff member's email on the position, verbatim.
{
  const built = buildCompOrderInput({ ...baseInput, now: new Date('2027-02-10T09:00:00Z') });
  if (built.compedBy !== 'door-manager@example.com') {
    failures.push(`(1) compedBy was '${built.compedBy}', expected 'door-manager@example.com'.`);
  }
}

// (2) A different issuer produces a different compedBy — not a constant/placeholder value.
{
  const built = buildCompOrderInput({
    ...baseInput,
    bookingRef: 'SAOC-2027-COMPATTR02',
    issuedByEmail: 'another-manager@example.com',
    now: new Date('2027-02-10T09:00:00Z'),
  });
  if (built.compedBy !== 'another-manager@example.com') {
    failures.push(`(2) compedBy was '${built.compedBy}', expected 'another-manager@example.com'.`);
  }
}

// (3) purchasedAt is exactly the injected `now`, not wall-clock time — two calls, several
// milliseconds apart in real wall-clock terms, given the IDENTICAL explicit `now`, must produce
// IDENTICAL purchasedAt values. A mutation that reads Date.now()/`new Date()` internally instead
// of using the supplied `now` would make these two calls disagree, because real wall-clock time
// has moved on between them even though the argument did not.
{
  const fixedNow = new Date('2027-06-01T12:00:00.000Z');
  const first = buildCompOrderInput({ ...baseInput, bookingRef: 'SAOC-2027-COMPATTR03', now: fixedNow });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = buildCompOrderInput({ ...baseInput, bookingRef: 'SAOC-2027-COMPATTR04', now: fixedNow });

  const firstMs = first.purchasedAt?.toMillis?.() ?? null;
  const secondMs = second.purchasedAt?.toMillis?.() ?? null;

  if (firstMs === null || secondMs === null) {
    failures.push('(3) purchasedAt was not a Firestore Timestamp with toMillis() on one or both calls.');
  } else {
    if (firstMs !== fixedNow.getTime()) {
      failures.push(`(3) purchasedAt.toMillis() was ${firstMs}, expected exactly ${fixedNow.getTime()} (the injected 'now').`);
    }
    if (firstMs !== secondMs) {
      failures.push(
        `(3) Two calls with the IDENTICAL explicit 'now' produced different purchasedAt values (${firstMs} vs ${secondMs}) — ` +
          "the function is reading wall-clock time internally instead of using the supplied 'now'.",
      );
    }
  }
}

// (4) A different `now` produces a correspondingly different purchasedAt — proving (3)'s
// equality isn't because the function ignores `now` entirely and always returns some constant.
{
  const nowA = new Date('2027-01-01T00:00:00.000Z');
  const nowB = new Date('2027-12-31T23:59:59.000Z');
  const builtA = buildCompOrderInput({ ...baseInput, bookingRef: 'SAOC-2027-COMPATTR05', now: nowA });
  const builtB = buildCompOrderInput({ ...baseInput, bookingRef: 'SAOC-2027-COMPATTR06', now: nowB });

  if (builtA.purchasedAt?.toMillis?.() === builtB.purchasedAt?.toMillis?.()) {
    failures.push('(4) Two calls with genuinely different `now` values produced the same purchasedAt — expected them to differ.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: buildCompOrderInput() records the issuing staff member's email verbatim as compedBy, " +
    "and derives purchasedAt exclusively from the caller-supplied 'now' — proven by two calls " +
    "with an identical explicit 'now' several milliseconds apart in wall-clock time producing " +
    "IDENTICAL purchasedAt values, and two calls with different 'now' values producing " +
    'different ones — never Date.now() internally.',
);
process.exit(0);
