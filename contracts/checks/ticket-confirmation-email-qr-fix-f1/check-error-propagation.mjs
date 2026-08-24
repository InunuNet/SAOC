#!/usr/bin/env node
// ticket-confirmation-email-qr-fix F1 — sendConfirmationEmail must faithfully PROPAGATE a
// failure from either generateQrPngBuffer (the new PNG-buffer QR generator this fix introduces)
// or mailer.send (now also carrying the attachments array) — the same error instance, not
// swallowed or replaced — and resolve cleanly when both succeed. Isolation from the payment path
// remains exclusively deliverConfirmationEmailAfterCommit's job (F10's A7); this proves THIS
// function does not swallow its own failures first.
//
// Run as: npx tsx contracts/checks/ticket-confirmation-email-qr-fix-f1/check-error-propagation.mjs

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];

const basePositions = [{ bookingRef: 'SAOC-2027-ERRPROP01', attendeeName: 'Attendee One', ticketType: 'general-admission' }];
const baseInput = {
  orderId: 'order-error-propagation',
  buyerEmail: 'buyer@example.test',
  buyerName: 'Buyer Person',
  recoveryToken: null,
  positions: basePositions,
};

async function expectPropagation(label, deps, expectedError) {
  let threw = false;
  let caught = null;
  try {
    await sendConfirmationEmail(baseInput, deps);
  } catch (error) {
    threw = true;
    caught = error;
  }
  if (!threw) {
    failures.push(`[${label}] sendConfirmationEmail resolved instead of rejecting.`);
    return;
  }
  if (caught !== expectedError) {
    failures.push(`[${label}] the caught error was not the SAME instance thrown by the dependency (swallowed/wrapped/replaced).`);
  }
}

const qrFailure = new Error('simulated generateQrPngBuffer failure');
await expectPropagation(
  'generateQrPngBuffer throws',
  {
    mailer: { send: async () => {} },
    generateQrPngBuffer: async () => {
      throw qrFailure;
    },
  },
  qrFailure
);

const mailerFailure = new Error('simulated mailer.send failure');
await expectPropagation(
  'mailer.send rejects',
  {
    mailer: {
      send: async () => {
        throw mailerFailure;
      },
    },
    generateQrPngBuffer: async (bookingRef) => Buffer.from(`FAKE-${bookingRef}`),
  },
  mailerFailure
);

// Success path: must resolve cleanly, with the attachments/positions correctly shaped, when
// both dependencies succeed.
{
  let resolved = false;
  let capturedAttachments = null;
  try {
    await sendConfirmationEmail(baseInput, {
      mailer: {
        send: async ({ attachments }) => {
          capturedAttachments = attachments;
        },
      },
      generateQrPngBuffer: async (bookingRef) => Buffer.from(`FAKE-${bookingRef}`),
    });
    resolved = true;
  } catch (error) {
    failures.push(`[success path] sendConfirmationEmail unexpectedly threw: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (resolved && (!Array.isArray(capturedAttachments) || capturedAttachments.length !== basePositions.length)) {
    failures.push('[success path] resolved, but attachments array shape did not match positions.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: sendConfirmationEmail propagates the exact error instance from generateQrPngBuffer or mailer.send, and resolves cleanly when both succeed.');
process.exit(0);
