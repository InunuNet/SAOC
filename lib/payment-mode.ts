// Payment mode vocabulary, client-safe (no firebase-admin, no env, no Firestore).
// Mission payment-gateway-settings M1: Sandbox is the only selectable mode. 'live' is named so the
// UI can render it disabled, but it is never accepted: M2 adds it to SELECTABLE_PAYMENT_MODES.

export const PAYMENT_MODES = ['sandbox', 'live'] as const;
export const SELECTABLE_PAYMENT_MODES = ['sandbox'] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

export type ParsedPaymentMode =
  | { ok: true; mode: 'sandbox' }
  | { ok: false; reason: 'live-not-available' | 'invalid-mode' };

/**
 * Validates a requested mode. `undefined` (caller sent none) means sandbox. Only the exact string
 * 'sandbox' is accepted; the exact string 'live' is refused as not available; everything else
 * (wrong case, whitespace, null, numbers, objects, empty string) is invalid. Never returns live.
 */
export function parsePaymentMode(value: unknown): ParsedPaymentMode {
  if (value === undefined || value === 'sandbox') return { ok: true, mode: 'sandbox' };
  if (value === 'live') return { ok: false, reason: 'live-not-available' };
  return { ok: false, reason: 'invalid-mode' };
}
