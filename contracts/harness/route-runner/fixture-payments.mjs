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
export function resetPaymentsFixture() {
  readinessOverride = { ready: true };
  initiateCalls.length = 0;
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
    confirmNotification: async () => ({ confirmed: true }),
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
