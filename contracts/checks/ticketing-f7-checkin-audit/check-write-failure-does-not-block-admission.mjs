#!/usr/bin/env node
// F7 (ticketing-foundation) — design constraint 4, the architect brief's explicit steer: "a
// scan whose audit write fails should still admit the ticket-holder ... but must surface the
// failure loudly rather than swallowing it." Two halves proven here against the REAL
// recordCheckinAttempt() and logAuditWriteFailure():
//   (a) a store whose addCheckinAttempt() always rejects never causes recordCheckinAttempt()
//       to throw or produce an unhandled rejection — it resolves normally to
//       {recorded: false, error}, for both an 'admit' case and a refusal case;
//   (b) logAuditWriteFailure() logs via console.error exactly once, with structured context,
//       never via console.log/console.warn, and never throws, and its return value is void.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f7-checkin-audit/check-write-failure-does-not-block-admission.mjs

import { logAuditWriteFailure, recordCheckinAttempt } from '../../../lib/checkin-audit.ts';

const failures = [];
const NOW = new Date('2027-03-01T09:00:00Z');

function makeFailingStore() {
  return {
    async addCheckinAttempt() {
      throw new Error('simulated Firestore outage');
    },
  };
}

const admitInput = {
  bookingRef: 'SAOC-2027-ABC123',
  showId: 'nationalShow',
  orderId: 'order-1',
  outcome: 'admit',
  refusalReason: null,
  scannedByUid: 'door-staff-uid-1',
  now: NOW,
};

const refusalInput = {
  bookingRef: 'SAOC-2027-WRONGSHOW01',
  showId: 'some-other-show',
  orderId: 'order-2',
  outcome: 'wrong-show',
  refusalReason: 'This ticket is not for this show.',
  scannedByUid: 'door-staff-uid-1',
  now: NOW,
};

// (a) Deliberately NOT wrapped in try/catch here — the whole point is that
// recordCheckinAttempt() itself must never let the store's rejection propagate. If it does,
// this script crashes with an unhandled rejection rather than reaching the assertions below,
// which is itself the failure signal for this half of the check.
for (const [label, input] of [
  ['admit', admitInput],
  ['refusal', refusalInput],
]) {
  const result = await recordCheckinAttempt(makeFailingStore(), input);

  if (result.recorded !== false) {
    failures.push(`(a)[${label}] expected {recorded:false}, got ${JSON.stringify(result)} — a failing store should never be reported as a successful write.`);
  }
  if (!('error' in result) || result.error === undefined) {
    failures.push(`(a)[${label}] expected a captured 'error' field on the failure result, found none.`);
  }
}

// (b) logAuditWriteFailure() logs loudly (console.error only) and never throws.
{
  const calls = { error: [], warn: [], log: [] };
  const originals = { error: console.error, warn: console.warn, log: console.log };
  console.error = (...args) => calls.error.push(args);
  console.warn = (...args) => calls.warn.push(args);
  console.log = (...args) => calls.log.push(args);

  let threw = false;
  let returnValue;
  try {
    returnValue = logAuditWriteFailure({
      bookingRef: 'SAOC-2027-ABC123',
      showId: 'nationalShow',
      outcome: 'admit',
      error: new Error('simulated Firestore outage'),
    });
  } catch {
    threw = true;
  } finally {
    console.error = originals.error;
    console.warn = originals.warn;
    console.log = originals.log;
  }

  if (threw) {
    failures.push('(b) logAuditWriteFailure() threw — it must never throw, since it runs on an already-failing path.');
  }
  if (returnValue !== undefined) {
    failures.push(`(b) logAuditWriteFailure() returned ${JSON.stringify(returnValue)}, expected void/undefined — nothing about its return value may be mistaken for an admission decision.`);
  }
  if (calls.error.length !== 1) {
    failures.push(`(b) expected console.error to be called exactly once, was called ${calls.error.length} time(s).`);
  } else {
    const serialized = JSON.stringify(calls.error[0]);
    for (const expectedFragment of ['SAOC-2027-ABC123', 'nationalShow', 'admit']) {
      if (!serialized.includes(expectedFragment)) {
        failures.push(`(b) console.error payload missing expected context '${expectedFragment}': ${serialized}`);
      }
    }
  }
  if (calls.warn.length !== 0) {
    failures.push(`(b) expected console.warn never called, was called ${calls.warn.length} time(s) — this is an ERROR-level failure, not a WARNING.`);
  }
  if (calls.log.length !== 0) {
    failures.push(`(b) expected console.log never called, was called ${calls.log.length} time(s) — structured logging must use the ERROR-level channel, not console.log.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: recordCheckinAttempt() resolves normally to {recorded:false, error} — never throws, ' +
    'never an unhandled rejection — when the store rejects, for both an admit and a refusal ' +
    'case; logAuditWriteFailure() logs exactly once via console.error with the bookingRef/' +
    'showId/outcome context, never via console.warn/console.log, never throws, and returns void.',
);
process.exit(0);
