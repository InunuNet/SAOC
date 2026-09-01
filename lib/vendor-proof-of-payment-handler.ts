import {
  planProofOfPaymentUpload,
  PROOF_OF_PAYMENT_MAX_BYTES,
  type ProofOfPaymentUploadPlan,
} from '@/lib/vendor-payment';
import {
  decideProofOfPaymentRateLimit,
  type ProofOfPaymentAttemptRecord,
} from '@/lib/vendor-payment-rate-limit';

/**
 * Pure orchestrator for POST /api/vendors/[id]/proof-of-payment (mission vendor-registration
 * F7). See contracts/golden/vendor-f7-payment-path/README.md for the full decision record,
 * every judgement call, and every defeating mutation this contract's checks guard against.
 *
 * Fully injectable -- no Firebase Admin SDK/Storage/admin-auth/admin-roles import -- so every
 * load-bearing property (rate-limit-shields-everything, the non-enumerable existence posture,
 * overwrite semantics, no PII in logs) is proven offline against this function directly, never
 * by source-grep. Mirrors lib/vendor-registration-handler.ts's (F5) shape exactly.
 */

export interface ProofOfPaymentHandlerInput {
  submissionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileBase64: string;
}

export interface ProofOfPaymentHandlerDeps {
  now: Date;
  rateLimitKey: string;
  getPriorAttempts(key: string): ProofOfPaymentAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
  submissionExists(id: string): Promise<boolean>;
  uploadFile(plan: ProofOfPaymentUploadPlan, fileBase64: string, mimeType: string): Promise<void>;
  updateSubmission(
    id: string,
    patch: { proofOfPaymentPath: string; proofOfPaymentUploadedAt: Date },
  ): Promise<void>;
}

export interface ProofOfPaymentHandlerResult {
  status: number;
  body: { accepted: true } | { error: string } | { error: string; retryAfterMs: number };
}

export async function handleProofOfPaymentUpload(
  input: ProofOfPaymentHandlerInput,
  deps: ProofOfPaymentHandlerDeps,
): Promise<ProofOfPaymentHandlerResult> {
  // (a) Rate limit checked, and the attempt recorded, FIRST -- a blocked caller reaches none
  // of planProofOfPaymentUpload/submissionExists/uploadFile/updateSubmission.
  const rateLimitDecision = decideProofOfPaymentRateLimit(
    deps.rateLimitKey,
    deps.now,
    deps.getPriorAttempts(deps.rateLimitKey),
  );
  deps.recordAttempt(deps.rateLimitKey, deps.now);

  if (!rateLimitDecision.allowed) {
    return {
      status: 429,
      body: {
        error: 'Too many proof-of-payment upload attempts. Please try again later.',
        retryAfterMs:
          rateLimitDecision.retryAfterMs ?? PROOF_OF_PAYMENT_DEFAULT_RETRY_AFTER_MS,
      },
    };
  }

  // (b) The REAL planProofOfPaymentUpload() -- never reimplemented. On ok:false, 400 with the
  // error, before any existence lookup, so this 400 carries no existence signal either.
  const plan = planProofOfPaymentUpload({
    submissionId: input.submissionId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  if (!plan.ok) {
    return { status: 400, body: { error: plan.error } };
  }

  // (b2) Codex GPT-5.5 finding, 2026-09-01 (same defect confirmed live in F18's mirrored
  // marketing-asset route): `input.sizeBytes` above is a caller-supplied claim --
  // planProofOfPaymentUpload() only ever validated THAT number against
  // PROOF_OF_PAYMENT_MAX_BYTES, never the real byte length of `fileBase64` itself. A caller
  // could send `sizeBytes: 1` alongside an arbitrarily large `fileBase64` payload and the cap
  // would do nothing -- an unauthenticated route with an unbounded Storage write. The DECODED
  // length is the only trustworthy figure, so it is computed here (before any existence lookup
  // or Storage write) and: (i) must equal the claimed sizeBytes exactly -- a mismatch is
  // rejected outright, never silently corrected, and (ii) is independently checked against
  // PROOF_OF_PAYMENT_MAX_BYTES too, so this reject fires even if planProofOfPaymentUpload's own
  // check above were ever weakened.
  const decodedByteLength = Buffer.byteLength(input.fileBase64, 'base64');
  if (decodedByteLength !== input.sizeBytes) {
    return {
      status: 400,
      body: {
        error: `sizeBytes (${input.sizeBytes}) does not match the decoded file size (${decodedByteLength} bytes).`,
      },
    };
  }
  if (decodedByteLength > PROOF_OF_PAYMENT_MAX_BYTES) {
    return {
      status: 400,
      body: {
        error: `Decoded file size (${decodedByteLength}) exceeds the ${PROOF_OF_PAYMENT_MAX_BYTES}-byte limit.`,
      },
    };
  }

  // (c) Non-enumerable existence posture: the response below is byte-for-byte identical
  // whether or not the submission exists -- only the side effects differ.
  const exists = await deps.submissionExists(input.submissionId);

  if (exists) {
    // (d) Overwrite semantics: the deterministic path is always recomputed and re-saved --
    // never refused or versioned for a submission that already has a proof on file.
    await deps.uploadFile(plan.plan, input.fileBase64, input.mimeType);
    await deps.updateSubmission(input.submissionId, {
      proofOfPaymentPath: plan.plan.storagePath,
      proofOfPaymentUploadedAt: deps.now,
    });
  }

  return { status: 202, body: { accepted: true } };
}

/** Fallback only -- decideProofOfPaymentRateLimit always returns a non-null retryAfterMs when
 *  allowed is false, so this branch is defensive, not load-bearing. */
const PROOF_OF_PAYMENT_DEFAULT_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
