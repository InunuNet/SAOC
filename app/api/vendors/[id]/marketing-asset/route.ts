import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import {
  handleMarketingAssetUpload,
  type MarketingAssetHandlerResult,
} from '@/lib/vendor-marketing-upload-handler';
import {
  createInMemoryMarketingAssetRateLimitStore,
  decideMarketingAssetRateLimit,
} from '@/lib/vendor-marketing-upload-rate-limit';

/** Mirrors the handler's own fallback -- decideMarketingAssetRateLimit() always returns a
 *  non-null retryAfterMs when allowed is false, so this branch is defensive, not load-bearing. */
const MARKETING_ASSET_ROUTE_DEFAULT_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/vendors/[id]/marketing-asset -- PUBLIC, unauthenticated route (mission
 * vendor-gated-registration-flow, M2 F18). A vendor who has already submitted the full
 * registration form (F14) uploads their logo or one of 3 product photos against their own
 * submission id, mirroring F7's proof-of-payment route exactly (non-enumerable existence,
 * rate-limit-shields-everything, overwrite semantics). Deliberately NOT capability-gated --
 * same public-submitter posture as F7.
 *
 * Thin wrapper only -- every load-bearing property is proven against the pure
 * lib/vendor-marketing-upload-handler.ts directly, never against this file. See
 * app/api/vendors/[id]/proof-of-payment/route.ts (F7) for the pattern this mirrors.
 */

const rateLimitStore = createInMemoryMarketingAssetRateLimitStore();

/** Mirrors app/api/vendors/[id]/proof-of-payment/route.ts's deriveRateLimitKey() exactly. */
function deriveRateLimitKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstHop = forwardedFor?.split(',')[0]?.trim();
  return `vendor-marketing-ip:${firstHop || 'unknown'}`;
}

function toResponse(result: MarketingAssetHandlerResult): NextResponse {
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.status === 429 && 'retryAfterMs' in result.body) {
    response.headers.set('Retry-After', String(Math.ceil(result.body.retryAfterMs / 1000)));
  }
  return response;
}

interface MarketingAssetRequestBody {
  assetSlot?: unknown;
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
  // guarantee A34 proves against the pure handler never held at the real HTTP boundary -- a
  // blocked-by-rate-limit caller still paid the parsing cost on every request. The decision
  // (and its attempt record) now happens here, first, against the same rate-limit store the
  // handler itself would use, so a rate-limited caller's body is never even read. The response
  // shape below is byte-identical to what handleMarketingAssetUpload() itself returns for a
  // 429. Once decided here, the handler is called with a no-op rate-limit dependency pair
  // (getPriorAttempts always empty, recordAttempt a no-op) so the real store is never
  // double-recorded for the same request.
  const rateLimitKey = deriveRateLimitKey(request);
  const now = new Date();
  const rateLimitDecision = decideMarketingAssetRateLimit(
    rateLimitKey,
    now,
    rateLimitStore.getPriorAttempts(rateLimitKey),
  );
  rateLimitStore.recordAttempt(rateLimitKey, now);

  if (!rateLimitDecision.allowed) {
    return toResponse({
      status: 429,
      body: {
        error: 'Too many marketing asset upload attempts. Please try again later.',
        retryAfterMs: rateLimitDecision.retryAfterMs ?? MARKETING_ASSET_ROUTE_DEFAULT_RETRY_AFTER_MS,
      },
    });
  }

  let body: MarketingAssetRequestBody;
  try {
    body = (await request.json()) as MarketingAssetRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const db = getFirestore(initAdmin());

  const result = await handleMarketingAssetUpload(
    {
      submissionId: id,
      assetSlot: typeof body.assetSlot === 'string' ? body.assetSlot : '',
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
