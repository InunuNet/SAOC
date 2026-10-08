#!/usr/bin/env node
// vendor-invite TOCTOU fix pass -- BEHAVIOURAL proof that two concurrent
// claimVendorInviteEmailLock() attempts for the SAME canonical email (lib/vendor-invite-email-
// lock.ts) can never both win: exactly one caller gets { ok: true } and exactly one
// `vendorApplications` document is created between them. This is the regression test for the
// real-world defect Codex + QA found in app/api/admin/vendors/applications/invite/route.ts: the
// old implementation did a full-collection eligibility scan, THEN a separate `.add()` write,
// with no atomicity between them -- two concurrent "Invite a vendor" submissions for a brand
// new email could both pass the scan before either write landed, producing two independent
// application documents and two live registration codes for one vendor.
//
// Exercises the REAL claimVendorInviteEmailLock() against an in-memory fake Firestore that
// implements genuine optimistic-concurrency-control semantics (not just a single happy-path
// call): a fake `runTransaction` records every ref a transaction attempt's `get()` reads, lets
// concurrent attempts interleave their reads (an `await Promise.resolve()` inside `get()`
// forces a real microtask yield, so two calls racing on the SAME lock doc genuinely overlap),
// serializes the commit-and-version-check step (mirroring Firestore's real atomic commit), and
// RETRIES an attempt whose read set went stale before its commit -- exactly the guarantee
// claimVendorInviteEmailLock()'s own doc comment relies on ("Firestore's transaction
// retry-on-conflict guarantees exactly one commits"). A fake that just ran both calls to
// completion sequentially, with no interleaving and no retry, would prove nothing: it could not
// fail even against the ORIGINAL two-step defect, because it never gives two attempts a real
// window to observe the SAME pre-write state.
//
// Relative import with the .ts extension (never the @/lib alias, which does not resolve under
// plain node/tsx outside the Next.js build) -- same convention every other behavioural check in
// this repo's vendor contracts uses.
//
// NOT YET WIRED into contract-f1.yaml's assertions -- the architect wires this in separately
// (per standing instruction: @dev never edits the contract or goldens).
//
// Run as: npx tsx contracts/checks/vendor-invite/check-invite-email-lock-concurrency.mjs

const { claimVendorInviteEmailLock } = await import('../../../lib/vendor-invite-email-lock.ts');

const failures = [];

/** Pure helper, module scope -- not a class method, so no `this` is ever involved in building
 *  a doc's lookup key. */
function refKey(ref) {
  return `${ref.collectionName}/${ref.id}`;
}

/**
 * Minimal in-memory Firestore fake with real OCC + retry semantics. See the file-level comment
 * above for why this is necessary rather than a single-shot stub.
 */
class FakeFirestore {
  constructor() {
    this.docs = new Map(); // "collection/id" -> { data, version }
    this.commitChain = Promise.resolve();
    this.autoIdCounter = 0;
  }

  collection(name) {
    return {
      // Arrow function (not method shorthand) so `this` lexically binds to the FakeFirestore
      // instance -- no `const store = this` aliasing needed to reach `this.autoIdCounter`.
      doc: (id) => {
        const docId = id ?? `auto-${this.autoIdCounter++}`;
        return { collectionName: name, id: docId };
      },
    };
  }

  async runTransaction(updateFunction, attempt = 0) {
    const readVersions = new Map();
    const pendingWrites = [];

    const transaction = {
      get: async (ref) => {
        // Forces a real microtask yield so two concurrent runTransaction() calls racing on the
        // SAME ref genuinely interleave their reads here, instead of one call completing its
        // whole attempt before the other's get() is even scheduled.
        await Promise.resolve();
        const key = refKey(ref);
        const entry = this.docs.get(key);
        readVersions.set(key, entry ? entry.version : 0);
        return {
          exists: Boolean(entry),
          data: () => (entry ? entry.data : undefined),
        };
      },
      create: (ref, data) => {
        pendingWrites.push({ key: refKey(ref), data, type: 'create' });
      },
      set: (ref, data) => {
        pendingWrites.push({ key: refKey(ref), data, type: 'set' });
      },
    };

    const result = await updateFunction(transaction);

    // Commit phase -- chained onto a single promise so two concurrent attempts' commits are
    // serialized (mirroring Firestore's real atomic commit), never interleaved with each other.
    let outcome;
    this.commitChain = this.commitChain.then(() => {
      for (const [key, versionAtRead] of readVersions) {
        const current = this.docs.get(key);
        const currentVersion = current ? current.version : 0;
        if (currentVersion !== versionAtRead) {
          outcome = { conflict: true };
          return;
        }
      }
      for (const write of pendingWrites) {
        const current = this.docs.get(write.key);
        if (write.type === 'create' && current) {
          outcome = { conflict: true };
          return;
        }
        this.docs.set(write.key, { data: write.data, version: current ? current.version + 1 : 1 });
      }
      outcome = { conflict: false };
    });
    await this.commitChain;

    if (outcome.conflict) {
      if (attempt >= 10) {
        throw new Error('FakeFirestore: too many transaction retries (possible infinite loop)');
      }
      return this.runTransaction(updateFunction, attempt + 1);
    }

    return result;
  }
}

