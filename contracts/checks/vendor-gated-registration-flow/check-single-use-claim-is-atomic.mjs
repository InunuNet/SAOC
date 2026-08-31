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
// M4 fix pass addition (architect pass 4, 2026-09-01): claimRegistrationToken() also gained an
// OPTIONAL `expectedGeneration` -- when supplied, the claim additionally refuses unless it
// equals the application's `registrationCodeGeneration` (absent normalised to 0). This is what
// makes a code REISSUE an actual revocation of any session minted from the prior code, not just
// a new code alongside a still-valid old session. @dev flagged this as the weakest point of its
// own fix: the option is optional purely so this file's own pre-generation call shapes above
// keep working, and nothing mechanically stops a future call site from forgetting to pass it
// (which would silently lose revocation). The cases below exercise match / mismatch / the
// absent-field-normalises-to-0 rule in BOTH directions / and the omitted-option back-compat
// path, all against the real function and the same transactional fake used above.
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
// M4 fix pass -- expectedGeneration. Codex-flagged as the weakest point of the reissue-
// revocation fix: `expectedGeneration` is OPTIONAL on ClaimRegistrationTokenOptions purely so
// this check's own pre-generation calls above keep compiling/passing -- omitting it must mean
// "do not check the generation", never "any generation matches". The one production call site
// (app/api/vendors/register/route.ts) always supplies it, but nothing mechanically enforces
// that; a future call site that forgets it would silently lose revocation. These cases exercise
// the REAL function, inside the SAME transactional fake as the concurrency proof above -- not a
// grep for the field name.
// ---------------------------------------------------------------------------------------------
{
  // Matching generation: claim succeeds.
  const store = createStore({ status: 'approved', registrationCodeGeneration: 2 });
  const claimed = await claimRegistrationToken(createDb(store), { update: async () => {} }, {
    consumedAt: CONSUMED_AT,
    expectedGeneration: 2,
  });
  if (!claimed) failures.push('expectedGeneration: a claim with a MATCHING generation (2 === 2) was refused; expected success.');
  if (!store.data.registrationTokenConsumedAt) failures.push('expectedGeneration: a successful matching-generation claim did not write registrationTokenConsumedAt.');
}
{
  // Mismatched generation (session minted from an old code, since reissued): claim refused,
  // and refusal writes nothing -- a reissue must actually revoke, not merely look like it does.
  const store = createStore({ status: 'approved', registrationCodeGeneration: 3 });
  const before = store.version;
  const claimed = await claimRegistrationToken(createDb(store), { update: async () => {} }, {
    consumedAt: CONSUMED_AT,
    expectedGeneration: 2, // stale -- the application has moved on to generation 3
  });
  if (claimed) failures.push('expectedGeneration: a claim with a MISMATCHED generation (2 !== 3) was NOT refused -- a reissued code fails to revoke the prior session.');
  if (store.version !== before) failures.push('expectedGeneration: a generation-mismatch refusal still wrote to the document.');
}
{
  // Absent registrationCodeGeneration normalises to 0 on BOTH sides of the comparison: a
  // pre-generation application (approved before this field existed) is generation 0, and a
  // session that carries expectedGeneration: 0 must still be claimable against it.
  const store = createStore({ status: 'approved' }); // no registrationCodeGeneration field at all
  const claimed = await claimRegistrationToken(createDb(store), { update: async () => {} }, {
    consumedAt: CONSUMED_AT,
    expectedGeneration: 0,
  });
  if (!claimed) failures.push('expectedGeneration: a claim with expectedGeneration: 0 against a document with NO registrationCodeGeneration field was refused; an absent field must normalise to 0, matching a session minted before generations existed.');
}
{
  // The same absent-field-normalises-to-0 rule, but proving the MISMATCH direction: a document
  // with no registrationCodeGeneration field (generation 0) must refuse a session claiming a
  // later generation (e.g. 1) -- catches an implementation that normalises the document's side
  // but not the comparison, or vice versa.
  const store = createStore({ status: 'approved' });
  const claimed = await claimRegistrationToken(createDb(store), { update: async () => {} }, {
    consumedAt: CONSUMED_AT,
    expectedGeneration: 1,
  });
  if (claimed) failures.push('expectedGeneration: a claim with expectedGeneration: 1 against a document with NO registrationCodeGeneration field (normalised generation 0) was NOT refused; expected a mismatch refusal.');
}
{
  // Omitting expectedGeneration entirely means "do not check" -- must still succeed against a
  // document whose generation has since moved on, which is the exact back-compat shape this
  // check's own earlier cases (and any future non-generation-aware caller) depend on.
  const store = createStore({ status: 'approved', registrationCodeGeneration: 5 });
  const claimed = await claimRegistrationToken(createDb(store), { update: async () => {} }, {
    consumedAt: CONSUMED_AT,
    // expectedGeneration deliberately omitted
  });
  if (!claimed) failures.push('expectedGeneration: omitting expectedGeneration entirely must mean "do not check the generation", but the claim was refused against a document at generation 5.');
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
    'application state without writing, fails closed on a transaction error, and (M4) refuses ' +
    'a mismatched registrationCodeGeneration -- with an absent field normalising to 0 on both ' +
    'sides -- while a claim that omits expectedGeneration entirely still succeeds unchecked.',
);
process.exit(0);
