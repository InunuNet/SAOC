// Vendor code verification: the attempt cap holds under parallel requests.
//
// Before: the route read the candidate applications, ran the lock check and the code comparison
// on that snapshot, and only then wrote the failure count in a separate transaction, so N
// parallel guesses were all compared against the code. Now the lock check, the comparison and the
// failure count run inside one transaction (verifyVendorRegistrationCodeAtomically).
//
// The fake Firestore below has real transaction semantics: reads are versioned, commit validates
// every read version and the loser of a contention is retried with fresh reads. Each read yields
// to the event loop so parallel transactions genuinely interleave.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/vendor-code-verify-race/check-verify-attempt-cap-atomic.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD,
  verifyVendorRegistrationCode,
  verifyVendorRegistrationCodeAtomically,
} from '../../../lib/vendor-registration-code.ts';

const NOW = new Date('2027-03-01T10:00:00Z');
const MAX_RETRIES = 500;
const PARALLEL_GUESSES = 50;
const SLUG = 'orchidsbyann';
const CODE = '4821';

const tick = () => new Promise((resolve) => setImmediate(resolve));

function createFirestore(initial) {
  const docs = new Map();
  for (const [id, data] of Object.entries(initial)) docs.set(id, { data: { ...data }, version: 0 });
  const stats = { comparedAtCommit: 0, okAfterLock: 0, retries: 0 };

  const db = {
    runTransaction: async (fn) => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        const run = { reads: new Map(), writes: new Map(), codeReads: 0 };
        const transaction = {
          get: async (ref) => {
            await tick();
            const doc = docs.get(ref.id);
            run.reads.set(ref.id, doc.version);
            const data = { ...doc.data };
            Object.defineProperty(data, '__run', { value: run, enumerable: false });
            return { exists: true, data: () => data };
          },
          update: (ref, patch) => {
            run.writes.set(ref.id, { ...(run.writes.get(ref.id) ?? {}), ...patch });
          },
        };
        const result = await fn(transaction);
        await tick();
        // Commit: validate every version read; on contention discard the run and retry.
        const stale = [...run.reads].some(([id, version]) => docs.get(id).version !== version);
        if (stale) {
          stats.retries += 1;
          continue;
        }
        if (result && result.ok === true) {
          for (const id of run.reads.keys()) {
            if (docs.get(id).data.registrationCodeLockedAt) stats.okAfterLock += 1;
          }
        }
        stats.comparedAtCommit += run.codeReads / 2; // eligibility + comparison each read the code
        for (const [id, patch] of run.writes) {
          const doc = docs.get(id);
          doc.data = { ...doc.data, ...patch };
          doc.version += 1;
        }
        return result;
      }
      throw new Error('transaction exceeded retry budget');
    },
  };
  return { db, docs, stats };
}

const baseDoc = (over = {}) => ({
  status: 'approved',
  registrationCodeId: CODE,
  registrationCodeNameSlug: SLUG,
  registrationCodeExpiresAt: new Date('2027-03-10T00:00:00Z'),
  registrationTokenConsumedAt: null,
  registrationCodeLockedAt: null,
  registrationCodeFailedAttempts: 0,
  ...over,
});

// Counts how often the stored code is actually read for comparison: eligibility reads it once and
// the comparison reads it once, and both only happen after the lock/consumed/expiry checks pass.
function toCandidate(id, data) {
  const run = data.__run;
  return {
    id,
    status: data.status,
    get registrationCodeId() {
      run.codeReads += 1;
      return data.registrationCodeId;
    },
    registrationCodeNameSlug: data.registrationCodeNameSlug,
    registrationCodeExpiresAt: data.registrationCodeExpiresAt,
    registrationCodeConsumedAt: data.registrationTokenConsumedAt,
    registrationCodeLockedAt: data.registrationCodeLockedAt,
    registrationCodeFailedAttempts: data.registrationCodeFailedAttempts,
  };
}

const guess = (db, typedCodeId, ids = ['app1']) =>
  verifyVendorRegistrationCodeAtomically(
    db,
    ids.map((id) => ({ id, ref: { id } })),
    { typedNameSlug: SLUG, typedCodeId },
    NOW,
    { toCandidate, attemptedAt: NOW },
  );

test('control: the old shape (verify on a pre-read snapshot) compares every parallel guess', async () => {
  const { docs } = createFirestore({ app1: baseDoc() });
  const snapshot = [{ id: 'app1', ...docs.get('app1').data, registrationCodeConsumedAt: null }];
  let compared = 0;
  await Promise.all(
    Array.from({ length: PARALLEL_GUESSES }, async () => {
      await tick();
      const candidate = {
        ...snapshot[0],
        get registrationCodeId() {
          compared += 1;
          return CODE;
        },
        registrationCodeLockedAt: null,
      };
      verifyVendorRegistrationCode({ typedNameSlug: SLUG, typedCodeId: '0000' }, [candidate], NOW);
    }),
  );
  assert.ok(compared >= PARALLEL_GUESSES, 'the fake can express the defect');
});

