/**
 * vendor-invite M1/F1 fix pass -- closes TWO TOCTOU races around "Invite a vendor":
 *
 * (1) invite-vs-invite: two concurrent invites for the same BRAND NEW email could both pass
 *     a pre-write eligibility check before either write landed, producing two independent
 *     `vendorApplications` documents and two live registration codes for one vendor.
 * (2) invite-vs-public (Codex A10, second pass, 2026-10-08): the ORIGINAL fix for (1) still
 *     ran its full-collection eligibility scan BEFORE opening the transaction. A public
 *     application (app/api/vendors/apply/route.ts) has no guard doc at all, so it can commit
 *     in the window between that scan and this transaction's commit, and the invite never
 *     sees it -- same duplicate outcome as (1), just with a public applicant on one side
 *     instead of a second invite.
 *
 * Fix for both: the full-collection scan (decideVendorApplicationInviteEligibility(), lib/
 * vendor-application-invite-eligibility.ts) now runs AS A TRANSACTIONAL QUERY READ inside the
 * SAME transaction that creates the new application -- `transaction.get(applicationsCollection)`,
 * not a plain `.get()` before the transaction opens. Firestore's transaction isolation covers
 * query reads, not just single-document reads: if ANY document in the collection changes
 * (another write commits) after this transaction read it but before this transaction commits,
 * Firestore aborts and retries this transaction's callback -- which re-runs the scan against
 * the now-current state. This closes BOTH races through the one mechanism, including the
 * invite-vs-public case the canonical-email guard (below) was never positioned to catch,
 * because it has no counterpart on the public-apply path and this fix deliberately does not
 * add one there (see this file's own callers for why: changing public-apply's behaviour for a
 * normal, non-colliding submit is out of scope for this fix).
 *
 * The canonical-email guard document, `vendorInviteEmailLocks/{sha256(trimmed+lowercased
 * email)}` holding `{ applicationId }`, is KEPT as a second, cheaper gate specifically for (1)
 * -- it is now largely subsumed by the transactional full scan above (any write to the
 * collection invalidates a concurrent transaction's read of it, scan-based or not), but removing
 * it would be a larger, non-surgical change for no correctness gain, and it still gives a
 * clearly-named contention point for the invite-vs-invite case specifically.
 *
 * Mirrors lib/vendor-registration-token-claim.ts's "deliberately narrow structural
 * interface" approach: the interfaces below describe ONLY the firebase-admin methods this
 * module calls, which is what lets the REAL Firestore/Transaction/DocumentReference/
 * CollectionReference classes satisfy them with zero adapter code -- and what lets a
 * contract check exercise this module's concurrency behaviour with a plain in-memory fake,
 * no live Firestore project required.
 *
 * "its application's status" (both for the guard's referenced application and for every
 * candidate the transactional scan reads) is read live, inside the transaction, never cached
 * -- so a `declined` application never permanently blocks re-inviting the same email.
 */

import { createHash } from 'node:crypto';

import {
  decideVendorApplicationInviteEligibility,
  vendorApplicationInviteConflictMessage,
  type VendorApplicationInviteCandidate,
} from './vendor-application-invite-eligibility';
import type { VendorApplicationStatus } from '@/types/index';

export const VENDOR_INVITE_EMAIL_LOCKS_COLLECTION = 'vendorInviteEmailLocks';

/**
 * Deterministic guard-doc id. Trims and lowercases the email -- the SAME canonicalisation
 * decideVendorApplicationInviteEligibility() already applies to its own comparison -- before
 * hashing, so two emails differing only in surrounding whitespace or case resolve to the
 * SAME guard doc and therefore the SAME transaction contention point. SHA-256 is used only to
 * produce a Firestore-document-id-safe string (a raw email contains characters Firestore
 * document ids disallow) -- nothing here treats the hash as a secret.
 */
export function vendorInviteEmailLockId(contactEmail: string): string {
  const canonical = contactEmail.trim().toLowerCase();
  return createHash('sha256').update(canonical).digest('hex');
}

/** A single document snapshot -- the guard doc, or the application the guard currently
 *  points at. */
export interface VendorInviteEmailLockSnapshotLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

/** A query/collection snapshot -- the transactional full-collection scan reads this shape. */
export interface VendorInviteEmailLockQuerySnapshotLike {
  docs: Array<{ id: string; data(): Record<string, unknown> | undefined }>;
}

export interface VendorInviteEmailLockTransactionLike {
  // Deliberately returns `unknown`, not a specific snapshot type: the REAL firebase-admin
  // Transaction.get() is overloaded (a DocumentReference argument returns a DocumentSnapshot,
  // a Query/CollectionReference argument returns a QuerySnapshot). Narrowing the return type
  // here to either shape would make the other call site below a type error against the real
  // SDK. Call sites cast to the shape they actually asked for, each with a comment explaining
  // why (see the function body below) -- the standard "no assertion without a comment"
  // exception this repo's coding rules allow.
  get(ref: unknown): Promise<unknown>;
  create(ref: unknown, data: Record<string, unknown>): unknown;
  set(ref: unknown, data: Record<string, unknown>): unknown;
}

