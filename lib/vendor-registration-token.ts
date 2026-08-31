import { createHmac } from 'node:crypto';

import { constantTimeEqual } from './recovery-token';

/**
 * Signed, single-application-scoped vendor registration token (mission
 * vendor-gated-registration-flow F3). See
 * contracts/golden/vendor-gated-registration-flow-f1/README.md for the full decision record --
 * why this is a NEW module and a NEW secret, scoped to a different trust domain than
 * lib/recovery-token.ts's own order-recovery secret. `secret` is always caller-injected (this
 * module never reads `process.env` itself, matching lib/recovery-token.ts's own shape) --
 * callers must read it from the dedicated `VENDOR_REGISTRATION_TOKEN_SECRET` env var
 * (documented in .env.local.example), never from any other purpose's secret.
 *
 * Structurally identical to lib/recovery-token.ts's mint/verify shape (`applicationId` in
 * place of `orderId`), reusing (importing, not redefining) `constantTimeEqual` from
 * lib/recovery-token.ts -- this module never redefines its own constant-time comparison.
 *
 * Pure, side-effect-free -- no Firestore, no network, no Date.now()/new Date() call anywhere
 * in this file. Time is always the caller-supplied `now`.
 *
 * ZERO authorization meaning beyond "this applicationId's token has a valid signature and has
 * not expired." Single-use is deliberately NOT enforced by this module -- a stateless HMAC is
 * replayable until expiry by construction. The caller (F5's mint call site, F7's gated
 * register route) is responsible for checking/setting `registrationTokenConsumedAt` on the
 * `VendorApplication` doc.
 *
 * Token shape: `${base64url(JSON.stringify({a: applicationId, e: expiresAtEpochMs}))}.${hmacSha256Hex}`.
 * The payload key `a` (vs. lib/recovery-token.ts's `o`) is deliberate -- a token minted by
 * either module fails to parse under the other's payload shape, giving free domain separation
 * even before the distinct secrets are considered.
 */

/** Provisional engineering default (14 days) -- not a Council-approved figure. Overridable
 *  per-mint via `ttlMs`. Mirrors RECOVERY_TOKEN_DEFAULT_TTL_MS's own doc-comment pattern. */
export const VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export interface MintVendorRegistrationTokenInput {
  applicationId: string;
  secret: string;
  now: Date;
  ttlMs?: number;
}

export interface MintedVendorRegistrationToken {
  token: string;
  expiresAt: Date;
}

interface VendorRegistrationTokenPayload {
  a: string;
  e: number;
}

function encodePayload(payload: VendorRegistrationTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signPayload(payloadSegment: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadSegment).digest('hex');
}

export function mintVendorRegistrationToken(
  input: MintVendorRegistrationTokenInput,
): MintedVendorRegistrationToken {
  const ttlMs = input.ttlMs ?? VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS;
  const expiresAtEpochMs = input.now.getTime() + ttlMs;
  const payloadSegment = encodePayload({ a: input.applicationId, e: expiresAtEpochMs });
  const signature = signPayload(payloadSegment, input.secret);

  return {
    token: `${payloadSegment}.${signature}`,
    expiresAt: new Date(expiresAtEpochMs),
  };
}

export type VendorRegistrationTokenVerification =
  | { ok: true; applicationId: string; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export interface VerifyVendorRegistrationTokenInput {
  token: string;
  secret: string;
  now: Date;
}

/**
 * Parses and validates the token's payload segment. Returns `null` on any malformation (bad
 * base64, bad JSON, missing `.` separator, non-numeric expiry, non-string applicationId, or a
 * payload shaped like a DIFFERENT token domain's -- e.g. lib/recovery-token.ts's `{o, e}`)
 * rather than throwing -- every parse failure funnels into a single `'malformed'` refusal.
 */
function parseToken(
  token: string,
): { payloadSegment: string; signatureSegment: string; payload: VendorRegistrationTokenPayload } | null {
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
    typeof (decoded as Record<string, unknown>).a !== 'string' ||
    typeof (decoded as Record<string, unknown>).e !== 'number' ||
    !Number.isFinite((decoded as Record<string, unknown>).e)
  ) {
    return null;
  }

  const payload = decoded as VendorRegistrationTokenPayload;
  return { payloadSegment, signatureSegment, payload };
}

export function verifyVendorRegistrationToken(
  input: VerifyVendorRegistrationTokenInput,
): VendorRegistrationTokenVerification {
  const parsed = parseToken(input.token);
  if (!parsed) return { ok: false, reason: 'malformed' };

  const { payloadSegment, signatureSegment, payload } = parsed;

  const expectedSignature = signPayload(payloadSegment, input.secret);

  // Signature segments may legitimately differ in length (a tampered or truncated segment) --
  // hex-decode failures and length mismatches must fall through to a clean 'bad-signature'
  // refusal, never an unhandled exception.
  let signatureBuffer: Buffer;
  let expectedBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signatureSegment, 'hex');
    expectedBuffer = Buffer.from(expectedSignature, 'hex');
  } catch {
    return { ok: false, reason: 'bad-signature' };
  }

  if (!constantTimeEqual(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const expiresAt = new Date(payload.e);
  if (input.now.getTime() >= expiresAt.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, applicationId: payload.a, expiresAt };
}
