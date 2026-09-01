/**
 * F18 (vendor-gated-registration-flow, M2) — pure marketing asset upload planning: logo and
 * product-photo upload metadata validation and deterministic storage-path derivation. Mirrors
 * F7's `lib/vendor-payment.ts` `planProofOfPaymentUpload()` exactly (same shape, same
 * derive-extension-from-mimeType-never-fileName rule), scoped to image-only assets since
 * nothing in the source form's Marketing section asks for a document. See
 * contracts/checks/vendor-gated-registration-flow-m2/check-marketing-upload-plan-boundaries.mjs
 * for the module/interface spec this file implements against.
 *
 * Pure, side-effect-free — no Firestore, no firebase-admin, no Firebase Storage SDK import.
 */

/** Logo and product photos are images only — no PDF acceptance, unlike F7's proof-of-payment.
 *  Per contract F18: image/jpeg, image/png, image/webp. */
export const MARKETING_ASSET_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** An engineering limit, not a Council-approved figure — mirrors F7's own disclaimer on
 *  PROOF_OF_PAYMENT_MAX_BYTES. No size limit is named anywhere in the source document. */
export const MARKETING_ASSET_MAX_BYTES = 5 * 1024 * 1024;

const MIME_TYPE_EXTENSIONS: Record<(typeof MARKETING_ASSET_ALLOWED_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** The 4 upload slots the M2 golden README's "Why three fields, not an array" describes:
 *  logoPath + productPhoto1Path/2Path/3Path. */
export const MARKETING_ASSET_SLOTS = [
  'logo',
  'product-photo-1',
  'product-photo-2',
  'product-photo-3',
] as const;

export type MarketingAssetSlot = (typeof MARKETING_ASSET_SLOTS)[number];

// Rejects path separators, '..', and empty/whitespace — mirrors F7's own
// SAFE_SUBMISSION_ID_PATTERN so a submission id can never escape the
// `vendor-marketing/{submissionId}/` storage prefix.
const SAFE_SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface MarketingAssetUploadInput {
  submissionId: string;
  assetSlot: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MarketingAssetUploadPlan {
  storagePath: string;
}

export type MarketingAssetUploadResult =
  | { ok: true; plan: MarketingAssetUploadPlan }
  | { ok: false; error: string };

/**
 * Validates upload metadata and computes a deterministic
 * `vendor-marketing/{submissionId}/{assetSlot}.{ext}` storage path. The extension is derived
 * SOLELY from the validated `mimeType`, NEVER from the caller-supplied `fileName` — same
 * spoofed-extension defence as F7's `planProofOfPaymentUpload()`.
 */
export function planMarketingAssetUpload(
  input: MarketingAssetUploadInput,
): MarketingAssetUploadResult {
  if (!SAFE_SUBMISSION_ID_PATTERN.test(input.submissionId)) {
    return { ok: false, error: 'submissionId is invalid or path-traversal-shaped.' };
  }

  if (!(MARKETING_ASSET_SLOTS as readonly string[]).includes(input.assetSlot)) {
    return {
      ok: false,
      error: `assetSlot '${input.assetSlot}' is not one of the allowed slots: ${MARKETING_ASSET_SLOTS.join(', ')}.`,
    };
  }

  if (input.fileName.trim().length === 0) {
    return { ok: false, error: 'fileName is required and must not be empty or whitespace.' };
  }

  if (!(MARKETING_ASSET_ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return {
      ok: false,
      error: `mimeType '${input.mimeType}' is not one of the allowed types: ${MARKETING_ASSET_ALLOWED_MIME_TYPES.join(', ')}.`,
    };
  }

  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: 'sizeBytes must be a positive integer.' };
  }

  if (input.sizeBytes > MARKETING_ASSET_MAX_BYTES) {
    return {
      ok: false,
      error: `sizeBytes (${input.sizeBytes}) exceeds the ${MARKETING_ASSET_MAX_BYTES}-byte limit.`,
    };
  }

  const extension =
    MIME_TYPE_EXTENSIONS[input.mimeType as (typeof MARKETING_ASSET_ALLOWED_MIME_TYPES)[number]];

  return {
    ok: true,
    plan: { storagePath: `vendor-marketing/${input.submissionId}/${input.assetSlot}.${extension}` },
  };
}
