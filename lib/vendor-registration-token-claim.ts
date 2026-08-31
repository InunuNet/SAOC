/**
 * Atomic single-use claim for a vendor registration token (mission
 * vendor-gated-registration-flow, M1 fix pass). Lives here rather than inline in
 * app/api/vendors/register/route.ts so the claim's concurrency behaviour can be exercised
 * directly by a contract check, without a Firestore instance.
 *
 * The defect this closes: the route previously did `ref.get()` -> check status/consumed ->
 * run the full submission write -> `ref.update({consumedAt})`. Two concurrent POSTs bearing
 * the same valid token both passed the check before either reached the update, and both
 * completed a full vendorSubmissions write. Read, check and write now happen inside ONE
 * transaction, so exactly one caller can win.
 *
 * Same "deliberately narrow structural interface" approach as lib/checkout-reservation.ts's
 * CreateCapableTransactionLike: the interfaces below describe ONLY the firebase-admin methods
 * this module calls, which is what lets the REAL Firestore/Transaction/DocumentReference
 * classes satisfy them with zero adapter code. The transaction is opened HERE and does NOT
 * wrap the submission write -- Firestore transactions cannot be nested, and a transaction
 * callback may be retried, so the long, retry-unsafe submission must stay outside it.
 */

/** Only the two reads the claim performs on the application snapshot. */
export interface ApplicationSnapshotLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface ClaimTransactionLike {
  get(ref: unknown): Promise<ApplicationSnapshotLike>;
  update(ref: unknown, data: Record<string, unknown>): unknown;
}

export interface ClaimRunnerLike {
  runTransaction<T>(updateFunction: (transaction: ClaimTransactionLike) => Promise<T>): Promise<T>;
}

export interface ClaimDocumentRefLike {
  update(data: Record<string, unknown>): Promise<unknown>;
}

export interface ClaimRegistrationTokenOptions {
  /** Timestamp value written to `registrationTokenConsumedAt`. The caller converts its own
   *  `now` into whatever Firestore representation it uses -- this module never constructs a
   *  Timestamp itself, keeping it free of a firebase-admin import. */
  consumedAt: unknown;
  /**
   * M4 fix pass -- the registration-code generation the caller's session was minted from. When
   * supplied, the claim ALSO refuses unless it equals the application's current
   * `registrationCodeGeneration` (absent field normalised to 0), so a session minted from a
   * code that has since been reissued cannot be claimed. Checked INSIDE the transaction, on
   * the snapshot the claim already reads -- no extra read, and no window between the check and
   * the claim.
   *
   * Optional only because the M1 atomicity contract check
   * (contracts/checks/vendor-gated-registration-flow/check-single-use-claim-is-atomic.mjs)
   * calls this function with the pre-generation option shape; omitting it means "do not check
   * the generation", never "any generation matches". Every production call site
   * (app/api/vendors/register/route.ts) supplies it.
   */
  expectedGeneration?: number;
  onError?: (error: unknown) => void;
}

/** Absent/non-numeric `registrationCodeGeneration` normalises to 0 -- an application approved
 *  before generations existed is generation 0, and its first reissue bumps it to 1. */
function readGeneration(data: Record<string, unknown> | undefined): number {
  const raw = data?.['registrationCodeGeneration'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * Reads the application, re-checks that it exists, is `approved`, has NOT already been
 * consumed, and (when `expectedGeneration` is supplied) still carries the registration-code
 * generation the caller's session was minted from, then writes `registrationTokenConsumedAt`
 * -- all inside one transaction. Additive
 * only: a single-key `transaction.update()`, never a full-document overwrite.
 *
 * Returns `true` for the one winner; `false` for every loser and every ineligible application.
 * A transaction failure is reported through `onError` and treated as a refusal -- fail closed,
 * never as a claim.
 */
export async function claimRegistrationToken(
  db: ClaimRunnerLike,
  applicationRef: ClaimDocumentRefLike,
  options: ClaimRegistrationTokenOptions,
): Promise<boolean> {
  try {
    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(applicationRef);
      const data = snapshot.data();

      if (
        !snapshot.exists ||
        data?.['status'] !== 'approved' ||
        Boolean(data?.['registrationTokenConsumedAt'])
      ) {
        return false;
      }

      if (
        options.expectedGeneration !== undefined &&
        readGeneration(data) !== options.expectedGeneration
      ) {
        return false;
      }

      transaction.update(applicationRef, { registrationTokenConsumedAt: options.consumedAt });
      return true;
    });
  } catch (error) {
    options.onError?.(error);
    return false;
  }
}

/**
 * Releases a claim when the submission that followed it did not succeed, so a vendor whose
 * form was rejected (validation, rate limit) can correct it and retry the same link -- a
 * rejected submission must not burn a one-time token. Written as `null` rather than deleted,
 * so the field stays present and the claim's own `Boolean()` check reads it as unconsumed.
 *
 * Never throws: the caller still owes the submitter its real response, and the worst case is a
 * token left consumed, which is fail-closed and operator-recoverable.
 */
export async function releaseRegistrationTokenClaim(
  applicationRef: ClaimDocumentRefLike,
  onError?: (error: unknown) => void,
): Promise<void> {
  try {
    await applicationRef.update({ registrationTokenConsumedAt: null });
  } catch (error) {
    onError?.(error);
  }
}
