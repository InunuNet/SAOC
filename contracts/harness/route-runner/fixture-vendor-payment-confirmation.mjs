// Overrides '@/lib/vendor-payment-confirmation' (vendor-payment-confirmation mission, F1) --
// the NEW vendor-facing "your stand payment is confirmed" receipt. Captures every call the
// real settlement handler (lib/vendor-stand-payment-notification.ts) makes to
// sendVendorPaymentConfirmationEmail, so a contract check can assert exact send COUNT (the
// idempotency property) and exact INPUT (the recipient-correctness property) without any
// network call or Resend credential.
//
// Same recorder shape as fixture-vendor-payment-admin-notice.mjs (its sibling override, added
// alongside this one) -- deliberately NOT a shared file, since the real project keeps these as
// two genuinely separate modules with two separate recipients, and the fixtures should mirror
// that separation rather than collapse it.
export const sentVendorPaymentConfirmations = [];

let shouldReject = false;
let rejectMessage = 'fixture: simulated vendor payment confirmation send failure';
// vendor-stand-payment-confirm-gate (F5) -- lets a check set a rejection message that embeds a
// realistic PII value (e.g. an email address, the shape a real provider validation error
// routinely takes), to prove the CALLER (lib/vendor-stand-payment-notification.ts) redacts a
// caught error's message before logging it, not just that the sender module itself stays
// PII-free (a separate, already-covered, static property).
export function setVendorPaymentConfirmationRejectMessage(message) {
  rejectMessage = message;
}
// vendor-stand-payment-confirm-gate (F2) -- lets a check simulate a send that NEVER resolves,
// to prove a hung send cannot block the sibling admin-notice send or the gateway's 200 ack.
// Deliberately a promise that never settles (not a long delay) -- the real fix's OWN bounded
// timeout is what must be observed making this resolve/reject, not this fixture racing itself.
let shouldHang = false;
export function setVendorPaymentConfirmationShouldHang(value) {
  shouldHang = value;
}

/** Lets a check simulate a rejecting mailer for exactly one settlement, to prove
 *  deliverConfirmationEmailAfterCommit isolation (a failed vendor receipt must never block the
 *  gateway's 200 ack or the sibling admin-notice send). Reset via
 *  resetVendorPaymentConfirmationFixture() between scenarios. */
export function setVendorPaymentConfirmationShouldReject(value) {
  shouldReject = value;
}

export async function sendVendorPaymentConfirmationEmail(input) {
  sentVendorPaymentConfirmations.push(input);
  if (shouldHang) {
    return new Promise(() => {}); // never resolves, never rejects
  }
  if (shouldReject) {
    throw new Error(rejectMessage);
  }
}

export function resetVendorPaymentConfirmationFixture() {
  sentVendorPaymentConfirmations.length = 0;
  shouldReject = false;
  rejectMessage = 'fixture: simulated vendor payment confirmation send failure';
  shouldHang = false;
}
