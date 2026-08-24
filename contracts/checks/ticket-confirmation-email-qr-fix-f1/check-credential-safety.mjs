#!/usr/bin/env node
// ticket-confirmation-email-qr-fix F1 — regression check: sendConfirmationEmail must never write
// recoveryToken's value (or any bookingRef/PII) to console output or into a thrown error's
// message/stack, on the success path or a QR-generation-failure path. Unchanged property from
// F11's A7; re-asserted because this fix touches the QR-generation call site directly.
//
// Run as: npx tsx contracts/checks/ticket-confirmation-email-qr-fix-f1/check-credential-safety.mjs

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];
const SECRET_TOKEN = 'super-secret-recovery-token-should-never-be-logged-XYZ123';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const capturedLogs = [];
function captureLog(...args) {
  capturedLogs.push(args.map((a) => String(a)).join(' '));
}
console.log = captureLog;
console.error = captureLog;
console.warn = captureLog;

async function restoreConsole() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
}

try {
  // Success path.
  capturedLogs.length = 0;
  await sendConfirmationEmail(
    {
      orderId: 'order-credential-safety',
      buyerEmail: 'buyer@example.test',
      buyerName: 'Buyer Person',
      recoveryToken: SECRET_TOKEN,
      positions: [{ bookingRef: 'SAOC-2027-CREDSAFE01', attendeeName: 'Attendee One', ticketType: 'general-admission' }],
    },
    {
      mailer: { send: async () => {} },
      generateQrPngBuffer: async (bookingRef) => Buffer.from(`FAKE-${bookingRef}`),
    }
  );
  if (capturedLogs.some((line) => line.includes(SECRET_TOKEN))) {
    failures.push('SUCCESS path: recoveryToken value appeared in console output.');
  }

  // QR-generation-failure path.
  capturedLogs.length = 0;
  let threw = false;
  let thrownMessage = '';
  try {
    await sendConfirmationEmail(
      {
        orderId: 'order-credential-safety-failure',
        buyerEmail: 'buyer@example.test',
        buyerName: 'Buyer Person',
        recoveryToken: SECRET_TOKEN,
        positions: [{ bookingRef: 'SAOC-2027-CREDSAFE02', attendeeName: 'Attendee One', ticketType: 'general-admission' }],
      },
      {
        mailer: { send: async () => {} },
        generateQrPngBuffer: async () => {
          throw new Error('simulated QR generation failure');
        },
      }
    );
  } catch (error) {
    threw = true;
    thrownMessage = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  }
  if (!threw) {
    failures.push('QR-generation-failure path: sendConfirmationEmail did not propagate the failure.');
  }
  if (thrownMessage.includes(SECRET_TOKEN)) {
    failures.push('QR-generation-failure path: recoveryToken value appeared in the thrown error message/stack.');
  }
  if (capturedLogs.some((line) => line.includes(SECRET_TOKEN))) {
    failures.push('QR-generation-failure path: recoveryToken value appeared in console output.');
  }
} finally {
  await restoreConsole();
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: sendConfirmationEmail never logs or throws recoveryToken\'s value, on the success or QR-failure path.');
process.exit(0);