test('parallel wrong guesses compare at most the remaining attempts, and the count stops at the cap', async () => {
  const { db, docs, stats } = createFirestore({ app1: baseDoc() });
  const results = await Promise.all(
    Array.from({ length: PARALLEL_GUESSES }, () => guess(db, '0000')),
  );
  assert.ok(results.every((r) => r.ok === false));
  assert.equal(stats.comparedAtCommit, VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD);
  assert.ok(docs.get('app1').data.registrationCodeLockedAt);
  assert.ok(stats.retries > 0, 'the guesses really contended');
});

test('with 2 attempts left, only 2 parallel guesses are compared', async () => {
  const { db, stats } = createFirestore({
    app1: baseDoc({ registrationCodeFailedAttempts: VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD - 2 }),
  });
  await Promise.all(Array.from({ length: PARALLEL_GUESSES }, () => guess(db, '0000')));
  assert.equal(stats.comparedAtCommit, 2);
});

test('a correct guess racing wrong ones can never succeed after the lock', async () => {
  for (let trial = 0; trial < 40; trial += 1) {
    const { db, stats } = createFirestore({ app1: baseDoc({ registrationCodeFailedAttempts: 3 }) });
    const guesses = [];
    for (let i = 0; i < 10; i += 1) guesses.push(guess(db, i === trial % 10 ? CODE : '0000'));
    await Promise.all(guesses);
    assert.equal(stats.okAfterLock, 0, `trial ${trial}`);
  }
});

test('once locked, a correct guess is never compared and never succeeds', async () => {
  const { db, stats } = createFirestore({
    app1: baseDoc({
      registrationCodeFailedAttempts: VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD,
      registrationCodeLockedAt: NOW,
    }),
  });
  const results = await Promise.all(Array.from({ length: PARALLEL_GUESSES }, () => guess(db, CODE)));
  assert.ok(results.every((r) => r.ok === false));
  assert.equal(stats.comparedAtCommit, 0);
});

test('sequential behaviour is unchanged: correct code verifies and writes nothing', async () => {
  const { db, docs } = createFirestore({ app1: baseDoc() });
  assert.deepEqual(await guess(db, CODE), { ok: true, applicationId: 'app1' });
  assert.equal(docs.get('app1').version, 0);
  assert.equal(docs.get('app1').data.registrationCodeFailedAttempts, 0);
});

test('sequential behaviour is unchanged: wrong guesses count 1..4, lock exactly at 5', async () => {
  const { db, docs } = createFirestore({ app1: baseDoc() });
  for (let i = 1; i <= VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD; i += 1) {
    assert.deepEqual(await guess(db, '0000'), { ok: false });
    const data = docs.get('app1').data;
    assert.equal(data.registrationCodeFailedAttempts, i);
    assert.equal(Boolean(data.registrationCodeLockedAt), i === VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD);
  }
  assert.deepEqual(await guess(db, CODE), { ok: false });
});

test('a miss advances every candidate sharing the name slug, a match advances none', async () => {
  const { db, docs } = createFirestore({
    app1: baseDoc(),
    app2: baseDoc({ registrationCodeId: '1111' }),
  });
  assert.deepEqual(await guess(db, '9999', ['app1', 'app2']), { ok: false });
  assert.equal(docs.get('app1').data.registrationCodeFailedAttempts, 1);
  assert.equal(docs.get('app2').data.registrationCodeFailedAttempts, 1);
  assert.deepEqual(await guess(db, '1111', ['app1', 'app2']), { ok: true, applicationId: 'app2' });
  assert.equal(docs.get('app1').data.registrationCodeFailedAttempts, 1);
  assert.equal(docs.get('app2').data.registrationCodeFailedAttempts, 1);
});

test('a transaction failure fails closed: no verification, error reported', async () => {
  const errors = [];
  const db = {
    runTransaction: async () => {
      throw new Error('firestore unavailable');
    },
  };
  const result = await verifyVendorRegistrationCodeAtomically(
    db,
    [{ id: 'app1', ref: { id: 'app1' } }],
    { typedNameSlug: SLUG, typedCodeId: CODE },
    NOW,
    { toCandidate, attemptedAt: NOW, onError: (e) => errors.push(e.message) },
  );
  assert.deepEqual(result, { ok: false });
  assert.deepEqual(errors, ['firestore unavailable']);
});