export interface VendorInviteEmailLockRunnerLike {
  runTransaction<T>(
    updateFunction: (transaction: VendorInviteEmailLockTransactionLike) => Promise<T>,
  ): Promise<T>;
}

/** The one method needed to resolve the guard's currently-referenced application ref from
 *  its id -- deliberately narrower than a full CollectionReference, same "structural
 *  interface" approach as the rest of this module. Also passed directly to
 *  `transaction.get()` for the full-collection scan -- a real CollectionReference IS a Query,
 *  which `transaction.get()` accepts. */
export interface VendorInviteEmailLockCollectionLike {
  doc(id: string): unknown;
}

export interface ClaimVendorInviteEmailLockOptions {
  /** Raw (untrimmed is fine -- decideVendorApplicationInviteEligibility() lowercases, and the
   *  caller's own validator already trims) contact email the invite is for. Needed here, not
   *  just as the already-hashed `lockRef`, because the transactional full-collection scan
   *  compares it against every candidate's `contactEmail` -- the hash alone cannot do that
   *  comparison. */
  contactEmail: string;
  lockRef: unknown;
  applicationsCollection: VendorInviteEmailLockCollectionLike;
  newApplicationRef: unknown;
  newApplicationId: string;
  newApplicationData: Record<string, unknown>;
}

export type VendorInviteEmailLockResult =
  | { ok: true }
  | { ok: false; error: string; conflictingId: string };

/**
 * Inside ONE transaction:
 *  1. Re-runs the full-collection eligibility scan as a transactional QUERY read (closes the
 *     invite-vs-public race -- see the file-level comment above for why this is sufficient on
 *     its own, with no change to the public-apply route).
 *  2. Reads the canonical-email guard doc; if it points at an application whose CURRENT status
 *     is `pending` or `approved`, refuses (closes the remaining invite-vs-invite race on a
 *     brand-new email neither step 1 nor a stale guard would otherwise catch within a single
 *     attempt).
 *  3. Otherwise creates the new application document (`transaction.create()`, which throws if
 *     the pre-allocated ref somehow already exists -- it never silently overwrites) and
 *     (re)points the guard at it.
 * A conflict at either step 1 or step 2 returns the SAME shape, so the caller does not need to
 * know which gate caught it.
 */
export async function claimVendorInviteEmailLock(
  db: VendorInviteEmailLockRunnerLike,
  options: ClaimVendorInviteEmailLockOptions,
): Promise<VendorInviteEmailLockResult> {
  return db.runTransaction(async (transaction) => {
    // Cast: `applicationsCollection` is a Query-shaped ref (a real CollectionReference IS a
    // Query), so the real SDK's overloaded transaction.get() returns a QuerySnapshot here --
    // see the VendorInviteEmailLockTransactionLike doc comment above for why the interface
    // itself cannot express this without breaking the OTHER get() call site below.
    const scanSnapshot = (await transaction.get(
      options.applicationsCollection,
    )) as VendorInviteEmailLockQuerySnapshotLike;
    const candidates: VendorApplicationInviteCandidate[] = scanSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data?.['status'] as VendorApplicationStatus,
        contactEmail: String(data?.['contactEmail'] ?? ''),
      };
    });
    const scanDecision = decideVendorApplicationInviteEligibility(
      options.contactEmail,
      candidates,
    );
    if (!scanDecision.ok) {
      return { ok: false, error: scanDecision.error, conflictingId: scanDecision.conflictingId };
    }

    // Cast: `lockRef` is a single-document ref -- the real SDK's overloaded transaction.get()
    // returns a DocumentSnapshot here, same reasoning as the cast above.
    const lockSnapshot = (await transaction.get(
      options.lockRef,
    )) as VendorInviteEmailLockSnapshotLike;

    if (lockSnapshot.exists) {
      const existingApplicationId = String(lockSnapshot.data()?.['applicationId'] ?? '');

      if (existingApplicationId) {
        const existingRef = options.applicationsCollection.doc(existingApplicationId);
        const existingSnapshot = (await transaction.get(
          existingRef,
        )) as VendorInviteEmailLockSnapshotLike;
        const existingStatus = String(existingSnapshot.data()?.['status'] ?? '');

        // Narrowed by the condition above to the literal union 'pending' | 'approved' --
        // vendorApplicationInviteConflictMessage() (lib/vendor-application-invite-eligibility.ts)
        // is the SAME helper the transactional scan's own conflict (scanDecision, above) and
        // the sibling full-scan decision function both build their wording from, so the two
        // gates can never drift apart in phrasing.
        if (existingStatus === 'pending' || existingStatus === 'approved') {
          return {
            ok: false,
            error: vendorApplicationInviteConflictMessage(existingStatus, existingApplicationId),
            conflictingId: existingApplicationId,
          };
        }
      }
    }

    transaction.create(options.newApplicationRef, options.newApplicationData);
    transaction.set(options.lockRef, { applicationId: options.newApplicationId });

    return { ok: true };
  });
}
