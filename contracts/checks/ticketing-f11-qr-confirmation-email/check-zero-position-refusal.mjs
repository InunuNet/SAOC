#!/usr/bin/env node
// F11 (ticketing-foundation) — mission brief's explicit zero-position edge case. F10's real ITN
// call site always passes exactly one position (`positions: [outcome.position]`,
// contracts/golden/ticketing-f10-itn-repin/itn-route.expected.ts.txt) and
// markOrderAndPositionPaidByPaymentId structurally cannot resolve a paid order with zero
// positions today — so this case is NOT reachable through the real pinned route right now. It
// is still asserted because spec §6 explicitly designs sendConfirmationEmail() as a
// multi-position-capable function ("A family buying four tickets... iterates its child
// positions"), and a defensive refusal here is cheap insurance against a future caller (a
// multi-position order flow, or a bug upstream) reaching this function with an empty array.
//
// DEFEATING MUTATION this check kills: silently sending a "confirmation" email with a QR
// section that renders as empty/blank rather than refusing outright — that failure mode would
// reach a real buyer's inbox looking like a genuine, broken confirmation rather than failing
// loudly where deliverConfirmationEmailAfterCommit (already proven by F10's A7) can log it.
//
// NON-VACUOUS PROOF, not just "it throws": the check also asserts NEITHER the mailer NOR QR
// generation was ever invoked before the refusal — a mutation that generates QRs / calls the
// mailer and THEN throws afterwards would still "throw" but would have already leaked a
// side effect (an email attempt, a wasted QR render) this check would otherwise miss.
//
// Run as: npx tsx contracts/checks/ticketing-f11-qr-confirmation-email/check-zero-position-refusal.mjs

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];

let mailerCalled = false;
let qrCalled = false;

const fakeMailer = {
  send: async () => {
    mailerCalled = true;
  },
};
const fakeGenerateQr = async (bookingRef) => {
  qrCalled = true;
  return `data:image/png;base64,FAKE-${bookingRef}`;
};

let threw = false;
let caughtError = null;
try {
  await sendConfirmationEmail(
    {
      orderId: 'order-zero-positions',
      buyerEmail: 'buyer@example.test',
      buyerName: 'Buyer Person',
      recoveryToken: null,
      positions: [],
    },
    { mailer: fakeMailer, generateQrDataUri: fakeGenerateQr }
  );
} catch (error) {
  threw = true;
  caughtError = error;
}

if (!threw) {
  failures.push('sendConfirmationEmail() with an empty positions array did NOT throw/reject — an order with zero positions must be refused, not silently emailed.');
}
if (mailerCalled) {
  failures.push('mailer.send() was invoked despite zero positions — the refusal must happen BEFORE any send attempt, not merely eventually throw.');
}
if (qrCalled) {
  failures.push('generateQrDataUri() was invoked despite zero positions — no QR work should be attempted for an order with nothing to encode.');
}
if (threw && !(caughtError instanceof Error)) {
  failures.push('the rejection was not an Error instance — callers (deliverConfirmationEmailAfterCommit\'s onError) expect a real Error for logging.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: sendConfirmationEmail() refuses an order with zero positions before attempting any QR ' +
    'generation or mail send, rejecting with a real Error rather than silently sending a broken ' +
    'confirmation email.'
);
process.exit(0);
