/**
 * F7 (vendor-registration) — pure booth fee payment path: proof-of-payment upload planning and
 * office-use payment/booth-allocation recording. See
 * contracts/golden/vendor-f7-payment-path/README.md for the full decision record, every
 * judgement call, and every defeating mutation this contract's checks guard against.
 *
 * Pure, side-effect-free, authorization-blind module — no Firestore, no firebase-admin, no
 * Firebase Storage SDK, no lib/admin-auth.ts, no lib/admin-roles.ts import. Mirrors
 * lib/vendor-review.ts's (F6) injected-time, additive-only-patch pattern exactly: `now` and
 * `confirmedBy` are always taken verbatim from the caller, never read from `Date.now()`/
 * `new Date()` internally. The capability check that gates who may call
 * decideVendorPaymentUpdate() lives only in the route file
 * (app/api/admin/vendors/[id]/payment/route.ts) — never here.
 */

import type { VendorSubmissionStatus } from '@/types/index';

/**
 * The source form (Section 5, field 30) names no booth fee amount and no ZAR price list per
 * booth type exists — these two constants are engineering limits for the upload adapter, not
 * a Council-approved pricing figure. See the golden README's "No ZAR amount anywhere in this
 * feature".
 */
export const PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const PROOF_OF_PAYMENT_MAX_BYTES = 5 * 1024 * 1024;

const MIME_TYPE_EXTENSIONS: Record<(typeof PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES)[number], string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// Rejects path separators, '..', and empty/whitespace — a submission id must never let a
// caller escape the `vendor-proofs/{submissionId}/` storage prefix.
const SAFE_SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface ProofOfPaymentUploadInput {
  submissionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ProofOfPaymentUploadPlan {
  storagePath: string;
}

export type ProofOfPaymentUploadResult =
  | { ok: true; plan: ProofOfPaymentUploadPlan }
  | { ok: false; error: string };

/**
 * Validates upload metadata and computes a deterministic `vendor-proofs/{submissionId}/
 * proof-of-payment.{ext}` storage path. The extension is derived SOLELY from the validated
 * `mimeType`, NEVER from the caller-supplied `fileName` — so a spoofed extension (e.g.
 * `virus.exe` sent with `mimeType: 'application/pdf'`) can never influence the stored path.
 * Has no notion of submission status or authorization at all — it succeeds identically
 * regardless of the real submission's status, since this pure function has no way to know it.
 */
export function planProofOfPaymentUpload(
  input: ProofOfPaymentUploadInput,
): ProofOfPaymentUploadResult {
  if (!SAFE_SUBMISSION_ID_PATTERN.test(input.submissionId)) {
    return { ok: false, error: 'submissionId is invalid or path-traversal-shaped.' };
  }

  if (input.fileName.trim().length === 0) {
    return { ok: false, error: 'fileName is required and must not be empty or whitespace.' };
  }

  if (
    !(PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)
  ) {
    return {
      ok: false,
      error: `mimeType '${input.mimeType}' is not one of the allowed types: ${PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES.join(', ')}.`,
    };
  }

  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: 'sizeBytes must be a positive integer.' };
  }

  if (input.sizeBytes > PROOF_OF_PAYMENT_MAX_BYTES) {
    return {
      ok: false,
      error: `sizeBytes (${input.sizeBytes}) exceeds the ${PROOF_OF_PAYMENT_MAX_BYTES}-byte limit.`,
    };
  }

  const extension = MIME_TYPE_EXTENSIONS[input.mimeType as (typeof PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES)[number]];

  return {
    ok: true,
    plan: { storagePath: `vendor-proofs/${input.submissionId}/proof-of-payment.${extension}` },
  };
}

export interface VendorPaymentUpdateInput {
  currentStatus: VendorSubmissionStatus;
  boothNumber?: string | null;
  paymentReceived?: boolean;
  confirmedBy: string;
  now: Date;
  allocatedBoothNumbers: string[];
}

export interface VendorPaymentPatch {
  boothNumber: string | null;
  paymentReceived: boolean;
  paymentConfirmedBy: string;
  paymentConfirmedAt: Date;
}

export type VendorPaymentDecision =
  | { ok: true; patch: VendorPaymentPatch }
  | { ok: false; error: string };

/**
 * Decides whether office-use payment/booth fields may be recorded against a submission.
 * Refuses unless `currentStatus === 'approved'` — office-use fields are something the
 * committee records once a vendor is accepted, never before (a judgement call, see the golden
 * README). Refuses a non-empty `boothNumber` that collides with one already present in
 * `allocatedBoothNumbers` — booth numbers must be unique across approved submissions (also a
 * judgement call, see the golden README); `allocatedBoothNumbers` is caller-injected (a real
 * Firestore query over other approved submissions, excluding the submission being updated) —
 * this function never queries anything itself. On success returns a structurally
 * additive-only 4-key patch. `now`/`confirmedBy` are always taken verbatim from the input,
 * never derived internally.
 */
export function decideVendorPaymentUpdate(
  input: VendorPaymentUpdateInput,
): VendorPaymentDecision {
  if (input.currentStatus !== 'approved') {
    return {
      ok: false,
      error: `Cannot record payment/booth fields against a submission with status '${input.currentStatus}'; the status must be 'approved'.`,
    };
  }

  const boothNumber = input.boothNumber ?? null;

  if (boothNumber !== null && input.allocatedBoothNumbers.includes(boothNumber)) {
    return {
      ok: false,
      error: `Booth number '${boothNumber}' is already allocated to another approved submission.`,
    };
  }

  return {
    ok: true,
    patch: {
      boothNumber,
      paymentReceived: input.paymentReceived ?? false,
      paymentConfirmedBy: input.confirmedBy,
      paymentConfirmedAt: input.now,
    },
  };
}
