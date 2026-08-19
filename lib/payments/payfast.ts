import { promises as dns } from 'node:dns';

import {
  buildPayfastNotifyParamString,
  generateNotifySignature,
  generateSignature,
  getClientIp,
  PAYFAST_ITN_HOSTS,
  PAYFAST_SANDBOX_PROCESS_URL,
  PAYFAST_SANDBOX_VALIDATE_URL,
} from '@/lib/payfast';

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
 * PayFast adapter — the first (and, in F1, only) implementation of the gateway-neutral
 * PaymentProvider surface. This is the ONLY file under lib/payments/ permitted to name PayFast.
 *
 * F1 is a PURE MOVE: every behaviour below is the behaviour app/api/tickets/checkout/route.ts and
 * app/api/tickets/itn/route.ts have today, reproduced byte-for-byte and pinned by
 * contracts/golden/payment-seam-f1/payfast-wire.golden.json. Neither route is rewired here — that
 * is F2 — so at the end of F1 this adapter is deliberately unreferenced production code.
 *
 * It composes the primitives already extracted into lib/payfast.ts rather than relocating them:
 * four other contracts' check scripts import them by that path.
 */

/** The one gateway status that may settle an order. Strict, case-sensitive, untrimmed. */
const COMPLETE_STATUS = 'COMPLETE';

/** PayFast's documented server-confirm success body, after trimming. */
const VALID_CONFIRMATION = 'VALID';

/** Content type PayFast's server-confirm endpoint expects. */
const CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';

/**
 * The environment keys each operation needs, per operation and NOT globally.
 *
 * The asymmetry is the point: the hand-off is signed with merchant credentials and has never
 * required a passphrase, while an inbound notification is authenticated with the passphrase and
 * nothing else. A single global probe would either demand a passphrase at checkout — refusing
 * purchases that succeed today — or let the notification path claim a readiness it does not have.
 *
 * These names are deliberately repeated rather than shared with initiate()/verifyNotification():
 * those two are byte-pinned pure moves (contracts/golden/payment-seam-f1/), and rewriting their
 * reads to go through a lookup table would change pinned code to save four string literals.
 * check-readiness-probe.mjs case 2 fails if the two ever disagree about which keys matter.
 */
const INITIATE_REQUIRED_KEYS: readonly string[] = [
  'PAYFAST_SANDBOX_MERCHANT_ID',
  'PAYFAST_SANDBOX_MERCHANT_KEY',
];
const VERIFY_NOTIFICATION_REQUIRED_KEYS: readonly string[] = ['PAYFAST_SANDBOX_PASSPHRASE'];

/**
 * Fail closed on an operation this adapter does not recognise. Unreachable at the type level, but
 * a value crossing a module boundary at runtime is not type-checked, and the wrong answer here is
 * "assume fine" — this returns a requirement no environment can ever satisfy, so an unrecognised
 * operation is always NOT ready.
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

export interface PayfastProviderDeps {
  /** Defaults to process.env. Resolved PER CALL, never captured at module load — Firebase App
   *  Hosting supplies these variables with RUNTIME availability only, so a snapshotting factory
   *  would refuse every real purchase in production while passing every offline test. */
  readonly env?: Record<string, string | undefined>;
  /** Defaults to globalThis.fetch. Injected so the server-confirm checks run offline. */
  readonly fetch?: typeof fetch;
  /** Defaults to DNS resolution of PAYFAST_ITN_HOSTS. Injected so verification runs offline. */
  readonly resolveTrustedIps?: () => Promise<Set<string>>;
}

/**
 * Resolve PayFast's published notification source hosts via DNS at request time. IPs are never
 * hardcoded; PayFast rotates them. Mirrors resolvePayfastIps() in the notification route.
 */
async function resolvePayfastIps(): Promise<Set<string>> {
  const ips = new Set<string>();
  await Promise.all(
    PAYFAST_ITN_HOSTS.map(async (host) => {
      try {
        const results = await dns.lookup(host, { all: true });
        for (const result of results) ips.add(result.address);
      } catch (error) {
        console.error(`[payments/payfast] DNS lookup failed for host ${host}:`, error);
      }
    })
  );
  return ips;
}

/**
 * Parse a raw notification body into (fields, signature), preserving POSTED order and excluding
 * the posted signature field.
 *
 * Iteration STOPS (`break`) at the signature key rather than skipping it and continuing, matching
 * PayFast's own reference implementation: a `continue`-based parse would fold any field arriving
 * after `signature` into the digest, which PayFast's algorithm never included.
 *
 * Exported because it is the gateway's own inbound body parse and three ticketing-F10 check
 * artefacts assert this exact property directly against it. It moved here from the notification
 * route in F2 (payment-provider-seam) along with everything else gateway-specific.
 */
