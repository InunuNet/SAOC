import { randomInt } from 'node:crypto';

import { constantTimeEqual } from './recovery-token';
import { VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS } from './vendor-registration-token';
import type {
  ClaimDocumentRefLike,
  ClaimRunnerLike,
} from './vendor-registration-token-claim';

/**
 * Human-readable vendor registration code (mission vendor-gated-registration-flow, M4/F22).
 * See contracts/golden/vendor-gated-registration-flow-m4/README.md for the full decision
 * record -- why a 4-digit code is safe by construction, why the code is stored in cleartext,
 * and the threshold reasoning below.
 *
 * Pure mechanism module: normalizeVendorCodeName() and verifyVendorRegistrationCode() are
 * side-effect-free (no Firestore, no network, no Date.now()/new Date() call). The one I/O
 * function, recordFailedVendorRegistrationCodeAttempt(), takes an injected Firestore-like
 * transaction runner, mirroring lib/vendor-registration-token-claim.ts's
 * claimRegistrationToken() shape exactly -- same structural interfaces, reused rather than
 * redefined.
 */

/** 5 failed attempts locks the application (per-application, not per-IP -- see the golden
 *  README's "Verification, rate limiting, and lockout thresholds" for the full reasoning: at
 *  5 attempts against a 10,000-value space, an attacker gets at most a 0.05% chance of success
 *  before locking). No auto-expiry -- only an operator reissue (F25) clears a lockout. */
export const VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD = 5;

/** Reuses the exact 14-day value already used for VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS --
 *  the vendor-facing TTL is unchanged by this mission; only what gets issued changes. */
export const VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS = VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS;

/**
 * Deterministic slug normalisation, applied identically at code-issue time (from
 * `businessName`) and at verify time (from whatever the vendor typed). Lowercases,
 * Unicode-NFD-normalises and strips combining marks (handles accents), then strips every
 * character that is not `[a-z0-9]`. Never fuzzy -- two different names never normalise to the
 * same slug, so this cannot widen the 4-digit guess space. See
 * contracts/golden/vendor-gated-registration-flow-m4/vendor-registration-code-name-normalization.expected.md
 * for the exact test table.
 */
export function normalizeVendorCodeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * CSPRNG code generation -- zero arguments, node:crypto's randomInt (never a non-cryptographic
 * PRNG), zero-padded to 4 digits. Never a function of applicationId, an incrementing counter, or the
 * current timestamp: a sequential or derived code would make guessing trivial regardless of
 * every rate limit this module also provides. Codes are not required to be globally unique
 * across all applications -- see the golden README's "Why two vendors can share a 4-digit
 * code, safely".
 */
