import {
  buildOzowConcatString,
  generateOzowHash,
  OZOW_NOTIFY_FIELD_ORDER,
  OZOW_OUTBOUND_FIELD_ORDER,
  OZOW_PAY_URL,
  OZOW_TRANSACTION_STATUS_URL,
} from '@/lib/ozow';
import { BOOKING_REF_PREFIX } from '@/lib/booking-ref';

import type {
  ConfirmResult,
  InitiateInput,
  InitiateResult,
  NotificationRequestLike,
  PaymentProvider,
  PaymentStatus,
  ProviderNotification,
  ProviderOperation,
  ProviderReadiness,
  RefundInput,
  RefundResult,
  VerifyNotificationResult,
} from './types';

/**
 * Ozow adapter — a second implementation of the gateway-neutral PaymentProvider surface. This is
 * the ONLY file under lib/payments/ permitted to name Ozow, and it must remain fully independent
 * of any other gateway's adapter (different fields, different digest, different secret-placement
 * convention).
 *
 * F1 (mission ozow-payment-provider M1/F1) shipped this entirely additive, with refund() and
 * confirmNotification() both declared stubs (see their doc comments) rather than invented
 * integrations against unverified endpoint contracts. F2b superseded the confirmNotification()
 * half of that decision once Ozow's live GetTransactionByReference status API was independently
 * verified (contracts/golden/ozow-m1-f2b/README.md) — refund() is still a declared stub, unrelated
 * to that change. See contracts/golden/ozow-m1-f1/README.md for F1's original decision record.
 */

/** Ozow's 3-value documented Status enum. Only these three exist; there is no Pending. */
const STATUS_COMPLETE = 'Complete';
const STATUS_CANCELLED = 'Cancelled';
const STATUS_ERROR = 'Error';

/** Adapter-owned constants — sandbox-only throughout this mission, not caller input. */
const OZOW_COUNTRY_CODE = 'ZA';
const OZOW_CURRENCY_CODE = 'ZAR';
const OZOW_IS_TEST = 'true';

/**
 * The environment keys each operation needs, per operation and NOT globally. Ozow reuses
 * OZOW_SANDBOX_PRIVATE_KEY for both directions, but readiness still answers per-operation:
 * `initiate` needs the site code too, while `verify-notification` only ever needs the private key
 * to recompute an inbound digest.
 *
 * `initiate` ALSO requires OZOW_SANDBOX_API_KEY (added alongside F2b's real confirmNotification()):
 * ProviderOperation has no `confirm-notification` variant of its own (readiness() is never called
 * for it — the checkout route's only call site is `readiness('initiate')`,
 * app/api/tickets/checkout/route.ts:647), so `initiate`'s readiness check is the only gate that
 * ever runs before a buyer can select this gateway. Without the API key listed here, a deployment
 * missing ONLY OZOW_SANDBOX_API_KEY would report Ozow as ready, let a buyer pay, and then have
 * every notification for that order fail confirmNotification()'s own `not-configured` guard
 * (line ~270) with no way for the order to ever settle. Requiring it here, even though `initiate`
 * itself never reads it, is what makes readiness() answer the question callers actually ask —
 * "can a purchase started right now complete?" — not just "can the hand-off form be built?".
 */
const INITIATE_REQUIRED_KEYS: readonly string[] = [
  'OZOW_SANDBOX_SITE_CODE',
  'OZOW_SANDBOX_PRIVATE_KEY',
  'OZOW_SANDBOX_API_KEY',
];
const VERIFY_NOTIFICATION_REQUIRED_KEYS: readonly string[] = ['OZOW_SANDBOX_PRIVATE_KEY'];

/**
 * Fail closed on an operation this adapter does not recognise. Unreachable at the type level, but
 * a value crossing a module boundary at runtime is not type-checked — this returns a requirement
 * no environment can ever satisfy, so an unrecognised operation is always NOT ready.
 */
function requiredKeysFor(operation: ProviderOperation): readonly string[] {
  switch (operation) {
    case 'initiate':
      return INITIATE_REQUIRED_KEYS;
    case 'verify-notification':
      return VERIFY_NOTIFICATION_REQUIRED_KEYS;
    default:
      return [`unsupported operation: ${String(operation)}`];
  }
}

export interface OzowProviderDeps {
  /** Defaults to process.env. Resolved PER CALL, never captured at module load — Firebase App
   *  Hosting supplies these variables with RUNTIME availability only, so a snapshotting factory
   *  would refuse every real purchase in production while passing every offline test. */
  readonly env?: Record<string, string | undefined>;
  /** Defaults to globalThis.fetch. confirmNotification() calls this (F2b) against Ozow's
   *  GetTransactionByReference status API; refund() still does not — it remains a declared stub. */
  readonly fetch?: typeof fetch;
}

