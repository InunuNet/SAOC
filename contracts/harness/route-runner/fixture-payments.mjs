// Fake PaymentProvider pair (M3, vendor-gated-registration-flow) -- overrides '@/lib/payments',
// '@/lib/payments/payfast' and '@/lib/payments/ozow' so the real initiate/settlement routes can
// be exercised without a real gateway. verifyNotification() reads a harness-controlled JSON
// body directly (rawBody is JSON, not a gateway's real wire format) -- this fixture's whole job
// is to let the test construct exact ProviderNotification values, not to reproduce a gateway's
// signing scheme.
export const initiateCalls = [];

let readinessOverride = { ready: true };
export function setReadiness(value) {
  readinessOverride = value;
}

// vendor-stand-payment-confirm-gate (F1) additions -- lets a check force
// confirmNotification()'s ConfirmResult for every provider, and records every call made to it
// (provider id + the notification's reference) so a check can assert BOTH the outcome (does an
// unconfirmed notification settle the order) and the call itself (was confirmNotification
// actually invoked, and how many times -- e.g. an already-settled duplicate notification should
// short-circuit BEFORE ever reaching it, same as the real gateway round trip must never be
// spent on a no-op). Defaults to `{ confirmed: true }` so every check written before this
// feature (which never touches this override) keeps its existing passing behaviour unchanged.
let confirmNotificationResult = { confirmed: true };
export const confirmNotificationCalls = [];
export function setConfirmNotificationResult(value) {
  confirmNotificationResult = value;
}

// vendor-stand-payment-confirm-gate (F6) addition -- lets a check force a DIFFERENT
// ConfirmResult on each successive confirmNotification() call within the SAME check, not just
// a single static value for the whole check (setConfirmNotificationResult above). Needed to
// reproduce F6's transaction-retry defect, where confirmNotification() is called once per
// Firestore transaction attempt (see fixture-firestore.mjs's simulateTransactionRetries) and
// the bug depends on DIFFERENT attempts seeing different confirm outcomes (e.g. the first,
// discarded attempt confirms genuinely; the second, committing attempt sees a transient
// failure). `null`/unset (the default) means "ignore the sequence, use the static
// confirmNotificationResult value" -- fully backward compatible with every check that predates
// this addition. Once the sequence is exhausted, the LAST entry repeats for any further call
// (matches "the sequence describes exactly how many calls this scenario expects" for tests that
// only care about the first N).
let confirmNotificationResultSequence = null;
export function setConfirmNotificationResultSequence(values) {
  confirmNotificationResultSequence = values;
}

export function resetPaymentsFixture() {
  readinessOverride = { ready: true };
  initiateCalls.length = 0;
  confirmNotificationResult = { confirmed: true };
  confirmNotificationResultSequence = null;
  confirmNotificationCalls.length = 0;
}

function makeProvider(id) {
  return {
    id,
    readiness: () => readinessOverride,
    initiate: async (input) => {
      initiateCalls.push({ providerId: id, ...input });
      return {
        ok: true,
        processUrl: `https://fake-gateway.test/${id}`,
        method: 'POST',
        fields: { reference: input.reference, amount: input.amountFormatted },
      };
    },
    verifyNotification: async ({ rawBody }) => {
      const parsed = JSON.parse(rawBody);
      if (parsed.__invalidSignature) {
        return { verified: false, reason: 'signature-mismatch', reference: parsed.reference ?? null };
      }
      return {
        verified: true,
        notification: {
          reference: parsed.reference ?? null,
          rawStatus: parsed.rawStatus ?? null,
          grossAmount: parsed.grossAmount ?? null,
          grossAmountCents: parsed.grossAmountCents ?? null,
          gatewayPaymentId: parsed.gatewayPaymentId ?? null,
          sourceIp: null,
          sourceIpTrusted: null,
          raw: {},
        },
      };
    },
    confirmNotification: async (notification) => {
      const callIndex = confirmNotificationCalls.length;
      confirmNotificationCalls.push({ providerId: id, reference: notification?.reference ?? null });
      if (confirmNotificationResultSequence) {
        const index = Math.min(callIndex, confirmNotificationResultSequence.length - 1);
        return confirmNotificationResultSequence[index];
      }
      return confirmNotificationResult;
    },
    mapStatus: (rawStatus) => {
      if (rawStatus === 'paid') return 'paid';
      if (rawStatus === 'failed') return 'failed';
      if (rawStatus === 'cancelled') return 'cancelled';
      return 'unknown';
    },
    refund: async () => ({ ok: false, reason: 'not-supported' }),
  };
}

export const payfastProvider = makeProvider('payfast');
export const ozowProvider = makeProvider('ozow');

const providersById = { payfast: payfastProvider, ozow: ozowProvider };

export function resolveProvider(id) {
  return Object.prototype.hasOwnProperty.call(providersById, id) ? providersById[id] : null;
}
