import { createHmac, randomBytes } from 'node:crypto';

import { constantTimeEqual, isWellFormedHexDigest } from './recovery-token';

/**
 * Signed, single-submission-scoped vendor stand-payment token (mission
 * vendor-gated-registration-flow, M3/F27). See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Token mechanism" for the full
 * decision record -- why this is a NEW module, a NEW secret and a THIRD distinct trust domain
 * alongside M1's application-approval token (`a`) and the order-recovery token (`o`).
 *
 * Structurally identical to lib/vendor-registration-token.ts's mint/verify shape
 * (`vendorSubmissionId` in place of `applicationId`), reusing (importing, not redefining)
 * `constantTimeEqual` and `isWellFormedHexDigest` from lib/recovery-token.ts -- this module
 * never redefines its own constant-time comparison or hex-shape validation.
 *
 * Pure, side-effect-free -- no Firestore, no network, no Date.now()/new Date() call anywhere
 * in this file. Time is always the caller-supplied `now`.
 *
 * ZERO authorization meaning beyond "this vendorSubmissionId's token has a valid signature and
 * has not expired." UNLIKE M1's registration token, this token is deliberately NOT single-use
 * -- a vendor may reload the payment page, retry after a failed gateway attempt, or return
 * days later. Every use site re-verifies the linked submission's CURRENT state (status,
 * whether its stand order is already paid) before acting -- never a state snapshot implied by
 * a successful token verification.
 *
 * Token shape:
 * `${base64url(JSON.stringify({s: vendorSubmissionId, e: expiresAtEpochMs, n: nonce}))}.${hmacSha256Hex}`.
 * The payload key `s` (vs. M1's `a` and the recovery token's `o`) is deliberate -- a token
 * minted by any of the three modules fails to parse under either other module's payload shape,
 * giving free structural domain separation even before the distinct secrets are considered.
 *
 * `n` is a random per-mint nonce (128 bits, hex-encoded) -- unlike M1's token, this one carries
 * no monotonic generation counter to force distinctness across reissues (see "Unlike M1's
 * registration token, this token is NOT single-use" above), and TTL/expiry alone can
 * legitimately collide to the millisecond across two mints issued in quick succession (e.g. the
 * approval mint and an immediate operator resend). Without the nonce two such mints would be
 * byte-identical, which would make F28's resend route indistinguishable from "re-read a cached
 * token" rather than "mint fresh" -- see the M3 golden README's "reissue, not unlock". The
 * nonce carries zero authorization meaning of its own, same as every other payload field.
 */

/** 30 days -- long enough for slow committee-to-vendor turnaround and a lapsed-attention
 *  vendor, unlike the registration code's tight 30-minute session. Overridable per-mint via
 *  `ttlMs`. */
export const VENDOR_STAND_PAYMENT_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export interface MintVendorStandPaymentTokenInput {
  vendorSubmissionId: string;
  secret: string;
  now: Date;
  ttlMs?: number;
}

export interface MintedVendorStandPaymentToken {
  token: string;
  expiresAt: Date;
}

interface VendorStandPaymentTokenPayload {
  s: string;
  e: number;
  n: string;
}

function encodePayload(payload: VendorStandPaymentTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signPayload(payloadSegment: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadSegment).digest('hex');
}

export function mintVendorStandPaymentToken(
  input: MintVendorStandPaymentTokenInput,
): MintedVendorStandPaymentToken {
  const ttlMs = input.ttlMs ?? VENDOR_STAND_PAYMENT_TOKEN_DEFAULT_TTL_MS;
  const expiresAtEpochMs = input.now.getTime() + ttlMs;
  const nonce = randomBytes(16).toString('hex');
  const payloadSegment = encodePayload({ s: input.vendorSubmissionId, e: expiresAtEpochMs, n: nonce });
  const signature = signPayload(payloadSegment, input.secret);

  return {
    token: `${payloadSegment}.${signature}`,
    expiresAt: new Date(expiresAtEpochMs),
  };
}

export type VendorStandPaymentTokenVerification =
  | { ok: true; vendorSubmissionId: string; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export interface VerifyVendorStandPaymentTokenInput {
  token: string;
  secret: string;
  now: Date;
}

/**
 * Parses and validates the token's payload segment. Returns `null` on any malformation (bad
 * base64, bad JSON, missing `.` separator, non-numeric expiry, non-string vendorSubmissionId,
 * or a payload shaped like a DIFFERENT token domain's -- e.g. `{a, e}` or `{o, e}`) rather than
 * throwing -- every parse failure funnels into a single `'malformed'` refusal.
 */
function parseToken(
  token: string,
):
  | { payloadSegment: string; signatureSegment: string; payload: VendorStandPaymentTokenPayload }
  | null {
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
    typeof (decoded as Record<string, unknown>).s !== 'string' ||
    typeof (decoded as Record<string, unknown>).e !== 'number' ||
    !Number.isFinite((decoded as Record<string, unknown>).e) ||
    typeof (decoded as Record<string, unknown>).n !== 'string'
  ) {
    return null;
  }

  const payload = decoded as VendorStandPaymentTokenPayload;
  return { payloadSegment, signatureSegment, payload };
}

export function verifyVendorStandPaymentToken(
  input: VerifyVendorStandPaymentTokenInput,
): VendorStandPaymentTokenVerification {
  const parsed = parseToken(input.token);
  if (!parsed) return { ok: false, reason: 'malformed' };

  const { payloadSegment, signatureSegment, payload } = parsed;

  // Reject any segment that is not EXACTLY a 64-character lowercase hex digest before ever
  // decoding it -- see lib/recovery-token.ts's isWellFormedHexDigest comment for the defect
  // this closes. Buffer.from(..., 'hex') below is never trusted to reject bad input; it
  // silently truncates at the first invalid character instead of throwing.
  if (!isWellFormedHexDigest(signatureSegment)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const expectedSignature = signPayload(payloadSegment, input.secret);

  const signatureBuffer = Buffer.from(signatureSegment, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (!constantTimeEqual(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const expiresAt = new Date(payload.e);
  if (input.now.getTime() >= expiresAt.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, vendorSubmissionId: payload.s, expiresAt };
}
