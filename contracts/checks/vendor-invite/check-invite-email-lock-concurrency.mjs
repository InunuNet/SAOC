#!/usr/bin/env node
// vendor-invite TOCTOU fix pass (two rounds) -- BEHAVIOURAL proof against the REAL
// claimVendorInviteEmailLock() (lib/vendor-invite-email-lock.ts) that:
//   (1) two concurrent invite attempts for the SAME canonical email can never both win --
//       exactly one caller gets { ok: true } and exactly one `vendorApplications` document
//       is created between them (round 1's regression test, unchanged in intent).
//   (2) an invite racing a CONCURRENT PUBLIC application for the SAME email cannot create a
//       duplicate either -- the invite's transactional full-collection scan must see the
//       public application once it commits, even if it committed AFTER the invite's scan
//       first read the (then-empty) collection (round 2's regression test, Codex A10 finding:
//       the original fix still ran its eligibility scan BEFORE opening the transaction, so a
//       public application with no guard doc could slip through).
//   (3) a DECLINED application behind the guard does not permanently block a fresh invite for
//       the same email (non-regression control, unchanged from round 1).
//
// Exercises the REAL claimVendorInviteEmailLock() against an in-memory fake Firestore that
// implements genuine optimistic-concurrency-control semantics, not just a single happy-path
// call: a fake `runTransaction` records every ref (single document OR whole collection) a
// transaction attempt's `get()` reads, lets concurrent attempts interleave their reads (an
// `await Promise.resolve()` inside `get()` forces a real microtask yield), serializes the
// commit-and-version-check step (mirroring Firestore's real atomic commit), and RETRIES an
// attempt whose read set went stale before its commit -- exactly the guarantee
// claimVendorInviteEmailLock()'s own doc comment relies on, for BOTH a single document
// (the guard doc) and a whole collection (the duplicate-eligibility scan, which Firestore
// treats as a query read subject to the same conflict-and-retry semantics: any write to a
// collection a transaction read invalidates that read). A fake that only tracked single-
// document versions would prove round 1's fix but stay silent on round 2's regression --
// case (2) below specifically exercises the collection-level tracking.
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
 *  a single document's lookup key. Only valid for __kind: 'doc' refs. */
function refKey(ref) {
  return `${ref.collectionName}/${ref.id}`;
}

/**
 * Minimal in-memory Firestore fake with real OCC + retry semantics, covering BOTH single-
 * document reads (the guard doc, and the guard's referenced application) and whole-collection
 * query reads (the duplicate-eligibility scan). See the file-level comment above for why this
 * is necessary rather than a single-shot stub.
 */
class FakeFirestore {
  constructor(hooks = {}) {
    this.docs = new Map(); // "collection/id" -> { data, version }
    this.collectionVersions = new Map(); // collectionName -> version, bumped on ANY write to it
    this.commitChain = Promise.resolve();
    this.autoIdCounter = 0;
    // Test-only instrumentation seam: fires right after a transaction's collection-level read
    // is recorded (but before that read's results are returned), letting a test deterministically
    // land a concurrent write inside the exact window a timing-based Promise.all race could not
    // reliably hit. See runInviteVsPublicRace() below for the one case that needs this.
    this.hooks = hooks;
  }

  collection(name) {
    return {
      __kind: 'collection',
      collectionName: name,
      // Arrow function (not method shorthand) so `this` lexically binds to the FakeFirestore
      // instance -- no `this`-aliasing needed to reach `this.autoIdCounter`.
      doc: (id) => {
        const docId = id ?? `auto-${this.autoIdCounter++}`;
        return { __kind: 'doc', collectionName: name, id: docId };
      },
    };
  }