export function generateVendorRegistrationCodeId(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/** The subset of a VendorApplication a verification/lockout decision needs -- deliberately
 *  narrow, same "structural interface" approach as lib/vendor-registration-token-claim.ts's
 *  ApplicationSnapshotLike. */
export interface VendorRegistrationCodeCandidate {
  id: string;
  status: string;
  registrationCodeId: string | null | undefined;
  registrationCodeNameSlug: string | null | undefined;
  registrationCodeExpiresAt: Date | null | undefined;
  registrationCodeConsumedAt: Date | null | undefined;
  registrationCodeLockedAt: Date | null | undefined;
}

export interface VerifyVendorRegistrationCodeInput {
  /** Already normalised via normalizeVendorCodeName() by the caller -- this function does not
   *  normalise again. */
  typedNameSlug: string;
  typedCodeId: string;
}

export type VerifyVendorRegistrationCodeResult =
  | { ok: true; applicationId: string }
  | { ok: false };

function isEligibleCandidate(
  candidate: VendorRegistrationCodeCandidate,
  typedNameSlug: string,
  now: Date,
): boolean {
  if (candidate.registrationCodeNameSlug !== typedNameSlug) return false;
  if (candidate.status !== 'approved') return false;
  if (candidate.registrationCodeLockedAt) return false;
  if (candidate.registrationCodeConsumedAt) return false;
  if (!candidate.registrationCodeExpiresAt) return false;
  if (now.getTime() >= candidate.registrationCodeExpiresAt.getTime()) return false;
  if (!candidate.registrationCodeId) return false;
  return true;
}

/**
 * Pure verification over caller-supplied candidates (the caller already ran ONE Firestore
 * query by registrationCodeNameSlug, regardless of outcome -- see the golden README's
 * "Enumeration blindness"). Succeeds ONLY for an approved/unlocked/unconsumed/unexpired
 * candidate whose code matches; every failure path -- no candidate, wrong code, locked,
 * consumed, expired, not-approved, never-issued -- returns the exact same `{ok: false}` shape,
 * no reason field, so a caller cannot distinguish why verification failed from the return
 * value alone. Digit comparison reuses constantTimeEqual from lib/recovery-token.ts -- a short
 * secret is still a secret, and a length/early-exit timing difference must not leak which
 * digit position first diverges.
 */
export function verifyVendorRegistrationCode(
  input: VerifyVendorRegistrationCodeInput,
  candidates: VendorRegistrationCodeCandidate[],
  now: Date,
): VerifyVendorRegistrationCodeResult {
  const typedBuffer = Buffer.from(input.typedCodeId, 'utf8');

  for (const candidate of candidates) {
    if (!isEligibleCandidate(candidate, input.typedNameSlug, now)) continue;

    const storedBuffer = Buffer.from(candidate.registrationCodeId as string, 'utf8');
    if (constantTimeEqual(typedBuffer, storedBuffer)) {
      return { ok: true, applicationId: candidate.id };
    }
  }

  return { ok: false };
}

export interface RecordFailedVendorRegistrationCodeAttemptOptions {
  /** Timestamp value written to `registrationCodeLockedAt` when this attempt crosses the
   *  threshold. The caller converts its own `now` into whatever Firestore representation it
   *  uses -- this module never constructs a Timestamp itself, mirroring
   *  lib/vendor-registration-token-claim.ts's claimRegistrationToken() `consumedAt` option. */
  attemptedAt: unknown;
  onError?: (error: unknown) => void;
}

export interface RecordFailedVendorRegistrationCodeAttemptResult {
  locked: boolean;
}

/**
 * Transactional, race-safe failed-attempt counter: reads the candidate application, increments
 * `registrationCodeFailedAttempts`, and sets `registrationCodeLockedAt` on crossing
 * VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD -- all inside one `db.runTransaction()`, mirroring
 * lib/vendor-registration-token-claim.ts's `claimRegistrationToken()` shape exactly, so
 * concurrent failed guesses against the same application cannot race past the counter (no
 * lost update). A transaction failure is reported through `onError` and treated as an
 * unlocked, non-incrementing no-op -- fail-closed on the write, never a thrown 500.
 */
export async function recordFailedVendorRegistrationCodeAttempt(
  db: ClaimRunnerLike,
  applicationRef: ClaimDocumentRefLike,
  options: RecordFailedVendorRegistrationCodeAttemptOptions,
): Promise<RecordFailedVendorRegistrationCodeAttemptResult> {
  try {
    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(applicationRef);
      const data = snapshot.data() ?? {};

      const currentAttempts =
        typeof data['registrationCodeFailedAttempts'] === 'number'
          ? (data['registrationCodeFailedAttempts'] as number)
          : 0;
      const nextAttempts = currentAttempts + 1;
      const locked = nextAttempts >= VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD;

      const patch: Record<string, unknown> = { registrationCodeFailedAttempts: nextAttempts };
      if (locked) {
        patch['registrationCodeLockedAt'] = options.attemptedAt;
      }

      transaction.update(applicationRef, patch);
      return { locked };
    });
  } catch (error) {
    options.onError?.(error);
    return { locked: false };
  }
}
