import { createHmac, randomBytes } from 'node:crypto';

import { constantTimeEqual, isWellFormedHexDigest } from './recovery-token.ts';

/**
 * Signed, single-submission-scoped vendor photo-resume token (mission vendor-flow-fixes, F2).
 * See .agent/memory/project/specs/vendor-flow-fixes/goldens/f2/f2-vendor-photo-resume.golden.md.
 *
 * Authorises exactly one thing: the photo-resume page rendering product-photo upload fields for
 * the token's own submission id. Like the stand-payment token it is deliberately NOT
 * single-use; every use site re-reads the submission's CURRENT photo state.
 *
 * Token shape:
 * `${base64url(JSON.stringify({u: vendorSubmissionId, e: expiresAtEpochMs, n: nonce}))}.${hmacSha256Hex}`.
 * Domain separation from the stand-payment (`s`), registration (`a`) and recovery (`o`) tokens
 * is by payload key AND by an HMAC domain prefix, so the secret may be shared with the
 * stand-payment token without either token being redeemable in the other's domain.
 *
 * Pure, side-effect-free -- time is always the caller-supplied `now`.
 */

/** 30 days, same window as the stand-payment token. Overridable per-mint via `ttlMs`. */
export const VENDOR_PHOTO_RESUME_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const NONCE_BYTES = 16;
const SIGNATURE_DOMAIN_PREFIX = 'vendor-photo-resume:v1:';

export interface MintVendorPhotoResumeTokenInput {
  vendorSubmissionId: string;
  secret: string;
  now: Date;
  ttlMs?: number;
}

export interface MintedVendorPhotoResumeToken {
  token: string;
  expiresAt: Date;
}

interface VendorPhotoResumeTokenPayload {
  u: string;
  e: number;
  n: string;
}

function encodePayload(payload: VendorPhotoResumeTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signPayload(payloadSegment: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${SIGNATURE_DOMAIN_PREFIX}${payloadSegment}`)
    .digest('hex');
}

export function mintVendorPhotoResumeToken(
  input: MintVendorPhotoResumeTokenInput,
): MintedVendorPhotoResumeToken {
  const ttlMs = input.ttlMs ?? VENDOR_PHOTO_RESUME_TOKEN_DEFAULT_TTL_MS;
  const expiresAtEpochMs = input.now.getTime() + ttlMs;
  const nonce = randomBytes(NONCE_BYTES).toString('hex');
  const payloadSegment = encodePayload({ u: input.vendorSubmissionId, e: expiresAtEpochMs, n: nonce });

  return {
    token: `${payloadSegment}.${signPayload(payloadSegment, input.secret)}`,
    expiresAt: new Date(expiresAtEpochMs),
  };
}

export type VendorPhotoResumeTokenVerification =
  | { ok: true; vendorSubmissionId: string; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export interface VerifyVendorPhotoResumeTokenInput {
  token: string;
  secret: string;
  now: Date;
}

/**
 * Returns `null` on any malformation (missing separator, bad base64/JSON, wrong payload shape
 * -- including another token domain's) rather than throwing.
 */
function parseToken(
  token: string,
): { payloadSegment: string; signatureSegment: string; payload: VendorPhotoResumeTokenPayload } | null {
  const separatorIndex = token.indexOf('.');
  if (separatorIndex < 0) return null;

  const payloadSegment = token.slice(0, separatorIndex);
  const signatureSegment = token.slice(separatorIndex + 1);
  if (!payloadSegment || !signatureSegment) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Record<string, unknown>).u !== 'string' ||
    typeof (decoded as Record<string, unknown>).e !== 'number' ||
    !Number.isFinite((decoded as Record<string, unknown>).e) ||
    typeof (decoded as Record<string, unknown>).n !== 'string'
  ) {
    return null;
  }

  // Shape proven by the guards above.
  return { payloadSegment, signatureSegment, payload: decoded as VendorPhotoResumeTokenPayload };
}

export function verifyVendorPhotoResumeToken(
  input: VerifyVendorPhotoResumeTokenInput,
): VendorPhotoResumeTokenVerification {
  const parsed = parseToken(input.token);
  if (!parsed) return { ok: false, reason: 'malformed' };

  const { payloadSegment, signatureSegment, payload } = parsed;

  // Shape-check before decoding: Buffer.from(..., 'hex') silently truncates bad input.
  if (!isWellFormedHexDigest(signatureSegment)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const signatureBuffer = Buffer.from(signatureSegment, 'hex');
  const expectedBuffer = Buffer.from(signPayload(payloadSegment, input.secret), 'hex');
  if (!constantTimeEqual(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const expiresAt = new Date(payload.e);
  if (input.now.getTime() >= expiresAt.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, vendorSubmissionId: payload.u, expiresAt };
}
