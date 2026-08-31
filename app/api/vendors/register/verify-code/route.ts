import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import {
  recordFailedVendorRegistrationCodeAttempt,
  type VendorRegistrationCodeCandidate,
} from '@/lib/vendor-registration-code';
import {
  handleVendorRegistrationCodeVerification,
  VENDOR_REGISTRATION_SESSION_COOKIE_NAME,
  VENDOR_REGISTRATION_SESSION_TTL_MS,
} from '@/lib/vendor-registration-code-verify-handler';
import { createInMemoryVendorRegistrationCodeVerifyRateLimitStore } from '@/lib/vendor-registration-code-verify-rate-limit';
import { mintVendorRegistrationToken } from '@/lib/vendor-registration-token';

/**
 * POST /api/vendors/register/verify-code -- public, rate-limited entry point for the
 * human-readable vendor registration code (mission vendor-gated-registration-flow, M4/F23).
 * See contracts/golden/vendor-gated-registration-flow-m4/README.md for the full decision
 * record. Thin route wrapper around the pure lib/vendor-registration-code-verify-handler.ts --
 * this file's only jobs are: derive the rate-limit key, wire up the real Firestore lookup and
 * lockout-attempt writer, mint the internal session via F3's HMAC module, and translate the
 * handler's result into an HTTP response + HttpOnly cookie.
 *
 * The session artifact NEVER appears in the JSON response body (POPIA finding, see the golden
 * README) -- it is set here as an HttpOnly, Secure, SameSite=Strict cookie with a 30-minute
 * lifetime, matching the internal ttlMs override passed to mintVendorRegistrationToken.
 *
 * M4 fix pass, two corrections: (1) the already-consumed check now reads the SAME field the
 * register route's transactional claim writes (see toCandidate below); (2) the minted session
 * carries the application's current registrationCodeGeneration, so reissuing a code revokes
 * every session already handed out against the old one.
 */

const rateLimitStore = createInMemoryVendorRegistrationCodeVerifyRateLimitStore();

/**
 * Same rate-limit-key derivation rationale as app/api/vendors/register/route.ts's own
 * deriveRateLimitKey() -- a documented best-effort abuse deterrent, not a security boundary.
 * Distinct key namespace (`vendor-register-code-verify-ip:*`) from the register route's own
 * (`vendor-register-ip:*`).
 */
function deriveRateLimitKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstHop = forwardedFor?.split(',')[0]?.trim();
  return `vendor-register-code-verify-ip:${firstHop || 'unknown'}`;
}

/**
 * M4 fix pass -- the candidate's `registrationCodeConsumedAt` slot is fed from the
 * application's `registrationTokenConsumedAt` field, which is the ONE field of record for
 * single-use. That field is what F7's proven transactional claim
 * (lib/vendor-registration-token-claim.ts, atomicity proven by
 * check-single-use-claim-is-atomic.mjs) writes on a successful registration, and what the
 * register page's own gate reads. This route previously read `registrationCodeConsumedAt`
 * instead -- a field NOTHING has ever written -- so an already-used code still verified and
 * this endpoint still returned `{ok:true}`, silently undoing single-use.
 *
 * `registrationCodeConsumedAt` is still read as a fallback purely so that a document which
 * somehow carries only the legacy field is still treated as consumed (fail closed). It is
 * never written by any code path; the authoritative value is always the token field, read
 * first. The candidate INTERFACE keeps its existing key name -- renaming it is a mechanical
 * change across lib/vendor-registration-code.ts and its contract checks, not part of this fix.
 */