/**
 * Resolve the real-world client IP from Firebase App Hosting's GCLB-fronted request. GCLB appends
 * two entries to X-Forwarded-For: the client's IP, then the load balancer's own IP — the real
 * client IP is the second-to-last hop, never the last.
 */
function getOzowClientIp(request: NotificationRequestLike): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    const clientHop = hops[hops.length - 2];
    if (clientHop) return clientHop;
  }
  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() ?? null;
}

/**
 * Parses a decimal ZAR amount string, as Ozow sends it (e.g. "250.00"), into an integer number of
 * cents by string manipulation — never a float round-trip. Returns null for anything that isn't a
 * plain non-negative decimal with at most two fraction digits.
 */
function parseAmountToCents(raw: string): number | null {
  const trimmed = raw.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const wholePart = match[1];
  const fractionPart = (match[2] ?? '').padEnd(2, '0');
  return Number(wholePart) * 100 + Number(fractionPart);
}

/**
 * Parse an Ozow notification's raw form-urlencoded body into (fields, hash), preserving POSTED
 * order and excluding the posted 'Hash' field itself (the inbound signing field — NOT
 * 'HashCheck', which is only the outbound field name).
 */
function parseOzowNotifyFields(raw: string): {
  fields: Record<string, string>;
  hash: string | null;
} {
  const params = new URLSearchParams(raw);
  const fields: Record<string, string> = {};
  let hash: string | null = null;
  for (const [key, value] of params) {
    if (key === 'Hash') {
      hash = value;
      continue;
    }
    fields[key] = value;
  }
  return { fields, hash };
}

function fieldOrNull(fields: Record<string, string>, key: string): string | null {
  const value = fields[key];
  return value === undefined ? null : value;
}

/**
 * Ozow documents BankReference as String(20) — a hard cap. The full booking reference
 * (BOOKING_REF_PREFIX + a 12-char random segment) is always 22 characters, 2 over that
 * cap, and Ozow's sandbox silently rejects an over-length value before ever offering a
 * payment method (contracts/golden/ozow-m1-f1/README.md §4 amendment, F3). Strip the
 * prefix and send only the random segment, which is unique on its own and safely under
 * the limit. TransactionReference is unaffected — it keeps the full reference, well
 * within its own 50-char limit.
 */
function deriveOzowBankReference(reference: string): string {
  return reference.startsWith(BOOKING_REF_PREFIX)
    ? reference.slice(BOOKING_REF_PREFIX.length)
    : reference;
}