export function parseOrderedFields(raw: string): {
  fields: Record<string, string>;
  signature: string | null;
} {
  const params = new URLSearchParams(raw);
  const fields: Record<string, string> = {};
  let signature: string | null = null;
  for (const [key, value] of params) {
    if (key === 'signature') {
      signature = value;
      break;
    }
    fields[key] = value;
  }
  return { fields, signature };
}

function fieldOrNull(fields: Record<string, string>, key: string): string | null {
  const value = fields[key];
  return value === undefined ? null : value;
}

/**
 * Parses a decimal ZAR amount string, as PayFast sends it (e.g. "150.00"), into an integer
 * number of cents by string manipulation — never a `Number(x) * 100` float round-trip. Codex
 * GPT-5.5 cross-model review (2026-08-20): `Math.abs(Number('0.02') - 0.03)` is
 * `0.009999999999999998`, so the old float subtraction let a gross amount one cent below a
 * cent-priced order pass the caller's rejection rule — a real underpayment accepted as paid in
 * full. Returns null for anything that isn't a plain non-negative decimal with at most two
 * fraction digits (PayFast always sends `amount_gross` in that exact shape); null is treated as
 * unparseable by the caller, same as before.
 *
 * This is FORMAT TRANSLATION — the same category as mapStatus translating PayFast's status
 * vocabulary — so it lives here, not in the route. Judging whether the resulting number is
 * acceptably close to what we are owed stays the route's decision; this function only computes
 * cents, it never decides acceptability. See the F2 A1 ruling in the mission notes.
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

export function createPayfastProvider(deps?: PayfastProviderDeps): PaymentProvider {
  // Every accessor below is called PER REQUEST, not at construction — see PayfastProviderDeps.env.
  const readEnv = (): Record<string, string | undefined> => deps?.env ?? process.env;
  const readFetch = (): typeof fetch => deps?.fetch ?? globalThis.fetch;
  const readTrustedIps = (): (() => Promise<Set<string>>) =>
    deps?.resolveTrustedIps ?? resolvePayfastIps;

  return {
    id: 'payfast',

    readiness(operation: ProviderOperation): ProviderReadiness {
      // SYNCHRONOUS and OFFLINE by contract: this sits in front of every checkout, so it must not
      // cost a network round trip, and it must not be a promise — a caller who forgets to await a
      // readiness check gets a truthy object and fails OPEN, which is the failure this exists to
      // prevent. Config is read HERE, per call, never captured at construction: Firebase App
      // Hosting supplies these variables with runtime availability only.
      const env = readEnv();
      const missing = requiredKeysFor(operation).filter((key) => !env[key]);
      if (missing.length > 0) {
        return { ready: false, reason: 'not-configured', missing };
      }
      return { ready: true };
    },

    async initiate(input: InitiateInput): Promise<InitiateResult> {
      const env = readEnv();
      const merchantId = env.PAYFAST_SANDBOX_MERCHANT_ID;
      const merchantKey = env.PAYFAST_SANDBOX_MERCHANT_KEY;

      // Fail closed by RETURN VALUE, never by throwing, and the refusal carries nothing a caller
      // could mistake for a postable form. Empty string counts as missing, same as unset.
      if (!merchantId || !merchantKey) {
        console.error(
          '[payments/payfast] Missing PAYFAST_SANDBOX_MERCHANT_ID or PAYFAST_SANDBOX_MERCHANT_KEY.'
        );
        return { ok: false, reason: 'not-configured' };
      }

      // No passphrase guard here, deliberately: the checkout path has never had one and
      // generateSignature folds the passphrase in only when truthy. The asymmetry with
      // verifyNotification's guard is correct and must not be tidied away.
      const passphrase = env.PAYFAST_SANDBOX_PASSPHRASE;

      // Insertion order IS the signature base-string order (PayFast uses attribute order, not
      // alphabetical). The signature is computed last, over the other eight fields.
      const signedFields: Record<string, string> = {
        merchant_id: merchantId,
        merchant_key: merchantKey,
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        notify_url: input.notifyUrl,
        m_payment_id: input.reference,
        amount: input.amountFormatted,
        item_name: input.itemName,
      };
      const signature = generateSignature(signedFields, passphrase);

      return {
        ok: true,
        processUrl: PAYFAST_SANDBOX_PROCESS_URL,
        method: 'POST',
        fields: { ...signedFields, signature },
      };
    },

    async verifyNotification(request: NotificationRequestLike): Promise<VerifyNotificationResult> {
      const { fields, signature: receivedSignature } = parseOrderedFields(request.rawBody);
      const reference = fieldOrNull(fields, 'm_payment_id');

      // 1. The passphrase MUST be present, BEFORE any digest is computed. generateNotifySignature
      // folds it in only when truthy, so an unset passphrase would silently downgrade verification
      // to a plain MD5 over publicly-known fields and anyone could mark their own order paid.
      const passphrase = readEnv().PAYFAST_SANDBOX_PASSPHRASE;
      if (!passphrase) {
        console.error('[payments/payfast] Missing PAYFAST_SANDBOX_PASSPHRASE — rejecting.');
        return { verified: false, reason: 'not-configured', reference };
      }

      // 2. Signature, recomputed over the fields AS RECEIVED in received order using the INBOUND
      // algorithm (no trim, no blank-skip) — genuinely different from the outbound one.
      if (!receivedSignature) {
        return { verified: false, reason: 'missing-signature', reference };
      }
      if (generateNotifySignature(fields, passphrase) !== receivedSignature) {
        return { verified: false, reason: 'signature-mismatch', reference };
      }

      // 3. Source IP — resolved only now, so a failing signature never triggers DNS. LOGGED, NOT
      // ENFORCED since 2026-08-18: a genuine signature-verified sandbox notification arrived from
      // outside the resolved host set, so this is advisory and can never flip `verified`.
      const sourceIp = getClientIp(request);
      let sourceIpTrusted: boolean | null = null;
      if (sourceIp) {
        try {
          sourceIpTrusted = (await readTrustedIps()()).has(sourceIp);
        } catch (error) {
          console.error('[payments/payfast] Source IP resolution failed (advisory only):', error);
          sourceIpTrusted = null;
        }
      }

      // 4. Reference — checked AFTER the signature, so a forged body cannot change the reason.
      if (!reference) {
        return { verified: false, reason: 'missing-reference', reference: null };
      }

      const amountGross = fieldOrNull(fields, 'amount_gross');
      const notification: ProviderNotification = {
        reference,
        rawStatus: fieldOrNull(fields, 'payment_status'),
        grossAmount: amountGross,
        grossAmountCents: amountGross === null ? null : parseAmountToCents(amountGross),
        gatewayPaymentId: fieldOrNull(fields, 'pf_payment_id'),
        sourceIp,
        sourceIpTrusted,
        raw: fields,
      };
      return { verified: true, notification };
    },

    async confirmNotification(notification: ProviderNotification): Promise<ConfirmResult> {
      // The body is the INBOUND param string — the same bytes the digest was computed over.
      // PayFast specifies one inbound param string, reused for both purposes. Built here with
      // the inbound builder and nowhere else: reusing the OUTBOUND builder for this body is the
      // pre-F10 defect that contract-payfast-itn-signature A6 exists to catch, and that
      // assertion greps this exact expression (it moved here from the route in F2).
      const fields = { ...notification.raw };
      try {
        const response = await readFetch()(PAYFAST_SANDBOX_VALIDATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': CONTENT_TYPE_FORM_URLENCODED },
          body: buildPayfastNotifyParamString(fields),
        });
        const text = (await response.text()).trim();
        if (text !== VALID_CONFIRMATION) {
          console.error('[payments/payfast] Server confirmation did not return VALID.', {
            reference: notification.reference,
            status: response.status,
          });
          return { confirmed: false, reason: 'not-valid' };
        }
        return { confirmed: true };
      } catch (error) {
        console.error('[payments/payfast] Server confirmation request failed:', {
          reference: notification.reference,
          error,
        });
        return { confirmed: false, reason: 'request-failed' };
      }
    },

    mapStatus(rawStatus: string | null): PaymentStatus {
      // Strict, case-sensitive, untrimmed — exactly one input may yield 'paid'. A toUpperCase()
      // or trim() "improvement" here would widen the one way an order becomes paid.
      switch (rawStatus) {
        case COMPLETE_STATUS:
          return 'paid';
        case 'FAILED':
          return 'failed';
        case 'PENDING':
          return 'pending';
        case 'CANCELLED':
          return 'cancelled';
        default:
          return 'unknown';
      }
    },

    async refund(_input: RefundInput): Promise<RefundResult> {
      // DECLARED SIGNATURE ONLY. There is no refund code anywhere in this repository, so a pure
      // move has nothing to move; writing a PayFast refund integration here would be new,
      // unverifiable behaviour smuggled in under a refactor. Refuse honestly, call nothing.
      return { ok: false, reason: 'not-supported' };
    },
  };
}

/** The default instance. Construction captures nothing — config is read per call. */
export const payfastProvider: PaymentProvider = createPayfastProvider();
