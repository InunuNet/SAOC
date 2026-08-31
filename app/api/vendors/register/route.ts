import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import { verifyVendorRegistrationToken } from '@/lib/vendor-registration-token';
import { VENDOR_REGISTRATION_SESSION_COOKIE_NAME } from '@/lib/vendor-registration-code-verify-handler';
import {
  claimRegistrationToken,
  releaseRegistrationTokenClaim,
} from '@/lib/vendor-registration-token-claim';
import {
  handleVendorRegistration,
  type VendorRegistrationHandlerResult,
} from '@/lib/vendor-registration-handler';
import { createInMemoryVendorRegistrationRateLimitStore } from '@/lib/vendor-registration-rate-limit';
import { sendVendorRegistrationConfirmationEmail } from '@/lib/vendor-registration-confirmation';

/**
 * POST /api/vendors/register -- gated, single-use vendor submission route (mission
 * vendor-registration F5, gated by vendor-gated-registration-flow F7). See
 * contracts/golden/vendor-f5-register-route/README.md for the original decision record and
 * contracts/golden/vendor-gated-registration-flow-f1/README.md for the F7 gating addition.
 *
 * F7/M1, REPOINTED by F23/M4: this route no longer accepts a vendor-typed token/code in its
 * request body. It instead requires the internal, HttpOnly `vendor_registration_session`
 * cookie (minted by POST /api/vendors/register/verify-code the moment the human-readable code
 * verifies -- see contracts/golden/vendor-gated-registration-flow-m4/README.md's "Migration")
 * and RE-VERIFIES it here, server-side -- never trusting that the page-level check
 * (app/(marketing)/national-show/vendors/register/page.tsx) already ran, since a direct POST
 * bypassing the browser must be gated exactly like the page. Every failure mode -- missing
 * cookie, malformed, bad signature, expired, application not found, wrong status, already
 * consumed -- returns the SAME generic message, never a distinguishing error (same fail-closed
 * posture as lib/admin-auth.ts's unenumerated-state handling). F3's HMAC module itself is
 * unchanged by this repointing -- only the transport (cookie, not a body/query field) and the
 * caller (the verify-code route, not the vendor's browser directly) changed. A stateless HMAC
 * token is replayable until expiry by construction, so single-use is enforced by a server-side
 * `registrationTokenConsumedAt` timestamp on the linked VendorApplication doc -- not by the
 * token format.
 *
 * That timestamp is CLAIMED ATOMICALLY, in a `db.runTransaction()` that reads the application,
 * re-checks status/consumed state, and writes the claim in the same transaction -- BEFORE the
 * submission write runs. A read-then-later-write would let two concurrent POSTs with the same
 * token (double-click, browser retry, deliberate replay) both pass the check before either
 * consumed it, and both complete a full vendorSubmissions write. The transaction makes the
 * loser fail at the claim, before any write happens, with the same generic 403 -- never a 500
 * and never a partial submission. Same transactional-claim shape as
 * app/api/tickets/checkout/route.ts's own reserve, and for the same reason; the transaction is
 * opened in lib/vendor-registration-token-claim.ts and NOT around handleVendorRegistration,
 * since Firestore transactions cannot be nested and must not wrap the long, retry-unsafe
 * submission write.
 *
 * If the submission then fails (validation, rate limit, write error) the claim is RELEASED
 * back to null so a legitimate vendor can correct and retry -- a token must not be burnt by a
 * rejected submission. The only residual window is a process death between claim and release,
 * which leaves the token consumed: fail-closed, recoverable only by an operator, and strictly
 * preferable to a replayable token.
 *
 * Every load-bearing property of the underlying F5 write/validate/email flow (no parallel
 * validation, commit-before-email, rate-limit-shields-write, zero authorization meaning, no
 * PII in logs) is still proven against the pure lib/vendor-registration-handler.ts directly,
 * unchanged by F7 -- this route adds a gate in front of that flow, it does not alter it.
 *
 * The in-memory rate-limit store is created once at module scope, so it survives warm
 * invocations only -- not persistent across a cold start or multiple Firebase App Hosting
 * instances. See the golden README's "What this contract does NOT prove".
 */

const rateLimitStore = createInMemoryVendorRegistrationRateLimitStore();

const GENERIC_INVALID_TOKEN_MESSAGE = 'This registration link is no longer valid.';

