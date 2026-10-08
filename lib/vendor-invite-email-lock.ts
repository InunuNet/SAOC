/**
 * vendor-invite M1/F1 fix pass -- closes a TOCTOU race between two concurrent "Invite a
 * vendor" submissions for the same new email. The original implementation did a
 * full-collection eligibility scan (lib/vendor-application-invite-eligibility.ts), THEN a
 * separate `.add()` write -- a window in which two concurrent requests for the same new
 * email could both pass the scan before either write landed, producing two independent
 * `vendorApplications` documents and two live registration codes for one vendor.
 *
 * Fix: a canonical-email guard document, `vendorInviteEmailLocks/{sha256(trimmed+lowercased
 * email)}`, holding only `{ applicationId }`. The guard is read and (re)claimed inside the
 * SAME transaction that creates the new application document, so two callers racing on the
 * same lock doc can never both win -- Firestore's transaction retry-on-conflict guarantees
 * exactly one commits.
 *
 * Mirrors lib/vendor-registration-token-claim.ts's "deliberately narrow structural
 * interface" approach: the interfaces below describe ONLY the firebase-admin methods this
 * module calls, which is what lets the REAL Firestore/Transaction/DocumentReference/
 * CollectionReference classes satisfy them with zero adapter code -- and what lets a
 * contract check exercise this module's concurrency behaviour with a plain in-memory fake,
 * no live Firestore project required.
 *
 * The guard only has to stop invite-vs-invite races. A pre-existing PUBLIC application for
 * the same email (which never had a guard doc written for it) is still caught by the
 * existing full-collection eligibility scan the route runs BEFORE this transaction opens --
 * this module is a second, race-safe gate, not a replacement for that scan.
 *
 * "its application's status" is read live, inside the transaction, from the application
 * document the guard currently points at -- never cached on the guard doc itself -- so a
 * `declined` referenced application (or one that no longer exists) never permanently blocks
 * re-inviting the same email; the guard is simply reclaimed and repointed at the new
 * application. No undefined own-properties are ever written: the guard's only field is a
 * required string.
 */

import { createHash } from 'node:crypto';

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

/** Only the one read this guard performs on the lock-doc snapshot, and the one read it
 *  performs on the referenced application's own snapshot -- same narrow shape for both. */
export interface VendorInviteEmailLockSnapshotLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface VendorInviteEmailLockTransactionLike {
  get(ref: unknown): Promise<VendorInviteEmailLockSnapshotLike>;
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
 *  interface" approach as the rest of this module. */
export interface VendorInviteEmailLockCollectionLike {
  doc(id: string): unknown;
}

export interface ClaimVendorInviteEmailLockOptions {
  lockRef: unknown;
  applicationsCollection: VendorInviteEmailLockCollectionLike;
  newApplicationRef: unknown;
  newApplicationId: string;
  newApplicationData: Record<string, unknown>;
}

export interface VendorInviteEmailLockConflict {
  applicationId: string;
  status: 'pending' | 'approved';
}

export type VendorInviteEmailLockResult =
  | { ok: true }
  | { ok: false; conflict: VendorInviteEmailLockConflict };

/**
 * Reads the guard doc; if it points at an application whose CURRENT status (read live,
 * inside this same transaction) is `pending` or `approved`, refuses -- the caller reports the
 * same conflict decideVendorApplicationInviteEligibility() reports for a pre-existing match.
 * Otherwise creates the new application document (`transaction.create()`, which throws if
 * the pre-allocated ref somehow already exists -- it never silently overwrites) and
 * (re)points the guard at it, all inside one transaction, so two callers racing on the same
 * lock doc can never both win.
 */
export async function claimVendorInviteEmailLock(
  db: VendorInviteEmailLockRunnerLike,
  options: ClaimVendorInviteEmailLockOptions,
): Promise<VendorInviteEmailLockResult> {
  return db.runTransaction(async (transaction) => {
    const lockSnapshot = await transaction.get(options.lockRef);

    if (lockSnapshot.exists) {
      const existingApplicationId = String(lockSnapshot.data()?.['applicationId'] ?? '');

      if (existingApplicationId) {
        const existingRef = options.applicationsCollection.doc(existingApplicationId);
        const existingSnapshot = await transaction.get(existingRef);
        const existingStatus = String(existingSnapshot.data()?.['status'] ?? '');

        if (existingStatus === 'pending' || existingStatus === 'approved') {
          return {
            ok: false,
            conflict: { applicationId: existingApplicationId, status: existingStatus },
          };
        }
      }
    }

    transaction.create(options.newApplicationRef, options.newApplicationData);
    transaction.set(options.lockRef, { applicationId: options.newApplicationId });

    return { ok: true };
  });
}
