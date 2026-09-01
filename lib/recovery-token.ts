import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed, single-order-scoped order-access recovery token (mission ticketing-foundation F6,
 * spec §8.2). See contracts/golden/ticketing-f6-recovery-token/README.md for the full decision
 * record — token wire format, every defeating mutation, and what this module deliberately does
 * not prove (genuine timing-side-channel measurement).
 *
 * Pure, side-effect-free — no Firestore, no network, no Date.now()/new Date() call anywhere in
 * this file. Time is always the caller-supplied `now`, exactly like `ShowWindowLookup`'s
 * injected-time pattern in lib/admin-auth.ts.
 *
 * ZERO authorization meaning: a verified token carries only `orderId` and `expiresAt` — nothing
 * that grants a capability, admin surface, or role. Do not import lib/admin-auth.ts or
 * lib/admin-roles.ts here.
 *
 * Token shape: `${base64url(JSON.stringify({o: orderId, e: expiresAtEpochMs}))}.${hmacSha256Hex}`.
 * HMAC-SHA256 (not PayFast's MD5 idiom in lib/payfast.ts) because this is a genuinely
 * security-load-bearing signature over a single server-only key, not a vendor-dictated scheme —
 * see the golden README's "Why the token format is HMAC-SHA256" for the full reasoning.
 */

/** Placeholder default (180 days) — not a Council-approved retention/access-window value. See
 * the golden README's "Judgement calls" for why. Overridable per-call via `ttlMs`. */
export const RECOVERY_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 180;

export type SignatureCompare = (a: Buffer, b: Buffer) => boolean;

/**
 * Constant-time buffer comparison. Guards the length check itself before delegating to
 * `node:crypto`'s `timingSafeEqual` — that function throws on a length mismatch, and a thrown
 * exception here would surface as an unhandled 500 (an information leak) rather than a clean
 * refusal.
 */
export function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Every token module in this project (this file, lib/vendor-registration-token.ts,
 * lib/supporter-registration-token.ts, lib/vendor-stand-payment-token.ts) signs with
 * `createHmac('sha256', secret).digest('hex')`,
 * which can only ever produce exactly 64 lowercase hex characters. Shared here, alongside
 * `constantTimeEqual`, as the single source of truth for validating a signature segment's
 * shape -- the same "reuse, never redefine" relationship `constantTimeEqual` already has with
 * its importers.
 *
 * The defect this closes (found 2026-09-01, Codex cross-model review): `Buffer.from(str,
 * 'hex')` does NOT reject malformed hex -- it silently stops decoding at the first invalid
 * character or an odd-length tail and returns whatever it managed to parse. A genuine 64-char
 * signature with arbitrary junk appended (`${validSignature}.junk`, trailing whitespace, an
 * extra `.`-delimited segment, one appended hex character, ...) decodes to the SAME 32-byte
 * buffer as the clean signature, so it passed the constant-time comparison unchanged -- every
 * verifier in this project trusted the decoder to reject bad input, and it doesn't. Uppercase
 * or mixed-case hex is also refused here even though it decodes to the same bytes: a genuine
 * signature is never anything but lowercase, so accepting case variants would still mean this
 * verifier treats more than one string as "the" token, which is the property this function
 * exists to close off. `constantTimeEqual` above is unaffected and unchanged -- the fix is
 * entirely in validating the segment's shape BEFORE it is ever decoded, never in the
 * comparison itself.
 */
const SHA256_HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export function isWellFormedHexDigest(segment: string): boolean {
  return SHA256_HEX_DIGEST_PATTERN.test(segment);
}

export interface MintRecoveryTokenInput {
  orderId: string;
  secret: string;
  now: Date;
  ttlMs?: number;
}

export interface MintedRecoveryToken {
  token: string;
  expiresAt: Date;
}

interface RecoveryTokenPayload {
  o: string;
  e: number;
}

function encodePayload(payload: RecoveryTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signPayload(payloadSegment: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadSegment).digest('hex');
}

export function mintRecoveryToken(input: MintRecoveryTokenInput): MintedRecoveryToken {
  const ttlMs = input.ttlMs ?? RECOVERY_TOKEN_DEFAULT_TTL_MS;
  const expiresAtEpochMs = input.now.getTime() + ttlMs;
  const payloadSegment = encodePayload({ o: input.orderId, e: expiresAtEpochMs });
  const signature = signPayload(payloadSegment, input.secret);

  return {
    token: `${payloadSegment}.${signature}`,
    expiresAt: new Date(expiresAtEpochMs),
  };
}

export type RecoveryTokenVerification =
  | { ok: true; orderId: string; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export interface VerifyRecoveryTokenInput {
  token: string;
  secret: string;
  now: Date;
  compare?: SignatureCompare;
}

/**
 * Parses and validates the token's payload segment. Returns `null` on any malformation (bad
 * base64, bad JSON, missing `.` separator, non-numeric expiry, non-string orderId) rather than
 * throwing — every parse failure funnels into a single `'malformed'` refusal.
 */
function parseToken(token: string): { payloadSegment: string; signatureSegment: string; payload: RecoveryTokenPayload } | null {
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
    typeof (decoded as Record<string, unknown>).o !== 'string' ||
    typeof (decoded as Record<string, unknown>).e !== 'number' ||
    !Number.isFinite((decoded as Record<string, unknown>).e)
  ) {
    return null;
  }

  const payload = decoded as RecoveryTokenPayload;
  return { payloadSegment, signatureSegment, payload };
}

export function verifyRecoveryToken(input: VerifyRecoveryTokenInput): RecoveryTokenVerification {
  const compare = input.compare ?? constantTimeEqual;

  const parsed = parseToken(input.token);
  if (!parsed) return { ok: false, reason: 'malformed' };

  const { payloadSegment, signatureSegment, payload } = parsed;

  // Reject any segment that is not EXACTLY a 64-character lowercase hex digest before ever
  // decoding it — see isWellFormedHexDigest's comment. This is what actually closes the
  // truncation defect; Buffer.from(..., 'hex') below is never trusted to reject bad input.
  if (!isWellFormedHexDigest(signatureSegment)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const expectedSignature = signPayload(payloadSegment, input.secret);

  const signatureBuffer = Buffer.from(signatureSegment, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (!compare(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const expiresAt = new Date(payload.e);
  if (input.now.getTime() >= expiresAt.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, orderId: payload.o, expiresAt };
}