  async runTransaction(updateFunction, attempt = 0) {
    const readVersions = new Map(); // single-doc key -> version at read time
    const collectionReadVersions = new Map(); // collectionName -> version at read time
    const pendingWrites = [];

    const transaction = {
      get: async (ref) => {
        // Forces a real microtask yield so two concurrent runTransaction() calls racing on the
        // SAME ref genuinely interleave their reads here, instead of one call completing its
        // whole attempt before the other's get() is even scheduled.
        await Promise.resolve();

        if (ref.__kind === 'collection') {
          collectionReadVersions.set(ref.collectionName, this.collectionVersions.get(ref.collectionName) ?? 0);
          // Deterministic race-window hook -- see the constructor comment above.
          await this.hooks.afterCollectionRead?.(ref.collectionName);
          const prefix = `${ref.collectionName}/`;
          const docs = [...this.docs.entries()]
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, entry]) => ({ id: key.slice(prefix.length), data: () => entry.data }));
          return { docs };
        }

        const key = refKey(ref);
        const entry = this.docs.get(key);
        readVersions.set(key, entry ? entry.version : 0);
        return {
          exists: Boolean(entry),
          data: () => (entry ? entry.data : undefined),
        };
      },
      create: (ref, data) => {
        pendingWrites.push({ key: refKey(ref), collectionName: ref.collectionName, data, type: 'create' });
      },
      set: (ref, data) => {
        pendingWrites.push({ key: refKey(ref), collectionName: ref.collectionName, data, type: 'set' });
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
      for (const [collectionName, versionAtRead] of collectionReadVersions) {
        const currentVersion = this.collectionVersions.get(collectionName) ?? 0;
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
        this.collectionVersions.set(write.collectionName, (this.collectionVersions.get(write.collectionName) ?? 0) + 1);
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
  const contactEmail = 'race@example.com';

  function attempt(label) {
    const newApplicationRef = applicationsCollection.doc();
    return claimVendorInviteEmailLock(db, {
      contactEmail,
      lockRef,
      applicationsCollection,
      newApplicationRef,
      newApplicationId: newApplicationRef.id,
      newApplicationData: { businessName: label, contactEmail, status: 'approved' },
    });
  }

  const [resultA, resultB] = await Promise.all([attempt('Caller A'), attempt('Caller B')]);

  const oks = [resultA, resultB].filter((r) => r.ok === true);
  const conflicts = [resultA, resultB].filter((r) => r.ok === false);

  if (oks.length !== 1) {
    failures.push(
      `(1) expected exactly ONE of the two concurrent invite-vs-invite attempts to win, got ${oks.length} winners: ${JSON.stringify([resultA, resultB])}`,
    );
  }
  if (conflicts.length !== 1) {
    failures.push(
      `(1) expected exactly ONE of the two concurrent invite-vs-invite attempts to be refused as a conflict, got ${conflicts.length}: ${JSON.stringify([resultA, resultB])}`,
    );
  }

  const applicationDocs = [...db.docs.keys()].filter((key) => key.startsWith('vendorApplications/'));
  if (applicationDocs.length !== 1) {
    failures.push(
      `(1) expected exactly ONE vendorApplications document to exist after the invite-vs-invite race, found ${applicationDocs.length}: ${JSON.stringify(applicationDocs)}`,
    );
  }
}

/**
 * Codex A10 round-2 regression test: a PUBLIC application for the SAME email commits
 * concurrently with an invite, landing in the exact window between the invite's transaction
 * FIRST reading the (then-empty) `vendorApplications` collection and that same transaction's
 * commit. A fix that merely re-ran the scan transactionally but got the retry-on-conflict
 * wiring wrong (or a fix that reverted to a pre-transaction scan) would let the invite commit
 * anyway, creating a duplicate. The real invariant under test: Firestore's (and this fake's)
 * transaction isolation must force the invite's transaction to RETRY after the public write
 * commits, and the retried attempt's fresh scan must then see the public application and
 * refuse the invite.
 *
 * Uses the FakeFirestore's `afterCollectionRead` hook (not Promise.all timing) to land the
 * public write at the EXACT moment the invite's scan has read the collection but not yet
 * committed -- the one window a real concurrent request could hit nondeterministically, made
 * deterministic here so this check does not flake.
 */
async function runInviteVsPublicRace() {
  const contactEmail = 'public-racer@example.com';
  let publicWriteLanded = false;

  const db = new FakeFirestore({
    afterCollectionRead: async (collectionName) => {
      if (publicWriteLanded || collectionName !== 'vendorApplications') {
        return;
      }
      publicWriteLanded = true;
      // Models app/api/vendors/apply/route.ts's plain, non-transactional `.add()` -- a public
      // application has NO guard doc and never calls claimVendorInviteEmailLock() at all. A
      // trivial one-write transaction is used here only because this fake's commit/versioning
      // machinery lives in runTransaction(); the write itself is unconditional (no read, no
      // eligibility check), faithfully matching the real public-apply route's behaviour.
      const applicationsCollection = db.collection('vendorApplications');
      const publicRef = applicationsCollection.doc();
      await db.runTransaction(async (transaction) => {
        transaction.create(publicRef, {
          businessName: 'Public applicant',
          contactEmail,
          status: 'pending',
        });
      });
    },
  });

  const applicationsCollection = db.collection('vendorApplications');
  const lockRef = db.collection('vendorInviteEmailLocks').doc('public-racer-hash');
  const newApplicationRef = applicationsCollection.doc();

  const inviteResult = await claimVendorInviteEmailLock(db, {
    contactEmail,
    lockRef,
    applicationsCollection,
    newApplicationRef,
    newApplicationId: newApplicationRef.id,
    newApplicationData: { businessName: 'Invited vendor', contactEmail, status: 'approved' },
  });

  if (inviteResult.ok) {
    failures.push(
      '(2) expected the invite to be REFUSED once the concurrent public application for the ' +
        `same email commits mid-transaction, but claimVendorInviteEmailLock() returned { ok: true }`,
    );
  }

  const applicationDocs = [...db.docs.keys()].filter((key) => key.startsWith('vendorApplications/'));
  if (applicationDocs.length !== 1) {
    failures.push(
      `(2) expected exactly ONE vendorApplications document (the public one) to exist after the ` +
        `invite-vs-public race, found ${applicationDocs.length}: ${JSON.stringify(applicationDocs)}`,
    );
  }

  if (!publicWriteLanded) {
    failures.push('(2) test bug: the public write hook never fired -- this assertion proved nothing');
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
  const contactEmail = 'declined@example.com';

  // Seed an existing DECLINED application and point the guard at it directly (bypassing the
  // claim function), simulating a prior invite that was later declined.
  const staleApplicationRef = applicationsCollection.doc('stale-declined-app');
  db.docs.set(refKey(staleApplicationRef), {
    data: { status: 'declined', contactEmail },
    version: 1,
  });
  db.docs.set(refKey(lockRef), {
    data: { applicationId: staleApplicationRef.id },
    version: 1,
  });
  db.collectionVersions.set('vendorApplications', 1);

  const newApplicationRef = applicationsCollection.doc();
  const result = await claimVendorInviteEmailLock(db, {
    contactEmail,
    lockRef,
    applicationsCollection,
    newApplicationRef,
    newApplicationId: newApplicationRef.id,
    newApplicationData: { businessName: 'Re-invited vendor', contactEmail, status: 'approved' },
  });

  if (!result.ok) {
    failures.push(
      `(3) expected a fresh invite to be ALLOWED when the guard points at a DECLINED application, got ${JSON.stringify(result)}`,
    );
  }

  const lockEntry = db.docs.get(refKey(lockRef));
  if (lockEntry?.data?.applicationId !== newApplicationRef.id) {
    failures.push(
      `(3) expected the guard to be repointed at the NEW application (${newApplicationRef.id}), got ${JSON.stringify(lockEntry)}`,
    );
  }
}

await runConcurrentInviteRace();
await runInviteVsPublicRace();
await runDeclinedGuardIsReclaimable();

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: two concurrent invites for the same email produce exactly one winner; an invite ' +
    'racing a concurrent PUBLIC application for the same email also cannot create a ' +
    'duplicate; a declined guard is reclaimable by a fresh invite.',
);
process.exit(0);