function toCandidate(doc: FirebaseFirestore.QueryDocumentSnapshot): VendorRegistrationCodeCandidate {
  const data = doc.data();
  return {
    id: doc.id,
    status: typeof data.status === 'string' ? data.status : '',
    registrationCodeId: typeof data.registrationCodeId === 'string' ? data.registrationCodeId : null,
    registrationCodeNameSlug:
      typeof data.registrationCodeNameSlug === 'string' ? data.registrationCodeNameSlug : null,
    registrationCodeExpiresAt: data.registrationCodeExpiresAt?.toDate?.() ?? null,
    registrationCodeConsumedAt:
      data.registrationTokenConsumedAt?.toDate?.() ?? data.registrationCodeConsumedAt?.toDate?.() ?? null,
    registrationCodeLockedAt: data.registrationCodeLockedAt?.toDate?.() ?? null,
  };
}

/** Mirrors lib/vendor-registration-token-claim.ts's own readGeneration(): absent/non-numeric
 *  normalises to 0, so an application approved before generations existed still verifies. */
function readGeneration(data: FirebaseFirestore.DocumentData): number {
  const raw = data.registrationCodeGeneration;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  if (
    typeof rawBody !== 'object' ||
    rawBody === null ||
    typeof (rawBody as Record<string, unknown>).businessName !== 'string' ||
    typeof (rawBody as Record<string, unknown>).codeId !== 'string'
  ) {
    return NextResponse.json({ error: 'businessName and codeId are required.' }, { status: 400 });
  }

  const { businessName, codeId } = rawBody as { businessName: string; codeId: string };

  const secret = process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/register/verify-code] VENDOR_REGISTRATION_TOKEN_SECRET is unset; refusing all code verifications.',
    );
    return NextResponse.json(
      { error: "That code didn't match. Double-check the business name and 4-digit code, or call the show office." },
      { status: 403 },
    );
  }

  initAdmin();
  const db = getFirestore();
  const now = new Date();

  // Populated by findCandidates below, so mintSession (which is synchronous and receives only
  // an applicationId) can bind the session to the code generation THIS verification saw --
  // without a second Firestore read. Request-scoped, never module-scoped.
  const generationsById = new Map<string, number>();

  const result = await handleVendorRegistrationCodeVerification(
    { businessName, codeId },
    {
      now,
      rateLimitKey: deriveRateLimitKey(request),
      getPriorAttempts: (key) => rateLimitStore.getPriorAttempts(key),
      recordAttempt: (key, at) => rateLimitStore.recordAttempt(key, at),
      findCandidates: async (normalizedNameSlug) => {
        const snapshot = await db
          .collection(VENDOR_APPLICATIONS_COLLECTION)
          .where('registrationCodeNameSlug', '==', normalizedNameSlug)
          .where('status', '==', 'approved')
          .get();
        generationsById.clear();
        for (const doc of snapshot.docs) {
          generationsById.set(doc.id, readGeneration(doc.data()));
        }
        return snapshot.docs.map(toCandidate);
      },
      recordFailedAttempt: async (applicationId) => {
        const ref = db.collection(VENDOR_APPLICATIONS_COLLECTION).doc(applicationId);
        await recordFailedVendorRegistrationCodeAttempt(db, ref, {
          attemptedAt: Timestamp.fromDate(now),
          onError: (error) => {
            console.error(
              '[vendors/register/verify-code] Failed to record a failed code attempt:',
              error instanceof Error ? error.message : 'unknown error',
            );
          },
        });
      },
      mintSession: (applicationId) =>
        mintVendorRegistrationToken({
          applicationId,
          secret,
          now,
          ttlMs: VENDOR_REGISTRATION_SESSION_TTL_MS,
          // Binds this session to the code generation it was minted from. A later reissue
          // bumps that generation and every session carrying the old one stops working.
          generation: generationsById.get(applicationId) ?? 0,
        }),
    },
  );

  const response = NextResponse.json(result.body, { status: result.status });

  if (result.status === 200) {
    const cookieStore = await cookies();
    cookieStore.set(VENDOR_REGISTRATION_SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'strict',
      maxAge: Math.floor(VENDOR_REGISTRATION_SESSION_TTL_MS / 1000),
    });
  }

  return response;
}
