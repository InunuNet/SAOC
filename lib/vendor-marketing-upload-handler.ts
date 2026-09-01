import {
  planMarketingAssetUpload,
  MARKETING_ASSET_MAX_BYTES,
  type MarketingAssetUploadPlan,
} from './vendor-marketing-upload.ts';
import {
  decideMarketingAssetRateLimit,
  type MarketingAssetAttemptRecord,
} from './vendor-marketing-upload-rate-limit.ts';

/**
 * Pure orchestrator for POST /api/vendors/[id]/marketing-asset (mission
 * vendor-gated-registration-flow, M2 F18). Mirrors `lib/vendor-proof-of-payment-handler.ts`
 * (F7) exactly: fully injectable, no Firebase Admin SDK/Storage import, so the rate-limit-
 * shields-everything and non-enumerable-existence properties are proven offline against this
 * function directly, never by source-grep. See
 * contracts/checks/vendor-gated-registration-flow-m2/check-marketing-upload-handler-existence-blind.mjs
 * for the module/interface spec this file implements against.
 */

export interface MarketingAssetHandlerInput {
  submissionId: string;
  assetSlot: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileBase64: string;
}

export interface MarketingAssetHandlerDeps {
  now: Date;
  rateLimitKey: string;
  getPriorAttempts(key: string): MarketingAssetAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
  submissionExists(id: string): Promise<boolean>;
  uploadFile(plan: MarketingAssetUploadPlan, fileBase64: string, mimeType: string): Promise<void>;
  updateSubmission(id: string, patch: Record<string, string | Date>): Promise<void>;
}

export interface MarketingAssetHandlerResult {
  status: number;
  body: { accepted: true } | { error: string } | { error: string; retryAfterMs: number };
}

// Maps each upload slot to the VendorSubmission field pair it writes -- keeps the Firestore
// patch shape out of the pure planning module (vendor-marketing-upload.ts), same separation
// F7 draws between planProofOfPaymentUpload() and this handler's own patch construction.
const SLOT_FIELD_NAMES: Record<string, { pathField: string; uploadedAtField: string }> = {
  logo: { pathField: 'logoPath', uploadedAtField: 'logoUploadedAt' },
  'product-photo-1': { pathField: 'productPhoto1Path', uploadedAtField: 'productPhoto1UploadedAt' },
  'product-photo-2': { pathField: 'productPhoto2Path', uploadedAtField: 'productPhoto2UploadedAt' },
  'product-photo-3': { pathField: 'productPhoto3Path', uploadedAtField: 'productPhoto3UploadedAt' },
};

export async function handleMarketingAssetUpload(
  input: MarketingAssetHandlerInput,
  deps: MarketingAssetHandlerDeps,
): Promise<MarketingAssetHandlerResult> {
  // (a) Rate limit checked, and the attempt recorded, FIRST -- a blocked caller reaches none
  // of planMarketingAssetUpload/submissionExists/uploadFile/updateSubmission.
  const rateLimitDecision = decideMarketingAssetRateLimit(
    deps.rateLimitKey,
    deps.now,
    deps.getPriorAttempts(deps.rateLimitKey),
  );
  deps.recordAttempt(deps.rateLimitKey, deps.now);

  if (!rateLimitDecision.allowed) {
    return {
      status: 429,
      body: {
        error: 'Too many marketing asset upload attempts. Please try again later.',
        retryAfterMs: rateLimitDecision.retryAfterMs ?? MARKETING_ASSET_DEFAULT_RETRY_AFTER_MS,
      },
    };
  }

  // (b) The REAL planMarketingAssetUpload() -- never reimplemented. On ok:false, 400 with the
  // error, before any existence lookup, so this 400 carries no existence signal either.
  const plan = planMarketingAssetUpload({
    submissionId: input.submissionId,
    assetSlot: input.assetSlot,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  if (!plan.ok) {
    return { status: 400, body: { error: plan.error } };
  }

  // (b2) Codex GPT-5.5 finding, 2026-09-01: `input.sizeBytes` above is a caller-supplied claim
  // -- planMarketingAssetUpload() only ever validated THAT number against
  // MARKETING_ASSET_MAX_BYTES, never the real byte length of `fileBase64` itself. A caller
  // could send `sizeBytes: 1` alongside an arbitrarily large `fileBase64` payload and the cap
  // would do nothing. The DECODED length is the only trustworthy figure, so it is computed
  // here (before any existence lookup or Storage write) and: (i) must equal the claimed
  // sizeBytes exactly -- a mismatch is rejected outright, never silently corrected, and (ii)
  // is independently checked against MARKETING_ASSET_MAX_BYTES too, so this reject fires even
  // if planMarketingAssetUpload's own check above were ever weakened.
  const decodedByteLength = Buffer.byteLength(input.fileBase64, 'base64');
  if (decodedByteLength !== input.sizeBytes) {
    return {
      status: 400,
      body: {
        error: `sizeBytes (${input.sizeBytes}) does not match the decoded file size (${decodedByteLength} bytes).`,
      },
    };
  }
  if (decodedByteLength > MARKETING_ASSET_MAX_BYTES) {
    return {
      status: 400,
      body: {
        error: `Decoded file size (${decodedByteLength}) exceeds the ${MARKETING_ASSET_MAX_BYTES}-byte limit.`,
      },
    };
  }

  const fieldNames = SLOT_FIELD_NAMES[input.assetSlot];

  // (c) Non-enumerable existence posture: the response below is byte-for-byte identical
  // whether or not the submission exists -- only the side effects differ.
  const exists = await deps.submissionExists(input.submissionId);

  if (exists) {
    // (d) Overwrite semantics: the deterministic path is always recomputed and re-saved --
    // never refused or versioned for a submission that already has an asset in that slot.
    await deps.uploadFile(plan.plan, input.fileBase64, input.mimeType);
    await deps.updateSubmission(input.submissionId, {
      [fieldNames.pathField]: plan.plan.storagePath,
      [fieldNames.uploadedAtField]: deps.now,
    });
  }

  return { status: 202, body: { accepted: true } };
}

/** Fallback only -- decideMarketingAssetRateLimit always returns a non-null retryAfterMs when
 *  allowed is false, so this branch is defensive, not load-bearing. */
const MARKETING_ASSET_DEFAULT_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
