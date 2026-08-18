import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import {
  handleVendorRegistration,
  type VendorRegistrationHandlerResult,
} from '@/lib/vendor-registration-handler';
import { createInMemoryVendorRegistrationRateLimitStore } from '@/lib/vendor-registration-rate-limit';
import { sendVendorRegistrationConfirmationEmail } from '@/lib/vendor-registration-confirmation';

/**
 * POST /api/vendors/register -- public, unauthenticated vendor submission route (mission
 * vendor-registration F5). See contracts/golden/vendor-f5-register-route/README.md for the
 * full decision record.
 *
 * Thin wrapper only -- every load-bearing property (no parallel validation,
 * commit-before-email, rate-limit-shields-write, zero authorization meaning, no PII in logs)
 * is proven against the pure lib/vendor-registration-handler.ts directly, never against this
 * file. Contains no validation, build, or email-content logic of its own.
 *
 * The in-memory rate-limit store is created once at module scope, so it survives warm
 * invocations only -- not persistent across a cold start or multiple Firebase App Hosting
 * instances. See the golden README's "What this contract does NOT prove".
 */

const rateLimitStore = createInMemoryVendorRegistrationRateLimitStore();

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  const result = await handleVendorRegistration(rawInput, {
    now: new Date(),
    rateLimitKey: deriveRateLimitKey(request),
    getPriorAttempts: (key) => rateLimitStore.getPriorAttempts(key),
    recordAttempt: (key, at) => rateLimitStore.recordAttempt(key, at),
    write: async (doc) => {
      initAdmin();
      const ref = await getFirestore()
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

  return toResponse(result);
}
