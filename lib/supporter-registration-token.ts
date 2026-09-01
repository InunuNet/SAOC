import { createHmac } from 'node:crypto';

import { constantTimeEqual, isWellFormedHexDigest } from '@/lib/recovery-token';

/**
 * Purpose-scoped, signed self-service tokens for public supporter registration (mission
 * public-supporter-registration, F1). See
 * .agent/memory/project/specs/public-supporter-registration/goldens/README.md "Purpose-scoped
 * tokens" for the full decision record.
 *
 * Pure, side-effect-free -- no Firestore, no network, no Date.now()/new Date() call anywhere in
 * this file. Time is always the caller-supplied `now`.
 *
 * Same wire-format family as lib/recovery-token.ts (HMAC-SHA256, base64url JSON payload segment
 * + hex signature segment, constant-time comparison via that file's `constantTimeEqual`, and
 * signature-shape validation via that file's `isWellFormedHexDigest`) -- neither is
 * re-implemented here.
 *
 * `confirm` / `unsubscribe` / `erase` are separate purposes so a leaked confirm link (the one
 * token that gets forwarded, previewed by mail clients, and crawled by link-scanners) can never
 * double as a delete-my-data or unsubscribe link. `verifySupporterRegistrationToken` checks the
 * signature FIRST, then purpose -- a 'wrong-purpose' result is only ever returned for a token
 * whose signature already verified.
 *
 * ZERO authorization meaning: a verified token carries only `registrationId`, `purpose`, and
 * `expiresAt` -- nothing that grants a capability, admin surface, or role. Do not import
 * lib/admin-auth.ts or lib/admin-roles.ts here.
 */

export type SupporterRegistrationTokenPurpose = 'confirm' | 'unsubscribe' | 'erase';

/** Double opt-in should be prompt -- 24 hours. */
export const SUPPORTER_CONFIRM_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

/** Minted fresh into every sent marketing email's footer -- generous enough that an old
 *  newsletter's unsubscribe/erase link keeps working. ~400 days. */
export const SUPPORTER_MANAGE_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 400;

export interface MintSupporterRegistrationTokenInput {
  registrationId: string;
  purpose: SupporterRegistrationTokenPurpose;
  secret: string;
  now: Date;
  ttlMs?: number;
}

export interface MintedSupporterRegistrationToken {
  token: string;
  expiresAt: Date;
}

interface SupporterRegistrationTokenPayload {
  r: string;
  p: SupporterRegistrationTokenPurpose;
  e: number;
}

function defaultTtlForPurpose(purpose: SupporterRegistrationTokenPurpose): number {
  return purpose === 'confirm'
    ? SUPPORTER_CONFIRM_TOKEN_DEFAULT_TTL_MS
    : SUPPORTER_MANAGE_TOKEN_DEFAULT_TTL_MS;
}

function encodePayload(payload: SupporterRegistrationTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signPayload(payloadSegment: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadSegment).digest('hex');
}

export function mintSupporterRegistrationToken(
  input: MintSupporterRegistrationTokenInput,
): MintedSupporterRegistrationToken {
  const ttlMs = input.ttlMs ?? defaultTtlForPurpose(input.purpose);
  const expiresAtEpochMs = input.now.getTime() + ttlMs;
  const payloadSegment = encodePayload({
    r: input.registrationId,
    p: input.purpose,
    e: expiresAtEpochMs,
  });
  const signature = signPayload(payloadSegment, input.secret);

  return {
    token: `${payloadSegment}.${signature}`,
    expiresAt: new Date(expiresAtEpochMs),
  };
}

export type SupporterRegistrationTokenVerification =
  | { ok: true; registrationId: string; purpose: SupporterRegistrationTokenPurpose; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'wrong-purpose' };

export interface VerifySupporterRegistrationTokenInput {
  token: string;
  expectedPurpose: SupporterRegistrationTokenPurpose;
  secret: string;
  now: Date;
}

const VALID_PURPOSES: readonly SupporterRegistrationTokenPurpose[] = [
  'confirm',
  'unsubscribe',
  'erase',
];

/**
 * Parses and validates the token's payload segment. Returns `null` on any malformation (bad
 * base64, bad JSON, missing `.` separator, non-numeric expiry, non-string registrationId,
 * unrecognised purpose) rather than throwing -- every parse failure funnels into a single
 * `'malformed'` refusal.
 */
function parseToken(
  token: string,
): { payloadSegment: string; signatureSegment: string; payload: SupporterRegistrationTokenPayload } | null {
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

  if (typeof decoded !== 'object' || decoded === null) return null;
  const candidate = decoded as Record<string, unknown>;

  if (
    typeof candidate.r !== 'string' ||
    typeof candidate.p !== 'string' ||
    !VALID_PURPOSES.includes(candidate.p as SupporterRegistrationTokenPurpose) ||
    typeof candidate.e !== 'number' ||
    !Number.isFinite(candidate.e)
  ) {
    return null;
  }

  return {
    payloadSegment,
    signatureSegment,
    payload: {
      r: candidate.r,
      p: candidate.p as SupporterRegistrationTokenPurpose,
      e: candidate.e,
    },
  };
}

/**
 * Signature is checked BEFORE purpose (mirrors lib/recovery-token.ts's ordering) -- a
 * wrong-purpose result is only ever returned for a token whose signature already verified.
 */
export function verifySupporterRegistrationToken(
  input: VerifySupporterRegistrationTokenInput,
): SupporterRegistrationTokenVerification {
  const parsed = parseToken(input.token);
  if (!parsed) return { ok: false, reason: 'malformed' };

  const { payloadSegment, signatureSegment, payload } = parsed;

  // Reject any segment that isn't EXACTLY a 64-character lowercase hex digest before ever
  // decoding it -- see lib/recovery-token.ts's isWellFormedHexDigest comment for the defect
  // this closes (Buffer.from(str, 'hex') silently truncates instead of rejecting malformed
  // input). Catches appended junk (`${validSignature}.junk`), odd-length hex, uppercase/mixed-
  // case digests (never produced by this module's own `digest('hex')`), and an extra
  // `.`-delimited segment, all as a clean 'bad-signature' refusal.
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

  if (payload.p !== input.expectedPurpose) {
    return { ok: false, reason: 'wrong-purpose' };
  }

  return { ok: true, registrationId: payload.r, purpose: payload.p, expiresAt };
}
