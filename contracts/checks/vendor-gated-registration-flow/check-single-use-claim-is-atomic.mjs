#!/usr/bin/env node
// vendor-gated-registration-flow M1 fix pass -- executed proof that single-use enforcement in
// lib/vendor-registration-token-claim.ts is ATOMIC, not read-check-then-later-write.
//
// The Firestore emulator needs a Java runtime that is not installed on this machine, so the
// real client cannot be driven here. Instead this check runs the REAL claimRegistrationToken()
// against a fake that models the ONE Firestore property the fix depends on -- optimistic
// concurrency: a transaction that commits a write to a document whose version changed since it
// read that document is aborted and its callback re-run against fresh data.
//
// A fake is only worth anything if it can express the defect. So the same fake also drives a
// CONTROL arm reproducing the OLD code shape (read outside the transaction, check, then write
// afterwards). The control MUST produce two winners; if it does not, the fake is serialising
// the callers by construction and proves nothing, and this check fails loudly for that reason
// rather than reporting a green it did not earn.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow/check-single-use-claim-is-atomic.mjs

import { claimRegistrationToken } from '../../../lib/vendor-registration-token-claim.ts';

const failures = [];
const CONSUMED_AT = new Date('2027-02-01T00:00:00Z');

/** Minimal Firestore-like store with per-document versions. */
function createStore(initialData) {
  return { data: { ...initialData }, version: 0, exists: true };
}

/**
 * runTransaction with real optimistic-concurrency semantics: reads are version-stamped, writes
 * are buffered until commit, and a commit whose read-set has been bumped by another committer
 * is discarded and the whole callback re-run. `beforeCommit` is an injected await point that
 * lets the test interleave two in-flight transactions deterministically.
 */
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
        if (stale) continue; // contention -> discard buffered writes, re-run the callback

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

const approvedDoc = { status: 'approved' };

// ---------------------------------------------------------------------------------------------
// CONTROL: the OLD read-check-then-later-write shape, against the same fake. Must yield 2 wins.
// ---------------------------------------------------------------------------------------------
{
  const store = createStore(approvedDoc);
  const oldShapeClaim = async () => {
    const data = { ...store.data }; // ref.get(), outside any transaction
    if (!store.exists || data.status !== 'approved' || Boolean(data.registrationTokenConsumedAt)) {
      return false;
    }
    await Promise.resolve(); // the submission write both callers used to complete here
    store.data = { ...store.data, registrationTokenConsumedAt: CONSUMED_AT };
    store.version += 1;
    return true;
  };
  const [a, b] = await Promise.all([oldShapeClaim(), oldShapeClaim()]);
  if (!(a && b)) {
    failures.push(
      `CONTROL: the pre-fix read-then-write shape was expected to produce TWO winners under this ` +
        `harness (proving the harness can express the defect), but got [${a}, ${b}]. The harness ` +
        `is serialising callers and this check proves nothing.`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// FIX: two concurrent claims, forced to both READ before either COMMITS. Exactly one may win.
// ---------------------------------------------------------------------------------------------
{
  const store = createStore(approvedDoc);
  let bothHaveRead;
  const readBarrier = new Promise((resolve) => {
    bothHaveRead = resolve;
  });
  let arrived = 0;
  const db = createDb(store, {
    beforeCommit: async (attempt) => {
      if (attempt > 0) return; // only stall the first pass; retries commit immediately
      arrived += 1;
      if (arrived === 2) bothHaveRead();
      await readBarrier;
    },
  });

  const ref = { update: async () => {} };
  const results = await Promise.all([
    claimRegistrationToken(db, ref, { consumedAt: CONSUMED_AT }),
    claimRegistrationToken(db, ref, { consumedAt: CONSUMED_AT }),
  ]);

  const winners = results.filter(Boolean).length;
  if (winners !== 1) {
    failures.push(
      `FIX: two concurrent claims that both read before either committed produced ${winners} ` +
        `winner(s); exactly 1 is required (results: [${results.join(', ')}]).`,
    );
  }
  if (!store.data.registrationTokenConsumedAt) {
    failures.push('FIX: the winning claim did not write registrationTokenConsumedAt.');
  }
  if (store.version !== 1) {
    failures.push(`FIX: expected exactly one committed write, saw ${store.version}.`);
  }
}

// ---------------------------------------------------------------------------------------------
// Ineligible states are still refused, and refusal writes nothing.
// ---------------------------------------------------------------------------------------------
for (const [label, doc, exists] of [
  ['pending application', { status: 'pending' }, true],
  ['declined application', { status: 'declined' }, true],
  ['already-consumed token', { status: 'approved', registrationTokenConsumedAt: CONSUMED_AT }, true],
  ['missing application', {}, false],
]) {
  const store = createStore(doc);
  store.exists = exists;
  const before = store.version;
  const claimed = await claimRegistrationToken(createDb(store), { update: async () => {} }, {
    consumedAt: CONSUMED_AT,
  });
  if (claimed) failures.push(`${label}: expected a refusal, but the claim succeeded.`);
  if (store.version !== before) failures.push(`${label}: a refused claim still wrote to the document.`);
}

// ---------------------------------------------------------------------------------------------
// A transaction failure is a refusal (fail closed), never a claim.
// ---------------------------------------------------------------------------------------------
{
  let reported = false;
  const claimed = await claimRegistrationToken(
    { runTransaction: async () => { throw new Error('UNAVAILABLE'); } },
    { update: async () => {} },
    { consumedAt: CONSUMED_AT, onError: () => { reported = true; } },
  );
  if (claimed) failures.push('A failing transaction was treated as a successful claim.');
  if (!reported) failures.push('A failing transaction was swallowed without reaching onError.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: claimRegistrationToken() admits exactly ONE of two concurrent claims that both read ' +
    'before either committed (the same harness reproduces two winners against the pre-fix ' +
    'read-then-write shape, so it can express the defect), refuses every ineligible ' +
    'application state without writing, and fails closed on a transaction error.',
);
process.exit(0);
