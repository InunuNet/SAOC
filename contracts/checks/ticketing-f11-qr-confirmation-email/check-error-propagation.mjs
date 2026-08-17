#!/usr/bin/env node
// F11 (ticketing-foundation) — a DIFFERENT property from F10's A7
// (check-email-failure-does-not-block.mjs), not a re-assertion of it under a new number (the
// dispatch flags exactly this recurring defect class — a claim broader than what its cases
// vary). F10's A7 proves deliverConfirmationEmailAfterCommit() (the WRAPPER) swallows a failure
// from whatever send() it is given. THIS check proves sendConfirmationEmail() (the FUNCTION
// F11 owns, called BY that wrapper) does the opposite: it must faithfully PROPAGATE a failure
// from either the mailer or QR generation, not swallow it itself.
//
// Why this matters even though the wrapper "handles" failures either way: if
// sendConfirmationEmail() ate its own errors and resolved successfully, onError would never
// fire, deliverConfirmationEmailAfterCommit's isolation would have nothing to isolate, and a
// genuinely failed send (a bad Resend API key, a QR library crash) would be INVISIBLE to
// Cloud Logging — the exact "unreconciled payment, logged but not auto-recovered" failure mode
// F10's own README describes, except with no log entry at all.
//
// DEFEATING MUTATION this check kills: wrapping sendConfirmationEmail()'s body in its own
// try/catch that logs-and-swallows (or silently resolves) instead of letting the error
// propagate to its caller.
//
// DIMENSION THAT VARIES ACROSS CASES: which dependency fails — generateQrDataUri vs.
// mailer.send — proving propagation isn't accidentally implemented for only one of the two
// external calls this function makes.
//
// Run as: npx tsx contracts/checks/ticketing-f11-qr-confirmation-email/check-error-propagation.mjs

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];

const basicInput = {
  orderId: 'order-propagation',
  buyerEmail: 'buyer@example.test',
  buyerName: 'Buyer Person',
  recoveryToken: null,
  positions: [{ bookingRef: 'SAOC-2027-PROPAGATE1', attendeeName: 'Attendee', ticketType: 'general-admission' }],
};

// (1) QR generation fails.
{
  const boom = new Error('simulated QR failure');
  let thrown = null;
  try {
    await sendConfirmationEmail(basicInput, {
      mailer: { send: async () => {} },
      generateQrDataUri: async () => {
        throw boom;
      },
    });
  } catch (error) {
    thrown = error;
  }
  if (!thrown) failures.push('(1) sendConfirmationEmail resolved successfully despite generateQrDataUri throwing — the failure was swallowed instead of propagated.');
  else if (thrown !== boom) failures.push('(1) sendConfirmationEmail rejected with a DIFFERENT error than the one generateQrDataUri threw — the original failure/diagnostic detail was lost.');
}

// (2) Mailer send fails.
{
  const boom = new Error('simulated mailer failure');
  let thrown = null;
  try {
    await sendConfirmationEmail(basicInput, {
      mailer: {
        send: async () => {
          throw boom;
        },
      },
    });
  } catch (error) {
    thrown = error;
  }
  if (!thrown) failures.push('(2) sendConfirmationEmail resolved successfully despite mailer.send throwing — the failure was swallowed instead of propagated.');
  else if (thrown !== boom) failures.push('(2) sendConfirmationEmail rejected with a DIFFERENT error than the one mailer.send threw — the original failure/diagnostic detail was lost.');
}

// (3) Non-vacuous positive control — everything succeeds, must resolve cleanly (without this,
// a function that ALWAYS rejects would still pass (1)/(2)).
{
  let resolvedCleanly = false;
  try {
    await sendConfirmationEmail(basicInput, { mailer: { send: async () => {} } });
    resolvedCleanly = true;
  } catch {
    resolvedCleanly = false;
  }
  if (!resolvedCleanly) failures.push('(3) sendConfirmationEmail rejected even though both dependencies succeeded — a mutation that always rejects would still pass (1)/(2) but must fail here.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: sendConfirmationEmail() faithfully propagates a failure from either QR generation or ' +
    'the mailer (the SAME error instance, not a swallowed/replaced one) rather than eating it ' +
    'itself, and resolves cleanly when both dependencies succeed. Isolation from the payment ' +
    "path is exclusively deliverConfirmationEmailAfterCommit's job (proven by F10's A7), not " +
    "this function's."
);
process.exit(0);