/**
 * Rate-limit key derived from the request's `x-forwarded-for` header -- a documented
 * best-effort abuse deterrent, not a security boundary. This route has zero auth by design, so
 * there is no stable per-caller identity besides network origin, and `x-forwarded-for`'s first
 * hop is client-supplied and therefore spoofable by a direct caller who sets the header itself.
 * lib/payfast.ts's getClientIp() is deliberately NOT reused here -- it trusts PayFast's own
 * known, fixed proxy topology (reading the second-to-last hop), and no such fixed,
 * known-trustworthy proxy chain is documented for Firebase App Hosting in this repo. See the
 * golden README's "Judgement calls" for the full reasoning.
 */
function deriveRateLimitKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstHop = forwardedFor?.split(',')[0]?.trim();
  return `vendor-register-ip:${firstHop || 'unknown'}`;
}

function toResponse(result: VendorRegistrationHandlerResult): NextResponse {
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.status === 429 && 'retryAfterMs' in result.body) {
    response.headers.set('Retry-After', String(Math.ceil(result.body.retryAfterMs / 1000)));
  }
  return response;
}

function invalidTokenResponse(): NextResponse {
  return NextResponse.json({ error: GENERIC_INVALID_TOKEN_MESSAGE }, { status: 403 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  if (typeof rawBody !== 'object' || rawBody === null) {
    return invalidTokenResponse();
  }

  const vendorSubmissionInput = rawBody as Record<string, unknown>;

  const secret = process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/register/route] VENDOR_REGISTRATION_TOKEN_SECRET is unset; refusing all registrations.',
    );
    return invalidTokenResponse();
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(VENDOR_REGISTRATION_SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return invalidTokenResponse();
  }

  const now = new Date();
  const verification = verifyVendorRegistrationToken({ token: sessionToken, secret, now });
  if (!verification.ok) {
    return invalidTokenResponse();
  }

  // A session must name the code generation it was minted from. A token without one predates
  // generation binding and cannot be checked against a reissue, so it is refused -- fail
  // closed, same generic response as every other refusal.
  if (verification.generation === null) {
    return invalidTokenResponse();
  }

  initAdmin();
  const db = getFirestore();
  const applicationRef = db.collection(VENDOR_APPLICATIONS_COLLECTION).doc(verification.applicationId);

  const claimed = await claimRegistrationToken(db, applicationRef, {
    consumedAt: Timestamp.fromDate(now),
    // Checked inside the claim transaction: a session minted from a code that has since been
    // reissued names a stale generation and is refused before any write happens.
    expectedGeneration: verification.generation,
    onError: (error) => {
      console.error(
        '[vendors/register/route] Failed to claim the registration token:',
        error instanceof Error ? error.message : 'unknown error',
      );
    },
  });
  if (!claimed) {
    return invalidTokenResponse();
  }

  const result = await handleVendorRegistration(vendorSubmissionInput, {
    now,
    rateLimitKey: deriveRateLimitKey(request),
    getPriorAttempts: (key) => rateLimitStore.getPriorAttempts(key),
    recordAttempt: (key, at) => rateLimitStore.recordAttempt(key, at),
    write: async (doc) => {
      const ref = await db
        .collection(VENDOR_SUBMISSIONS_COLLECTION)
        .add({ ...doc, submittedAt: Timestamp.fromDate(doc.submittedAt) });
      return { id: ref.id };
    },
    sendConfirmationEmail: (input) => sendVendorRegistrationConfirmationEmail(input),
    onEmailError: (error) => {
      console.error(
        '[vendors/register/route] Confirmation email failed (non-fatal):',
        error instanceof Error ? error.message : 'unknown error',
      );
    },
  });

  // The claim above is what enforces single-use. It only needs releasing when the submission
  // did NOT succeed, so a rejected attempt (validation, rate limit) does not burn the vendor's
  // one-time link.
  if (result.status !== 201) {
    await releaseRegistrationTokenClaim(applicationRef, (error) => {
      console.error(
        '[vendors/register/route] Failed to release the registration token claim:',
        error instanceof Error ? error.message : 'unknown error',
      );
    });
  } else {
    // The session cookie's one job is done -- clear it so a stray reload of the (now
    // consumed) register page falls back to the code-entry form instead of a stale cookie
    // lingering for its full 30-minute life. registrationTokenConsumedAt is what actually
    // enforces single-use; this is hygiene, not the security boundary.
    cookieStore.delete(VENDOR_REGISTRATION_SESSION_COOKIE_NAME);
  }

  return toResponse(result);
}
