// Overrides '@/lib/vendor-stand-payment-notice' (M3, vendor-gated-registration-flow) --
// captures what the stand-payment-ready email WOULD have been sent, so the harness can read
// the token the vendor actually receives (and verify it against a real initiate call), instead
// of a token the route happens to have in a local variable.
export const sentStandPaymentEmails = [];

export async function sendVendorStandPaymentNoticeEmail(input) {
  sentStandPaymentEmails.push(input);
}
