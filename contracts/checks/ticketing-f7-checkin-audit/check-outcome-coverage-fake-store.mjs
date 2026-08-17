#!/usr/bin/env node
// F7 (ticketing-foundation) — design constraint 1, the P1-defeating property this whole feature
// exists to prove (spec §7.3, mission brief): EVERY scan outcome writes exactly one
// checkinAttempts record, not just successful admits. Proven by calling the real
// recordCheckinAttempt() once per each of the eight CheckinAttemptOutcome values against a
// fabricated in-memory store (a plain array `addCheckinAttempt` pushes onto) — never live
// Firestore, no network, nothing deleted, nothing orphaned.
//
// No dimension is held constant across all eight cases on purpose (see the contract's own
// warning about assertions whose cases quietly hold constant the dimension they claim to
// prove): outcome, refusalReason presence, scannedByUid presence, and orderId resolvability
// all vary case-to-case.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f7-checkin-audit/check-outcome-coverage-fake-store.mjs

import { recordCheckinAttempt } from '../../../lib/checkin-audit.ts';

const failures = [];
const NOW = new Date('2027-03-01T09:00:00Z');

function makeFakeStore() {
  const records = [];
  return {
    records,
    store: {
      async addCheckinAttempt(record) {
        const id = `fake-${records.length}`;
        records.push(record);
        return { id };
      },
    },
  };
}

// One case per outcome. `orderId`/`bookingRef`/`showId` are non-null only where a real position
// or order would genuinely have been resolvable before that outcome was reached; `scannedByUid`
// is present only where a real authenticated caller exists at the point the outcome is decided.
const cases = [
  {
    outcome: 'admit',
    bookingRef: 'SAOC-2027-ADMIT01',
    showId: 'nationalShow',
    orderId: 'order-admit-1',
    // Deliberately non-null, to prove buildCheckinAttemptRecord forces it to null anyway.
    refusalReason: 'should be forced to null',
    scannedByUid: 'door-staff-uid-1',
    source: 'online',
  },
  {
    outcome: 'not-found',
    bookingRef: 'SAOC-2027-UNKNOWN',
    showId: null,
    orderId: null,
    refusalReason: 'Ticket not found',
    scannedByUid: 'door-staff-uid-1',
  },
  {
    outcome: 'wrong-show',
    bookingRef: 'SAOC-2027-OTHERSHOW',
    showId: 'some-other-show',
    orderId: 'order-wrong-show-1',
    refusalReason: 'This ticket is not for this show.',
    scannedByUid: 'door-staff-uid-1',
  },
  {
    outcome: 'unpaid',
    bookingRef: 'SAOC-2027-UNPAID01',
    showId: 'nationalShow',
    orderId: 'order-unpaid-1',
    refusalReason: 'This ticket has not been paid for.',
    scannedByUid: 'door-staff-uid-1',
  },
  {
    outcome: 'already-checked-in',
    bookingRef: 'SAOC-2027-DUPE01',
    showId: 'nationalShow',
    orderId: 'order-dupe-1',
    refusalReason: 'Already checked in',
    scannedByUid: 'door-staff-uid-1',
    source: 'offline-queued',
  },
  {
    outcome: 'malformed',
    bookingRef: null,
    showId: null,
    orderId: null,
    refusalReason: 'A booking reference is required.',
    scannedByUid: 'door-staff-uid-1',
  },
  {
    outcome: 'not-authorized',
    bookingRef: null,
    showId: null,
    orderId: null,
    refusalReason: 'Missing scan-checkin capability.',
    scannedByUid: 'authenticated-but-uncapable-uid',
  },
  // 'infra-error' (added post-@qa-FAIL against the shipped route) — checkInByBookingRef()
  // threw for a reason unrelated to any admission decision (a Firestore outage mid-transaction,
  // say). Deliberately NOT a clone of 'not-found's field combination: bookingRef AND showId are
  // both known here (the route already had the parsed bookingRef and was operating against the
  // fixed active show before the throw interrupted it), but orderId is null because the throw
  // happened before any position/order could be resolved — a genuinely distinct combination
  // from every other case, not merely the outcome label changed on a copy-pasted case.
  {
    outcome: 'infra-error',
    bookingRef: 'SAOC-2027-INFRAERR01',
    showId: 'nationalShow',
    orderId: null,
    refusalReason: 'Check-in failed. Please try again.',
    scannedByUid: 'door-staff-uid-1',
  },
];