export function createOzowProvider(deps?: OzowProviderDeps): PaymentProvider {
  // Every accessor below is called PER REQUEST, not at construction — see OzowProviderDeps.env.
  const readEnv = (): Record<string, string | undefined> => deps?.env ?? process.env;
  const readFetch = (): typeof fetch => deps?.fetch ?? globalThis.fetch;

  return {
    id: 'ozow',

    readiness(operation: ProviderOperation): ProviderReadiness {
      // SYNCHRONOUS and OFFLINE by contract — see PaymentProvider's own doc comment. Config is
      // read HERE, per call, never captured at construction.
      const env = readEnv();
      const missing = requiredKeysFor(operation).filter((key) => !env[key]);
      if (missing.length > 0) {
        return { ready: false, reason: 'not-configured', missing };
      }
      return { ready: true };
    },

    async initiate(input: InitiateInput): Promise<InitiateResult> {
      const env = readEnv();
      const siteCode = env.OZOW_SANDBOX_SITE_CODE;
      const privateKey = env.OZOW_SANDBOX_PRIVATE_KEY;

      // Fail closed by RETURN VALUE, never by throwing, and the refusal carries nothing a caller
      // could mistake for a postable form. Empty string counts as missing, same as unset.
      if (!siteCode || !privateKey) {
        console.error(
          '[payments/ozow] Missing OZOW_SANDBOX_SITE_CODE or OZOW_SANDBOX_PRIVATE_KEY.'
        );
        return { ok: false, reason: 'not-configured' };
      }

      // Field mapping decisions fixed by this contract (README §4, amended F3): InitiateInput has
      // no direct equivalent for BankReference or ErrorUrl. BankReference = the reference's random
      // segment only (deriveOzowBankReference) — Ozow documents BankReference as String(20), and
      // the full reference is always 22 chars, so reusing it verbatim overflowed the cap and
      // silently failed every live transaction. ErrorUrl = cancelUrl (InitiateInput carries no
      // separate error URL). itemName is NOT sent — Ozow has no line-item-name concept in its post
      // variables.
      const signedFields: Record<string, string> = {
        SiteCode: siteCode,
        CountryCode: OZOW_COUNTRY_CODE,
        CurrencyCode: OZOW_CURRENCY_CODE,
        Amount: input.amountFormatted,
        TransactionReference: input.reference,
        BankReference: deriveOzowBankReference(input.reference),
        Optional1: '',
        Optional2: '',
        Optional3: '',
        Optional4: '',
        Optional5: '',
        Customer: '',
        CancelUrl: input.cancelUrl,
        ErrorUrl: input.cancelUrl,
        SuccessUrl: input.returnUrl,
        NotifyUrl: input.notifyUrl,
        IsTest: OZOW_IS_TEST,
      };
      const hashCheck = generateOzowHash(signedFields, OZOW_OUTBOUND_FIELD_ORDER, privateKey);

      return {
        ok: true,
        processUrl: OZOW_PAY_URL,
        method: 'POST',
        fields: { ...signedFields, HashCheck: hashCheck },
      };
    },

    async verifyNotification(request: NotificationRequestLike): Promise<VerifyNotificationResult> {
      const { fields, hash: receivedHash } = parseOzowNotifyFields(request.rawBody);
      const reference = fieldOrNull(fields, 'TransactionReference');

      // 1. The private key MUST be present, BEFORE any digest is computed — never compute a
      // digest against `undefined`.
      const privateKey = readEnv().OZOW_SANDBOX_PRIVATE_KEY;
      if (!privateKey) {
        console.error('[payments/ozow] Missing OZOW_SANDBOX_PRIVATE_KEY — rejecting.');
        return { verified: false, reason: 'not-configured', reference };
      }

      // 2. Hash presence, then recomputed over the fields using the DOCUMENTED inbound order
      // (OZOW_NOTIFY_FIELD_ORDER) — never the posted order, and never the outbound order/field
      // set (a real risk category this project has hit before with a different gateway).
      if (!receivedHash) {
        return { verified: false, reason: 'missing-signature', reference };
      }
      if (generateOzowHash(fields, OZOW_NOTIFY_FIELD_ORDER, privateKey) !== receivedHash) {
        return { verified: false, reason: 'signature-mismatch', reference };
      }

      // 3. Reference — checked AFTER the signature, so a forged body cannot change the reason.
      if (!reference) {
        return { verified: false, reason: 'missing-reference', reference: null };
      }

      const grossAmount = fieldOrNull(fields, 'Amount');
      const sourceIp = getOzowClientIp(request);
      const notification: ProviderNotification = {
        reference,
        rawStatus: fieldOrNull(fields, 'Status'),
        grossAmount,
        grossAmountCents: grossAmount === null ? null : parseAmountToCents(grossAmount),
        gatewayPaymentId: fieldOrNull(fields, 'TransactionId'),
        sourceIp,
        // Ozow's docs do not publish a fixed notification-source IP/host list — there is nothing
        // to resolve against, so this is always null ("could not be determined"), which the
        // interface already treats as advisory-only.
        sourceIpTrusted: null,
        raw: fields,
      };
      return { verified: true, notification };
    },

    async confirmNotification(notification: ProviderNotification): Promise<ConfirmResult> {
      // REAL, FAIL-CLOSED CALL (F2b) against Ozow's own documented anti-spoofing status API —
      // see contracts/golden/ozow-m1-f2b/README.md for the evidence this supersedes the F1 stub
      // decision with. The response shape is an evidence-based inference, not a captured live
      // response (README §2), so anything that doesn't exactly match expectation fails closed —
      // never a false confirmed:true.
      const env = readEnv();
      const siteCode = env.OZOW_SANDBOX_SITE_CODE;
      const apiKey = env.OZOW_SANDBOX_API_KEY;
      if (!siteCode || !apiKey) {
        console.error(
          '[payments/ozow] Missing OZOW_SANDBOX_SITE_CODE or OZOW_SANDBOX_API_KEY — rejecting.'
        );
        return { confirmed: false, reason: 'not-configured' };
      }

      const url = `${OZOW_TRANSACTION_STATUS_URL}?siteCode=${encodeURIComponent(siteCode)}&transactionReference=${encodeURIComponent(notification.reference)}`;

      let response: Response;
      try {
        response = await readFetch()(url, {
          method: 'GET',
          headers: { ApiKey: apiKey, Accept: 'application/json' },
        });
      } catch (error) {
        console.error('[payments/ozow] Transaction status request failed:', {
          reference: notification.reference,
          error,
        });
        return { confirmed: false, reason: 'request-failed' };
      }

      if (!response.ok) {
        console.error('[payments/ozow] Transaction status response was not ok.', {
          reference: notification.reference,
          status: response.status,
        });
        return { confirmed: false, reason: 'not-valid' };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        console.error('[payments/ozow] Transaction status response was not valid JSON.', {
          reference: notification.reference,
          error,
        });
        return { confirmed: false, reason: 'not-valid' };
      }
      if (!Array.isArray(body)) {
        console.error('[payments/ozow] Transaction status response was not an array.', {
          reference: notification.reference,
        });
        return { confirmed: false, reason: 'not-valid' };
      }

      // Ozow does not prevent duplicate merchant references (contracts/golden/ozow-m1-f2b/
      // README.md §1: "Both return 'an array of the transaction object' — an array because Ozow
      // does not prevent duplicate merchant references, so a caller must match on the specific
      // reference, not merely take the first result."). A buyer retrying/cancelling and
      // re-attempting checkout under the same TransactionReference is realistic, and this status
      // API can return one row per attempt — blindly taking body.find()'s first hit could confirm
      // against a stale/cancelled attempt instead of the one this notification is actually for.
      const referenceMatches = body.filter(
        (transaction): transaction is Record<string, unknown> =>
          typeof transaction === 'object' &&
          transaction !== null &&
          (transaction as Record<string, unknown>).TransactionReference === notification.reference
      );

      // A single row matching the reference is the common, unambiguous case — same behaviour as
      // before this fix. Disambiguation only matters once MORE THAN ONE row shares the reference.
      let matched: Record<string, unknown> | undefined;
      if (referenceMatches.length <= 1) {
        matched = referenceMatches[0];
      } else if (notification.gatewayPaymentId !== null) {
        // notification.gatewayPaymentId is Ozow's TransactionId, read off the inbound notification
        // in verifyNotification() (fieldOrNull(fields, 'TransactionId')) — a field distinct from
        // TransactionReference in Ozow's own documented 13-field notification-response table
        // (contracts/golden/ozow-m1-f1/README.md §1). It is the specific identifier for THIS
        // attempt, so among the ambiguous rows require an exact match on it too.
        const disambiguated = referenceMatches.filter(
          (transaction) => transaction.TransactionId === notification.gatewayPaymentId
        );
        if (disambiguated.length === 1) {
          matched = disambiguated[0];
        } else {
          console.error(
            '[payments/ozow] Ambiguous TransactionReference match — TransactionId did not uniquely disambiguate.',
            {
              reference: notification.reference,
              gatewayPaymentId: notification.gatewayPaymentId,
              matchCount: referenceMatches.length,
              disambiguatedCount: disambiguated.length,
            }
          );
          return { confirmed: false, reason: 'not-valid' };
        }
      } else {
        // No TransactionId to disambiguate with, and more than one row shares this
        // TransactionReference — picking one arbitrarily could confirm against the wrong attempt.
        // Fail closed rather than guess; this is an ordinary, diagnosable production condition
        // (order stays reserved, loudly logged), not a silent wrong-transaction confirmation.
        console.error(
          '[payments/ozow] Ambiguous TransactionReference match (multiple rows, no TransactionId to disambiguate).',
          { reference: notification.reference, matchCount: referenceMatches.length }
        );
        return { confirmed: false, reason: 'not-valid' };
      }

      if (!matched) {
        console.error('[payments/ozow] No matching TransactionReference in status response.', {
          reference: notification.reference,
        });
        return { confirmed: false, reason: 'not-valid' };
      }

      // Strict, case-sensitive equality — same discipline as mapStatus. No fuzzy match.
      if (matched.Status !== STATUS_COMPLETE) {
        return { confirmed: false, reason: 'not-valid' };
      }

      return { confirmed: true };
    },

    mapStatus(rawStatus: string | null): PaymentStatus {
      // Strict, case-sensitive, untrimmed — Ozow's documented 3-value enum has no Pending case,
      // and a case/whitespace "improvement" here would widen the one way an order becomes paid.
      switch (rawStatus) {
        case STATUS_COMPLETE:
          return 'paid';
        case STATUS_CANCELLED:
          return 'cancelled';
        case STATUS_ERROR:
          return 'failed';
        default:
          return 'unknown';
      }
    },

    async refund(_input: RefundInput): Promise<RefundResult> {
      // DECLARED SIGNATURE ONLY. Ozow's refund API is real and documented to exist, but its
      // field-level request/response shape and float/fee mechanics are open vendor questions out
      // of scope for this feature — refuse honestly, call nothing.
      return { ok: false, reason: 'not-supported' };
    },
  };
}

/** The default instance. Construction captures nothing — config is read per call. */
export const ozowProvider: PaymentProvider = createOzowProvider();
