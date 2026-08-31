/**
 * Pure handler behind POST /api/vendors/register/verify-code (mission
 * vendor-gated-registration-flow, M4/F23). Same injected-deps shape as
 * lib/vendor-registration-handler.ts (F5/M1), so rate-limit-shields-I/O and response-shape are
 * provable without a Firestore instance. See
 * contracts/golden/vendor-gated-registration-flow-m4/README.md for the full decision record.
 *
 * POPIA finding (see the golden README): the response body is byte-identical in shape on
 * success (`{ok:true}`) and on every failure branch (the one generic error string) --  never
 * containing any VendorApplication field. The session artifact minted on success travels ONLY
 * as a separate `sessionToken`/`sessionExpiresAt` result field, never serialised into `body` --
 * the route layer is responsible for setting it as an HttpOnly cookie.
 */

import { normalizeVendorCodeName, verifyVendorRegistrationCode } from './vendor-registration-code';
import type { VendorRegistrationCodeCandidate } from './vendor-registration-code';
import { decideVendorRegistrationCodeVerifyRateLimit } from './vendor-registration-code-verify-rate-limit';

/** Deliberately generic: no such name slug, wrong 4 digits, locked, consumed, expired, or
 *  not-approved all funnel into this ONE message, at the same 403 status -- see the golden
 *  README's "Enumeration blindness". The "call the show office" clause is baked into the copy
 *  itself (not conditional on lock state) so a genuinely locked-out vendor has a recovery path
 *  without the response ever revealing that lock state exists. */
export const GENERIC_CODE_VERIFICATION_ERROR_MESSAGE =
  "That code didn't match. Double-check the business name and 4-digit code, or call the show office.";

const RATE_LIMITED_MESSAGE = 'Too many attempts. Please wait before trying again, or call the show office.';

/** The internal, HttpOnly-cookie-delivered session artifact -- F3's HMAC token, repointed to a
 *  new role. The cookie NAME is defined here (rather than in the route) so the register page,
 *  the verify-code route, and the register route all read/write the same single constant. */
export const VENDOR_REGISTRATION_SESSION_COOKIE_NAME = 'vendor_registration_session';

/** 30-minute internal session, NOT the 14-day vendor-facing code TTL -- see the golden
 *  README's "Migration". */
export const VENDOR_REGISTRATION_SESSION_TTL_MS = 30 * 60 * 1000;

export interface VendorRegistrationCodeVerificationInput {
  businessName: string;
  codeId: string;
}

export interface MintedVendorRegistrationSession {
  token: string;
  expiresAt: Date;
}

export interface VendorRegistrationCodeVerificationDeps {
  now: Date;
  rateLimitKey: string;
  getPriorAttempts: (key: string) => { key: string; at: Date }[];
  recordAttempt: (key: string, at: Date) => void;
  /** Runs the ONE Firestore query by registrationCodeNameSlug + status=='approved', ALWAYS
   *  executed regardless of outcome -- no query-skipping branch for a not-obviously-real name
   *  (see the golden README's "Enumeration blindness"). */
  findCandidates: (normalizedNameSlug: string) => Promise<VendorRegistrationCodeCandidate[]>;
  recordFailedAttempt: (applicationId: string) => Promise<void>;
  mintSession: (applicationId: string) => MintedVendorRegistrationSession;
}

export type VendorRegistrationCodeVerificationResult =
  | { status: 429; body: { error: string } }
  | { status: 403; body: { error: string } }
  | { status: 200; body: { ok: true }; sessionToken: string; sessionExpiresAt: Date };

export async function handleVendorRegistrationCodeVerification(
  input: VendorRegistrationCodeVerificationInput,
  deps: VendorRegistrationCodeVerificationDeps,
): Promise<VendorRegistrationCodeVerificationResult> {
  // Rate limiting FIRST, before any Firestore lookup -- shields the write/read path exactly
  // like lib/vendor-registration-handler.ts's own rate-limit-shields-write rule.
  // deps.getPriorAttempts(key) is contractually already scoped to that key (the real
  // in-memory store filters on it) -- re-keyed here defensively so decideRateLimit's own
  // per-record key filter can never silently disagree with the scoping getPriorAttempts
  // already performed.
  const priorAttempts = deps
    .getPriorAttempts(deps.rateLimitKey)
    .map((attempt) => ({ key: deps.rateLimitKey, at: attempt.at }));
  const rateLimitDecision = decideVendorRegistrationCodeVerifyRateLimit(
    deps.rateLimitKey,
    deps.now,
    priorAttempts,
  );
  if (!rateLimitDecision.allowed) {
    return { status: 429, body: { error: RATE_LIMITED_MESSAGE } };
  }
  deps.recordAttempt(deps.rateLimitKey, deps.now);

  const typedNameSlug = normalizeVendorCodeName(input.businessName);
  const typedCodeId = input.codeId;

  const candidates = await deps.findCandidates(typedNameSlug);
  const verification = verifyVendorRegistrationCode(
    { typedNameSlug, typedCodeId },
    candidates,
    deps.now,
  );

  if (!verification.ok) {
    // A failed guess records against every candidate this slug matched -- so the
    // per-application lockout counter actually advances, even if the vendor typed the wrong
    // 4 digits against a real business name.
    await Promise.all(candidates.map((candidate) => deps.recordFailedAttempt(candidate.id)));
    return { status: 403, body: { error: GENERIC_CODE_VERIFICATION_ERROR_MESSAGE } };
  }

  const session = deps.mintSession(verification.applicationId);
  return {
    status: 200,
    body: { ok: true },
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  };
}
