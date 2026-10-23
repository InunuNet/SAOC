import { mintVendorPhotoResumeToken } from './vendor-photo-resume-token.ts';

/**
 * Builds the vendor photo-resume URL (mission vendor-flow-fixes, F2). Pure -- the caller
 * supplies the site URL, secret and clock.
 */

export const VENDOR_PHOTO_UPLOAD_PATH = '/vendors/photos';

const TRAILING_SLASHES = /\/+$/;

export function buildVendorPhotoUploadUrl(input: { siteUrl: string; token: string }): string {
  const base = input.siteUrl.replace(TRAILING_SLASHES, '');
  return `${base}${VENDOR_PHOTO_UPLOAD_PATH}?token=${encodeURIComponent(input.token)}`;
}

export interface MintVendorPhotoUploadUrlInput {
  vendorSubmissionId: string;
  secret: string;
  now: Date;
  siteUrl: string;
  ttlMs?: number;
}

export function mintVendorPhotoUploadUrl(input: MintVendorPhotoUploadUrlInput): {
  url: string;
  expiresAt: Date;
} {
  const { token, expiresAt } = mintVendorPhotoResumeToken({
    vendorSubmissionId: input.vendorSubmissionId,
    secret: input.secret,
    now: input.now,
    ttlMs: input.ttlMs,
  });
  return { url: buildVendorPhotoUploadUrl({ siteUrl: input.siteUrl, token }), expiresAt };
}
