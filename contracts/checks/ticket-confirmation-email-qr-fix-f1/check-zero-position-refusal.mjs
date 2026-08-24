#!/usr/bin/env node
// ticket-confirmation-email-qr-fix F1 — regression check: sendConfirmationEmail must still
// refuse SYNCHRONOUSLY, before any QR generation or mailer call, when given an empty positions
// array. Unchanged property from F11's A5; re-asserted because the function body (and the QR
// generator it calls) changed with this fix — a refactor could easily move the guard after the
// first generateQrPngBuffer() call.
//
// DEFEATING MUTATION this check kills: the empty-array guard being removed, moved after QR
// generation begins, or moved after the mailer is called.
//
// Run as: npx tsx contracts/checks/ticket-confirmation-email-qr-fix-f1/check-zero-position-refusal.mjs

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];

let qrGeneratorCalled = false;
let mailerCalled = false;

const fakeMailer = {
  send: async () => {
    mailerCalled = true;
  },
};

const fakeGenerateQrPngBuffer = async (bookingRef) => {
  qrGeneratorCalled = true;
  return Buffer.from(`FAKE-${bookingRef}`);
};

let threw = false;
let thrownError = null;
try {
  await sendConfirmationEmail(
    {
      orderId: 'order-zero-positions',
      buyerEmail: 'buyer@example.test',
      buyerName: 'Buyer Person',
      recoveryToken: null,
      positions: [],
    },
    { mailer: fakeMailer, generateQrPngBuffer: fakeGenerateQrPngBuffer }
  );
} catch (error) {
  threw = true;
  thrownError = error;
}

if (!threw) {
  failures.push('sendConfirmationEmail did not throw for an empty positions array.');
} else if (!(thrownError instanceof Error)) {
  failures.push(`sendConfirmationEmail rejected with a non-Error value: ${JSON.stringify(thrownError)}.`);
}

if (qrGeneratorCalled) {
  failures.push('generateQrPngBuffer was called despite an empty positions array — the refusal must happen BEFORE any QR generation.');
}
if (mailerCalled) {
  failures.push('mailer.send was called despite an empty positions array — the refusal must happen BEFORE any mailer call.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: sendConfirmationEmail refuses an empty positions array synchronously, before any QR generation or mailer call.');
process.exit(0);