async function runConcurrentInviteRace() {
  const db = new FakeFirestore();
  const applicationsCollection = db.collection('vendorApplications');
  // Both concurrent callers resolve to the SAME lock doc id -- the whole point of hashing the
  // canonical email (lib/vendor-invite-email-lock.ts's vendorInviteEmailLockId) is that two
  // concurrent invites for the SAME email contend on the SAME guard document.
  const lockRef = db.collection('vendorInviteEmailLocks').doc('same-email-hash');

  function attempt(label) {
    const newApplicationRef = applicationsCollection.doc();
    return claimVendorInviteEmailLock(db, {
      lockRef,
      applicationsCollection,
      newApplicationRef,
      newApplicationId: newApplicationRef.id,
      newApplicationData: { businessName: label, status: 'approved' },
    });
  }

  const [resultA, resultB] = await Promise.all([attempt('Caller A'), attempt('Caller B')]);

  const oks = [resultA, resultB].filter((r) => r.ok === true);
  const conflicts = [resultA, resultB].filter((r) => r.ok === false);

  if (oks.length !== 1) {
    failures.push(
      `expected exactly ONE of the two concurrent attempts to win, got ${oks.length} winners: ${JSON.stringify([resultA, resultB])}`,
    );
  }
  if (conflicts.length !== 1) {
    failures.push(
      `expected exactly ONE of the two concurrent attempts to be refused as a conflict, got ${conflicts.length}: ${JSON.stringify([resultA, resultB])}`,
    );
  }

  const applicationDocs = [...db.docs.keys()].filter((key) => key.startsWith('vendorApplications/'));
  if (applicationDocs.length !== 1) {
    failures.push(
      `expected exactly ONE vendorApplications document to exist after the race, found ${applicationDocs.length}: ${JSON.stringify(applicationDocs)}`,
    );
  }

  if (conflicts.length === 1 && conflicts[0].conflict?.status !== 'approved') {
    failures.push(
      `expected the losing attempt's conflict.status to be 'approved' (the winner's application is created already-approved), got ${JSON.stringify(conflicts[0])}`,
    );
  }
}

/**
 * Non-regression control: a DECLINED application behind the guard must NOT block a fresh
 * claim -- the guard is reclaimed and repointed at the new application. Proves the fix did not
 * overcorrect into permanently blocking re-invites, mirroring
 * decideVendorApplicationInviteEligibility()'s own "declined is not a conflict" rule (A3).
 */
async function runDeclinedGuardIsReclaimable() {
  const db = new FakeFirestore();
  const applicationsCollection = db.collection('vendorApplications');
  const lockRef = db.collection('vendorInviteEmailLocks').doc('declined-email-hash');

  // Seed an existing DECLINED application and point the guard at it directly (bypassing the
  // claim function), simulating a prior invite that was later declined.
  const staleApplicationRef = applicationsCollection.doc('stale-declined-app');
  db.docs.set(refKey(staleApplicationRef), { data: { status: 'declined' }, version: 1 });
  db.docs.set(refKey(lockRef), {
    data: { applicationId: staleApplicationRef.id },
    version: 1,
  });

  const newApplicationRef = applicationsCollection.doc();
  const result = await claimVendorInviteEmailLock(db, {
    lockRef,
    applicationsCollection,
    newApplicationRef,
    newApplicationId: newApplicationRef.id,
    newApplicationData: { businessName: 'Re-invited vendor', status: 'approved' },
  });

  if (!result.ok) {
    failures.push(
      `expected a fresh invite to be ALLOWED when the guard points at a DECLINED application, got ${JSON.stringify(result)}`,
    );
  }

  const lockEntry = db.docs.get(refKey(lockRef));
  if (lockEntry?.data?.applicationId !== newApplicationRef.id) {
    failures.push(
      `expected the guard to be repointed at the NEW application (${newApplicationRef.id}), got ${JSON.stringify(lockEntry)}`,
    );
  }
}

await runConcurrentInviteRace();
await runDeclinedGuardIsReclaimable();

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: two concurrent claimVendorInviteEmailLock() attempts for the same email produce ' +
    'exactly one winner and exactly one vendorApplications document; a declined guard is ' +
    'reclaimable by a fresh invite.',
);
process.exit(0);
