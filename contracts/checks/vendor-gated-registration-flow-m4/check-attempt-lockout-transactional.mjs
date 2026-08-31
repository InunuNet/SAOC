#!/usr/bin/env node
// vendor-gated-registration-flow M4/F22 — real, executed proof that
// recordFailedVendorRegistrationCodeAttempt() (lib/vendor-registration-code.ts) locks a
// VendorApplication after exactly VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD (5) failed code
// attempts, and that the increment is ATOMIC under concurrency -- two simultaneous failed
// guesses against an application already at count 4 must not both land as "not locked" (a lost
// update here would let concurrent guessing evade the lock indefinitely, defeating the whole
// point of a per-application counter). Mirrors
// contracts/checks/vendor-gated-registration-flow/check-single-use-claim-is-atomic.mjs's exact
// optimistic-concurrency fake and its CONTROL/FIX structure -- the same technique this
// project's harness already trusts for exactly this class of defect (see this mission's A17
// history in the dispatch brief: a race the gate missed once before).
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m4/check-attempt-lockout-transactional.mjs

import {
  recordFailedVendorRegistrationCodeAttempt,
  VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD,
} from '../../../lib/vendor-registration-code.ts';

const failures = [];
const T0 = new Date('2027-02-01T00:00:00Z');

if (VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD !== 5) {
  failures.push(`VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD is ${VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD}, expected 5 (see the M4 golden README's threshold reasoning).`);
}

/** Minimal Firestore-like store with per-document versions -- same shape as the F1 claim check. */
function createStore(initialData) {
  return { data: { ...initialData }, version: 0, exists: true };
}

function createDb(store, { beforeCommit } = {}) {
  return {
    async runTransaction(fn) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const readVersions = new Map();
        const buffered = [];
        const transaction = {
          async get(ref) {
            readVersions.set(ref, store.version);
            return { exists: store.exists, data: () => ({ ...store.data }) };
          },
          update(ref, patch) {
            buffered.push([ref, patch]);
          },
        };

        const result = await fn(transaction);
        if (beforeCommit) await beforeCommit(attempt);

        const stale = [...readVersions.entries()].some(([, v]) => v !== store.version);
        if (stale) continue;

        for (const [, patch] of buffered) {
          store.data = { ...store.data, ...patch };
          store.version += 1;
        }
        return result;
      }
      throw new Error('transaction exceeded retry budget');
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Sequential attempts 1-4 do not lock; attempt 5 locks and records registrationCodeLockedAt.
// ---------------------------------------------------------------------------------------------
{
  const store = createStore({ status: 'approved', registrationCodeFailedAttempts: 0 });
  const db = createDb(store);
  const ref = { update: async () => {} };

  for (let i = 1; i <= 4; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await recordFailedVendorRegistrationCodeAttempt(db, ref, { attemptedAt: T0 });
    if (result.locked) {
      failures.push(`Attempt ${i} locked the application; expected lock only at attempt ${VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD}.`);
    }
    if (store.data.registrationCodeFailedAttempts !== i) {
      failures.push(`After attempt ${i}, registrationCodeFailedAttempts was ${store.data.registrationCodeFailedAttempts}, expected ${i}.`);
    }
  }

  const fifth = await recordFailedVendorRegistrationCodeAttempt(db, ref, { attemptedAt: T0 });
  if (!fifth.locked) {
    failures.push(`Attempt 5 did not lock the application; expected locked:true at threshold ${VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD}.`);
  }
  if (!store.data.registrationCodeLockedAt) {
    failures.push('After the 5th failed attempt, registrationCodeLockedAt was not written.');
  }
}

// ---------------------------------------------------------------------------------------------
// CONTROL: an old read-check-then-later-write shape against the same fake must lose an update
// (both callers read count=4, both compute 5, one write clobbers the other) -- proves the fake
// can express the defect this feature must avoid.
// ---------------------------------------------------------------------------------------------
{
  const store = createStore({ status: 'approved', registrationCodeFailedAttempts: 4 });
  const oldShapeIncrement = async () => {
    const current = store.data.registrationCodeFailedAttempts; // read outside any transaction
    await Promise.resolve();
    const next = current + 1;
    store.data = { ...store.data, registrationCodeFailedAttempts: next };
    store.version += 1;
    return next;
  };
  await Promise.all([oldShapeIncrement(), oldShapeIncrement()]);
  if (store.data.registrationCodeFailedAttempts === 6) {
    failures.push('CONTROL: the pre-fix read-then-write shape was expected to LOSE an update under concurrency (ending at 5, not 6), but both increments landed. The harness is serialising callers and proves nothing.');
  }
}

// ---------------------------------------------------------------------------------------------
// FIX: two concurrent failed attempts against an application already at count 4, forced to both
// READ before either COMMITS. The final count must be exactly 6 (both increments preserved, no
// lost update) and the application must end up locked.
// ---------------------------------------------------------------------------------------------
{
  const store = createStore({ status: 'approved', registrationCodeFailedAttempts: 4 });
  let bothHaveRead;
  const readBarrier = new Promise((resolve) => {
    bothHaveRead = resolve;
  });
  let arrived = 0;
  const db = createDb(store, {
    beforeCommit: async (attempt) => {
      if (attempt > 0) return;
      arrived += 1;
      if (arrived === 2) bothHaveRead();
      await readBarrier;
    },
  });
  const ref = { update: async () => {} };

  const results = await Promise.all([
    recordFailedVendorRegistrationCodeAttempt(db, ref, { attemptedAt: T0 }),
    recordFailedVendorRegistrationCodeAttempt(db, ref, { attemptedAt: T0 }),
  ]);

  if (store.data.registrationCodeFailedAttempts !== 6) {
    failures.push(`FIX: two concurrent failed attempts from count 4 should end at count 6 (no lost update); got ${store.data.registrationCodeFailedAttempts}.`);
  }
  if (!results.some((r) => r.locked)) {
    failures.push('FIX: neither concurrent attempt reported locked:true, even though the count crossed the threshold.');
  }
  if (!store.data.registrationCodeLockedAt) {
    failures.push('FIX: the application was not locked after the count crossed the threshold under concurrency.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(`PASS: recordFailedVendorRegistrationCodeAttempt() locks exactly at the ${VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD}th failed attempt, and the counter increments atomically under concurrency (no lost update, same optimistic-concurrency proof technique as the F1 single-use claim check).`);
process.exit(0);
