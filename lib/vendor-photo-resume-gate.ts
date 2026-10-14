import { verifyVendorPhotoResumeToken } from './vendor-photo-resume-token.ts';

/**
 * Decides what the photo-resume page shows (mission vendor-flow-fixes, F2). Pure and
 * read-only: the submission loader is injected and is only ever called with the verified
 * token's own id. The result is a closed shape and never echoes any loaded field.
 */

export const PRODUCT_PHOTO_SLOTS = [
  { slot: 'product-photo-1', pathField: 'productPhoto1Path' },
  { slot: 'product-photo-2', pathField: 'productPhoto2Path' },
  { slot: 'product-photo-3', pathField: 'productPhoto3Path' },
] as const;

export type ProductPhotoSlot = (typeof PRODUCT_PHOTO_SLOTS)[number]['slot'];

export type VendorPhotoResumeState =
  | { kind: 'invalid' }
  | { kind: 'complete' }
  | {
      kind: 'upload';
      vendorSubmissionId: string;
      missingSlots: ProductPhotoSlot[];
      uploadedCount: number;
    };

export type VendorPhotoResumeSubmission = Record<string, unknown>;

export interface ResolveVendorPhotoResumeStateInput {
  token: string;
  secret: string | undefined;
  now: Date;
  loadSubmission: (vendorSubmissionId: string) => Promise<VendorPhotoResumeSubmission | null>;
}

const REJECTED_STATUS = 'rejected';

export async function resolveVendorPhotoResumeState(
  input: ResolveVendorPhotoResumeStateInput,
): Promise<VendorPhotoResumeState> {
  if (!input.token || !input.secret) return { kind: 'invalid' };

  const verification = verifyVendorPhotoResumeToken({
    token: input.token,
    secret: input.secret,
    now: input.now,
  });
  if (!verification.ok) return { kind: 'invalid' };

  const submission = await input.loadSubmission(verification.vendorSubmissionId);
  if (!submission || submission.status === REJECTED_STATUS) return { kind: 'invalid' };

  // Same rule as the admin table: a slot counts only when its Path field is a non-empty string.
  const missingSlots = PRODUCT_PHOTO_SLOTS.filter(({ pathField }) => {
    const path = submission[pathField];
    return !(typeof path === 'string' && path.length > 0);
  }).map(({ slot }) => slot);

  if (missingSlots.length === 0) return { kind: 'complete' };

  return {
    kind: 'upload',
    vendorSubmissionId: verification.vendorSubmissionId,
    missingSlots,
    uploadedCount: PRODUCT_PHOTO_SLOTS.length - missingSlots.length,
  };
}
