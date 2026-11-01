import { constantTimeStringEqual, verifyRecoveryToken } from './recovery-token';

/**
 * Access decision for the emailed "Recover your tickets" link (mission nos-order-recovery,
 * spec docs/ticketing-system-foundation-spec.md §8.2, §8.4(2), §8.5).
 *
 * Token only: no cookie, header, account or admin import. Access needs (a) a verified,
 * unexpired token, (b) an order that loads by the signed id, (c) the order's STORED token
 * equal to the presented one (what makes the credential revocable), and (d) status `paid`.
 *
 * Every refusal is the same `{ ok: false }` with no reason, so a caller cannot leak why. A
 * token that fails parse, length, signature or expiry costs zero order lookups. A token that
 * cannot possibly be genuine (empty, over-long, or not `<base64url>.<64 hex>`) is denied before
 * the secret is consulted; a well-formed token with no secret configured throws, so a
 * misconfigured deploy is a loud server error, never a silent denial.
 */

/** Upper bound on the presented token, checked before any HMAC work. */
export const RECOVERY_TOKEN_MAX_LENGTH = 2048;

/** Public shape of every minted token: `<base64url payload>.<64 lowercase hex HMAC>`. */
export const RECOVERY_TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/;

export interface OrderRecoveryRecord {
  /** The order's `m_payment_id`; an order without one is not entitled. */
  reference: string;
  recoveryToken: string | null;
  status: string;
}

export type RecoveryAccess = { ok: true; orderId: string } | { ok: false };

export interface ResolveRecoveryAccessInput {
  rawToken: string | string[] | undefined;
  secret: string | undefined;
  now: Date;
  loadOrder(orderId: string): Promise<OrderRecoveryRecord | null>;
  tokensMatch?(stored: string, presented: string): boolean;
}

// anchor: ra-denied-helper
const denied = (): RecoveryAccess => ({ ok: false });

export async function resolveRecoveryAccess(
  input: ResolveRecoveryAccessInput
): Promise<RecoveryAccess> {
  // anchor: ra-input
  if (typeof input.rawToken !== 'string' || input.rawToken.length === 0 || input.rawToken.length > RECOVERY_TOKEN_MAX_LENGTH) {
    return denied();
  }
  // anchor: ra-shape
  if (!RECOVERY_TOKEN_SHAPE.test(input.rawToken)) {
    return denied();
  }
  // anchor: ra-secret
  if (!input.secret) {
    throw new Error('RECOVERY_TOKEN_SECRET is not configured');
  }

  // anchor: ra-verify
  const verified = verifyRecoveryToken({ token: input.rawToken, secret: input.secret, now: input.now });
  // anchor: ra-verify-denied
  if (!verified.ok || verified.orderId.length === 0 || verified.orderId.includes('/')) {
    return denied();
  }

  // anchor: ra-load
  const record = await input.loadOrder(verified.orderId);
  // anchor: ra-entitled
  if (record === null || record.status !== 'paid' || record.reference === '' || record.recoveryToken === null) {
    return denied();
  }

  // anchor: ra-default-match
  const tokensMatch = input.tokensMatch ?? constantTimeStringEqual;
  // anchor: ra-stored-match
  if (!tokensMatch(record.recoveryToken, input.rawToken)) {
    return denied();
  }

  // anchor: ra-success
  return { ok: true, orderId: verified.orderId };
}
