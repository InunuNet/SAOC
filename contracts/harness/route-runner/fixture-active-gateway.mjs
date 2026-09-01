// Overrides '@/lib/payments/active-gateway' (M3, vendor-gated-registration-flow) -- a
// harness-controlled stand-in for the adminSettings/activePaymentGateway Firestore read.
export const GATEWAY_IDS = ['ozow', 'payfast'];

let activeGateway = 'payfast';

export function setActiveGateway(value) {
  activeGateway = value;
}

export function isValidGatewayId(value) {
  return typeof value === 'string' && GATEWAY_IDS.includes(value);
}

export async function resolveActiveGateway() {
  return activeGateway;
}
