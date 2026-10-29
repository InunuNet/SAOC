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
 * token that fails parse, length, signature or expiry costs zero order lookups. A missing
 * secret throws before the token is looked at, so every request gets the same server error.
 */

/** Upper bound on the presented token, checked before any HMAC work. */
export const RECOVERY_TOKEN_MAX_LENGTH = 2048;

export interface OrderRecoveryRecord {
  /** The order's `m_payment_id`, the key `getConfirmedOrderForDisplay` resolves by. */
  reference: string;
  recoveryToken: string | null;
  status: string;
}

export type RecoveryAccess = { ok: true; reference: string } | { ok: false };

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
  // anchor: ra-secret
  if (!input.secret) {
    throw new Error('RECOVERY_TOKEN_SECRET is not configured');
  }
  // anchor: ra-input
  if (typeof input.rawToken !== 'string' || input.rawToken.length === 0 || input.rawToken.length > RECOVERY_TOKEN_MAX_LENGTH) {
    return denied();
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
  return { ok: true, reference: record.reference };
}
