#!/usr/bin/env node
// F7 (ticketing-foundation) — design constraint 3: the audit trail is append-only in intent,
// not just in the interface's declared TypeScript shape (A2 proves that half at compile time).
// This proves the ACTUAL CALL SITE never touches anything but `addCheckinAttempt` at runtime —
// a Proxy-wrapped store throws synchronously the instant recordCheckinAttempt() reads or calls
// any other property on it, including property names a mutation might plausibly add (`update`,
// `set`, `delete`, `doc`, `collection`).
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f7-checkin-audit/check-append-only-usage.mjs

import { recordCheckinAttempt } from '../../../lib/checkin-audit.ts';

const failures = [];
const NOW = new Date('2027-03-01T09:00:00Z');

function makeTrapStore() {
  const calls = [];
  const real = {
    async addCheckinAttempt(record) {
      calls.push(record);
      return { id: 'trap-store-id-1' };
    },
  };

  const store = new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'addCheckinAttempt') {
        return Reflect.get(target, prop, receiver);
      }
      // Property lookups that are an intrinsic part of every JS object (used by things like
      // console.log/util.inspect, Promise resolution machinery, or JSON.stringify) must not be
      // mistaken for a real "the code under test read this" access.
      if (
        prop === 'then' ||
        prop === 'constructor' ||
        prop === Symbol.toPrimitive ||
        prop === Symbol.toStringTag ||
        prop === Symbol.iterator ||
        prop === 'toJSON' ||
        prop === 'inspect'
      ) {
        return undefined;
      }
      throw new Error(
        `Append-only violation: recordCheckinAttempt() accessed store property '${String(prop)}' — only 'addCheckinAttempt' may ever be touched.`,
      );
    },
  });

  return { calls, store };
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
  bookingRef: 'SAOC-2027-UNPAID01',
  showId: 'nationalShow',
  orderId: 'order-2',
  outcome: 'unpaid',
  refusalReason: 'This ticket has not been paid for.',
  scannedByUid: 'door-staff-uid-1',
  now: NOW,
};

for (const [label, input] of [
  ['admit', admitInput],
  ['refusal', refusalInput],
]) {
  const { calls, store } = makeTrapStore();
  try {
    const result = await recordCheckinAttempt(store, input);
    if (result.recorded !== true) {
      failures.push(`[${label}] expected recorded:true, got ${JSON.stringify(result)}.`);
    }
    if (calls.length !== 1) {
      failures.push(`[${label}] expected exactly 1 call to addCheckinAttempt, got ${calls.length}.`);
    }
  } catch (err) {
    failures.push(`[${label}] recordCheckinAttempt() touched a store property other than addCheckinAttempt: ${err.message}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: recordCheckinAttempt() touches nothing but addCheckinAttempt() on the store it is ' +
    'given, for both an admit and a refusal — proven with a Proxy that throws on any other ' +
    'property access, not merely by the interface\'s declared (and separately, ' +
    'compile-time-proven-closed) TypeScript shape.',
);
process.exit(0);
