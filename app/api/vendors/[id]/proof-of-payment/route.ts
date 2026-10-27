import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { getStorageBucketName, initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { base64BodyLimitBytes, isBodyWithinLimit } from '@/lib/request-guards';
import { PROOF_OF_PAYMENT_MAX_BYTES } from '@/lib/vendor-payment';
import {
  handleProofOfPaymentUpload,
  type ProofOfPaymentHandlerResult,
} from '@/lib/vendor-proof-of-payment-handler';
import {
  createInMemoryProofOfPaymentRateLimitStore,
  decideProofOfPaymentRateLimit,
} from '@/lib/vendor-payment-rate-limit';

/** Mirrors the handler's own fallback -- decideProofOfPaymentRateLimit() always returns a
 *  non-null retryAfterMs when allowed is false, so this branch is defensive, not load-bearing. */
const PROOF_OF_PAYMENT_ROUTE_DEFAULT_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

const MAX_BODY_BYTES = base64BodyLimitBytes(PROOF_OF_PAYMENT_MAX_BYTES);

/**
 * POST /api/vendors/[id]/proof-of-payment -- PUBLIC, unauthenticated route (mission
 * vendor-registration F7). A vendor who has already submitted the registration form (F5) and
 * made an EFT payment uploads proof of payment against their own submission id, which they
 * received in the F5 confirmation email. Deliberately NOT capability-gated -- this is the
 * public-submitter half of the payment path; the office-use fields (booth number, payment
 * received) are recorded separately by an admin via the capability-gated
 * POST /api/admin/vendors/[id]/payment route, never here.
 *
 * Thin wrapper only -- every load-bearing property (rate-limit-shields-everything, the
 * non-enumerable existence posture, overwrite semantics) is proven against the pure
 * lib/vendor-proof-of-payment-handler.ts directly, never against this file. Contains no
 * validation, rate-limit-decision, or Firestore/Storage-shaping logic of its own -- see
 * contracts/golden/vendor-f7-payment-path/README.md.
 *
 * The in-memory rate-limit store is created once at module scope (mirrors F5's
 * app/api/vendors/register/route.ts exactly) -- survives warm invocations only, not a cold
 * start or a second Firebase App Hosting instance. See the golden README's "What this
 * contract does NOT prove".
 */

const rateLimitStore = createInMemoryProofOfPaymentRateLimitStore();

/** Rate-limit key derived from `x-forwarded-for` -- a documented best-effort abuse deterrent,
 *  not a security boundary. Mirrors F5's deriveRateLimitKey() exactly; see that route's own
 *  golden README for why lib/payfast.ts's getClientIp() is not reused here. */
function deriveRateLimitKey(request: NextRequest): string {
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  return `vendor-proof-of-payment-ip:${ip ?? 'unknown'}`;
}

function toResponse(result: ProofOfPaymentHandlerResult): NextResponse {
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.status === 429 && 'retryAfterMs' in result.body) {
    response.headers.set('Retry-After', String(Math.ceil(result.body.retryAfterMs / 1000)));
  }
  return response;
}

interface ProofOfPaymentRequestBody {
  fileName?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  fileBase64?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // Codex GPT-5.5 finding, 2026-09-01: `request.json()` below parses the entire request body
  // into memory BEFORE any rate-limit check ran, so the "rate-limit-shields-everything"
  // guarantee A14 proves against the pure handler never held at the real HTTP boundary -- a
  // blocked-by-rate-limit caller still paid the parsing cost on every request. The decision
  // (and its attempt record) now happens here, first, against the same rate-limit store the
  // handler itself would use, so a rate-limited caller's body is never even read. The response
  // shape below is byte-identical to what handleProofOfPaymentUpload() itself returns for a
  // 429. Once decided here, the handler is called with a no-op rate-limit dependency pair
  // (getPriorAttempts always empty, recordAttempt a no-op) so the real store is never
  // double-recorded for the same request.
  const rateLimitKey = deriveRateLimitKey(request);
  const now = new Date();
  const rateLimitDecision = decideProofOfPaymentRateLimit(
    rateLimitKey,
    now,
    rateLimitStore.getPriorAttempts(rateLimitKey),
  );
  rateLimitStore.recordAttempt(rateLimitKey, now);

  if (!rateLimitDecision.allowed) {
    return toResponse({
      status: 429,
      body: {
        error: 'Too many proof-of-payment upload attempts. Please try again later.',
        retryAfterMs: rateLimitDecision.retryAfterMs ?? PROOF_OF_PAYMENT_ROUTE_DEFAULT_RETRY_AFTER_MS,
      },
    });
  }

  // A base64 file is ~4/3 of its decoded size, so the body cap is derived from the file cap. The
  // header is checked before request.json() buffers the body; a missing header is refused too.
  if (!isBodyWithinLimit(request.headers.get('content-length'), MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }

  let body: ProofOfPaymentRequestBody;
  try {
    body = (await request.json()) as ProofOfPaymentRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!getStorageBucketName()) {
    console.error(
      '[vendors/[id]/proof-of-payment/route] Storage bucket not configured; upload refused. ' +
        'Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.',
    );
    return NextResponse.json({ error: 'File upload is temporarily unavailable.' }, { status: 500 });
  }

  const db = getFirestore(initAdmin());

  const result = await handleProofOfPaymentUpload(
    {
      submissionId: id,
      fileName: typeof body.fileName === 'string' ? body.fileName : '',
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : '',
      sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : -1,
      fileBase64: typeof body.fileBase64 === 'string' ? body.fileBase64 : '',
    },
    {
      now,
      rateLimitKey,
      getPriorAttempts: () => [],
      recordAttempt: () => {},
      submissionExists: async (submissionId) => {
        const snapshot = await db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(submissionId).get();
        return snapshot.exists;
      },
      uploadFile: async (plan, fileBase64, mimeType) => {
        const bucket = getStorage(initAdmin()).bucket();
        const file = bucket.file(plan.storagePath);
        await file.save(Buffer.from(fileBase64, 'base64'), { contentType: mimeType });
      },
      updateSubmission: async (submissionId, patch) => {
        await db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(submissionId).update(patch);
      },
    },
  );

  return toResponse(result);
}
