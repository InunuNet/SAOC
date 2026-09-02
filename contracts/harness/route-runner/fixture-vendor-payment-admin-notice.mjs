// Overrides '@/lib/vendor-payment-admin-notice' (vendor-payment-confirmation mission, F1) --
// added alongside fixture-vendor-payment-confirmation.mjs so a settlement-behaviour check can
// count and inspect BOTH emails the paid path fires, deterministically and network-free.
//
// Before this override existed, a route-runner check driving a real 'paid' ITN through
// lib/vendor-stand-payment-notification.ts exercised the REAL lib/vendor-payment-admin-notice.ts
// module, which called the REAL sendEmail() (Resend) -- silently rejecting in this environment
// (no RESEND_API_KEY) and getting swallowed by deliverConfirmationEmailAfterCommit's onError.
// That was harmless for the M3 settlement-idempotency check (contracts/checks/
// vendor-gated-registration-flow-m3/check-settlement-idempotent-and-guarded.mjs), which never
// asserted on email counts -- but it means this admin-notice send has never actually been
// behaviourally exercised end-to-end by any check in this repo. This override makes that
// exercisable for the first time.
export const sentVendorPaymentAdminNotices = [];

let shouldReject = false;
let rejectMessage = 'fixture: simulated admin payment notice send failure';
// vendor-stand-payment-confirm-gate (F5) -- see fixture-vendor-payment-confirmation.mjs's own
// setVendorPaymentConfirmationRejectMessage() comment for why this exists.
export function setVendorPaymentAdminNoticeRejectMessage(message) {
  rejectMessage = message;
}
// vendor-stand-payment-confirm-gate (F2) -- see fixture-vendor-payment-confirmation.mjs's own
// setVendorPaymentConfirmationShouldHang() comment for why this exists.
let shouldHang = false;
export function setVendorPaymentAdminNoticeShouldHang(value) {
  shouldHang = value;
}

export function setVendorPaymentAdminNoticeShouldReject(value) {
  shouldReject = value;
}

export async function sendVendorPaymentAdminNoticeEmail(input) {
  sentVendorPaymentAdminNotices.push(input);
  if (shouldHang) {
    return new Promise(() => {}); // never resolves, never rejects
  }
  if (shouldReject) {
    throw new Error(rejectMessage);
  }
}

export function resetVendorPaymentAdminNoticeFixture() {
  sentVendorPaymentAdminNotices.length = 0;
  shouldReject = false;
  rejectMessage = 'fixture: simulated admin payment notice send failure';
  shouldHang = false;
}