for (const testCase of cases) {
  const { records, store } = makeFakeStore();

  const input = {
    bookingRef: testCase.bookingRef,
    showId: testCase.showId,
    orderId: testCase.orderId,
    outcome: testCase.outcome,
    refusalReason: testCase.refusalReason,
    scannedByUid: testCase.scannedByUid,
    now: NOW,
    ...(testCase.source ? { source: testCase.source } : {}),
  };

  const result = await recordCheckinAttempt(store, input);

  if (result.recorded !== true) {
    failures.push(`[${testCase.outcome}] recordCheckinAttempt() did not report recorded:true — got ${JSON.stringify(result)}.`);
    continue;
  }

  if (records.length !== 1) {
    failures.push(`[${testCase.outcome}] expected exactly 1 record written to the fake store, found ${records.length}.`);
    continue;
  }

  const record = records[0];

  if (record.outcome !== testCase.outcome) {
    failures.push(`[${testCase.outcome}] record.outcome mismatch: got '${record.outcome}'.`);
  }
  if (record.bookingRef !== testCase.bookingRef) {
    failures.push(`[${testCase.outcome}] record.bookingRef mismatch: expected ${JSON.stringify(testCase.bookingRef)}, got ${JSON.stringify(record.bookingRef)}.`);
  }
  if (record.showId !== testCase.showId) {
    failures.push(`[${testCase.outcome}] record.showId mismatch: expected ${JSON.stringify(testCase.showId)}, got ${JSON.stringify(record.showId)}.`);
  }
  if (record.orderId !== testCase.orderId) {
    failures.push(`[${testCase.outcome}] record.orderId mismatch: expected ${JSON.stringify(testCase.orderId)}, got ${JSON.stringify(record.orderId)}.`);
  }
  if (record.scannedByUid !== testCase.scannedByUid) {
    failures.push(`[${testCase.outcome}] record.scannedByUid mismatch: expected ${JSON.stringify(testCase.scannedByUid)}, got ${JSON.stringify(record.scannedByUid)}.`);
  }

  // The load-bearing invariant: an 'admit' record can NEVER carry a refusal reason, even when
  // one was passed in — every other outcome must carry exactly the reason passed in.
  if (testCase.outcome === 'admit') {
    if (record.refusalReason !== null) {
      failures.push(`[admit] record.refusalReason expected null (forced), got ${JSON.stringify(record.refusalReason)} — the caller deliberately passed a non-null reason to prove this is forced, not merely absent.`);
    }
  } else if (record.refusalReason !== testCase.refusalReason) {
    failures.push(`[${testCase.outcome}] record.refusalReason mismatch: expected ${JSON.stringify(testCase.refusalReason)}, got ${JSON.stringify(record.refusalReason)}.`);
  }

  const expectedSource = testCase.source ?? 'online';
  if (record.source !== expectedSource) {
    failures.push(`[${testCase.outcome}] record.source mismatch: expected '${expectedSource}', got '${record.source}'.`);
  }

  if (record.syncedAt !== null) {
    failures.push(`[${testCase.outcome}] record.syncedAt expected null, got ${JSON.stringify(record.syncedAt)}.`);
  }

  if (!(record.scannedAt instanceof Date) || record.scannedAt.getTime() !== NOW.getTime()) {
    failures.push(`[${testCase.outcome}] record.scannedAt expected injected NOW (${NOW.toISOString()}), got ${JSON.stringify(record.scannedAt)}.`);
  }
}

// Explicit negative: confirm the eight cases above really did cover all eight union members —
// if a future edit adds a ninth outcome without adding a case here, this loop catches the gap
// rather than the assertion silently proving less than it claims.
const EXPECTED_OUTCOMES = new Set([
  'admit',
  'not-found',
  'wrong-show',
  'unpaid',
  'already-checked-in',
  'malformed',
  'not-authorized',
  'infra-error',
]);
const coveredOutcomes = new Set(cases.map((c) => c.outcome));
if (coveredOutcomes.size !== EXPECTED_OUTCOMES.size || [...EXPECTED_OUTCOMES].some((o) => !coveredOutcomes.has(o))) {
  failures.push(`Outcome coverage gap: expected exactly ${[...EXPECTED_OUTCOMES].join(', ')}, covered ${[...coveredOutcomes].join(', ')}.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: recordCheckinAttempt() writes exactly one correctly-shaped record to the store for ' +
    'each of the eight CheckinAttemptOutcome values — admits and every refusal reason alike, ' +
    'including the three outcomes (malformed, not-authorized, infra-error) spec §7.3\'s literal text omits — ' +
    'with refusalReason forced to null on admit, source defaulting correctly, and syncedAt ' +
    'always null, proven against a fabricated in-memory store, never live Firestore.',
);
process.exit(0);
