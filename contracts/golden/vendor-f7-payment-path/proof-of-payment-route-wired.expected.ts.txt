import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import {
  handleProofOfPaymentUpload,
  type ProofOfPaymentHandlerResult,
} from '@/lib/vendor-proof-of-payment-handler';
import { createInMemoryProofOfPaymentRateLimitStore } from '@/lib/vendor-payment-rate-limit';

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
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstHop = forwardedFor?.split(',')[0]?.trim();
  return `vendor-proof-of-payment-ip:${firstHop || 'unknown'}`;
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

  let body: ProofOfPaymentRequestBody;
  try {
    body = (await request.json()) as ProofOfPaymentRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
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
      now: new Date(),
      rateLimitKey: deriveRateLimitKey(request),
      getPriorAttempts: (key) => rateLimitStore.getPriorAttempts(key),
      recordAttempt: (key, at) => rateLimitStore.recordAttempt(key, at),
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
