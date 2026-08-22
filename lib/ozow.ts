import { createHash } from 'node:crypto';

/**
 * Ozow signature primitives.
 *
 * Verified independently via Alembic against https://ozow.com/integrations and
 * https://api.i-pay.co.za/guide/payment (2026-08-22, see
 * contracts/golden/ozow-m1-f1/README.md §1): Ozow's HashCheck/Hash mechanism is PLAIN SHA512, NOT
 * HMAC-SHA512 (docs/payment-gateway-research-2026-08.md's HMAC claim is wrong and is corrected in
 * a later feature). The mechanism, verbatim from Ozow's own docs: (1) concatenate the documented
 * post/response variables, excluding the hash field itself, in the documented order; (2) append
 * the private key to the end of the concatenated string; (3) lowercase the whole string;
 * (4) SHA512 it. Bare-value concatenation — NOT key=value pairs.
 *
 * Ozow's own docs describe exactly ONE procedure shared by both directions, over two different
 * documented field sets — one shared hash function serves both directions here, rather than two
 * separate builders.
 */

export const OZOW_PAY_URL = 'https://pay.ozow.com';

/** Ozow's documented anti-spoofing transaction-status API (README §4,
 *  contracts/golden/ozow-m1-f2b/README.md). ApiKey-authed GET, siteCode + transactionReference
 *  query params, returns an array of transaction objects. */
export const OZOW_TRANSACTION_STATUS_URL = 'https://api.ozow.com/GetTransactionByReference';

/** The 17 documented outbound post-variable names, excluding HashCheck itself, in Ozow's
 *  documented order. Order IS the signature base-string order — load-bearing. */
export const OZOW_OUTBOUND_FIELD_ORDER = [
  'SiteCode',
  'CountryCode',
  'CurrencyCode',
  'Amount',
  'TransactionReference',
  'BankReference',
  'Optional1',
  'Optional2',
  'Optional3',
  'Optional4',
  'Optional5',
  'Customer',
  'CancelUrl',
  'ErrorUrl',
  'SuccessUrl',
  'NotifyUrl',
  'IsTest',
] as const;

/** The 13 documented notification-response field names, excluding Hash itself, in Ozow's
 *  documented order. A genuinely different field set than the outbound order (TransactionId and
 *  Status exist only inbound; BankReference/CancelUrl/etc. only outbound) — not merely reordered,
 *  and not to be unified with OZOW_OUTBOUND_FIELD_ORDER. */
export const OZOW_NOTIFY_FIELD_ORDER = [
  'SiteCode',
  'TransactionId',
  'TransactionReference',
  'Amount',
  'Status',
  'Optional1',
  'Optional2',
  'Optional3',
  'Optional4',
  'Optional5',
  'CurrencyCode',
  'IsTest',
  'StatusMessage',
] as const;

/**
 * Concatenate the given fields' values, in the given order, as bare values (no keys, no
 * separators). Missing keys are treated as empty strings, mirroring how Ozow's own optional
 * fields (Optional1-5, Customer, StatusMessage) are sent empty rather than omitted.
 */
export function buildOzowConcatString(
  fields: Record<string, string>,
  order: readonly string[]
): string {
  return order.map((key) => fields[key] ?? '').join('');
}

/**
 * Generate an Ozow hash: build the ordered concatenation, append the private key, lowercase the
 * whole string, SHA512 it. One function serves both the outbound HashCheck and the inbound Hash —
 * Ozow's docs describe exactly one procedure for both directions over two different field sets;
 * the caller supplies which field set/order applies.
 */
export function generateOzowHash(
  fields: Record<string, string>,
  order: readonly string[],
  privateKey: string
): string {
  const concatenated = buildOzowConcatString(fields, order) + privateKey;
  return createHash('sha512').update(concatenated.toLowerCase()).digest('hex');
}
