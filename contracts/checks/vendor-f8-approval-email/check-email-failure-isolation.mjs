#!/usr/bin/env node
// F8 (vendor-registration) — A6: EMAIL-FAILURE-NEVER-BLOCKS proof. Composes the REAL,
// already-shipped deliverConfirmationEmailAfterCommit (lib/confirmation-email.ts,
// ticketing-foundation F10/F11) with the REAL sendVendorApprovalConfirmationEmail
// (lib/vendor-approval-confirmation.ts) and a fixture mailer, proving THIS feature's specific
// composition still honours the generic contract: a rejecting mailer resolves the composed
// call and calls onError exactly once; a resolving mailer resolves and never calls onError.
//
// This does NOT re-derive deliverConfirmationEmailAfterCommit's own generic contract (already
// proven by F10/F11's own tests) — it proves this new call site doesn't reintroduce a second,
// unwrapped path or a swallowing inner try/catch that changes onError's arity/timing.
//
// DEFEATING MUTATION: an inner try/catch inside sendVendorApprovalConfirmationEmail (or a
// wrapper around it) that silently resolves instead of letting a mailer rejection propagate to
// deliverConfirmationEmailAfterCommit's own catch.
//
// MUST be run with `npx tsx`, NOT `node --import tsx/esm` — this repo's known env quirk:
// node --import tsx/esm cannot chain a @/lib -> @/lib alias import (lib/vendor-approval-
// confirmation.ts imports @/lib/email and @/emails/VendorApprovalConfirmation); npx tsx
// resolves the same chain correctly. See check-full-logistics-render.mjs's header for how this
// was confirmed against this repo's own shipped ticketing-f11 check.
//
// Run as: npx tsx contracts/checks/vendor-f8-approval-email/check-email-failure-isolation.mjs

import { deliverConfirmationEmailAfterCommit } from '../../../lib/confirmation-email.ts';
import { sendVendorApprovalConfirmationEmail } from '../../../lib/vendor-approval-confirmation.ts';

const failures = [];

const BASE_INPUT = {
  businessName: 'Cape Orchid Traders',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  boothNumber: 'A12',
  powerRequired: true,
};

// (1) A rejecting mailer: the composed call must resolve (not throw), and onError must be
// called exactly once with the real rejection reason.
{
  const rejectionError = new Error('fixture: Resend unavailable');
  const rejectingMailer = { send: async () => { throw rejectionError; } };
  let onErrorCalls = 0;
  let capturedError;

  let threw = false;
  try {
    await deliverConfirmationEmailAfterCommit(
      () => sendVendorApprovalConfirmationEmail(BASE_INPUT, { mailer: rejectingMailer }),
      (error) => {
        onErrorCalls += 1;
        capturedError = error;
      },
    );
  } catch {
    threw = true;
  }

  if (threw) {
    failures.push('(1) the composed call threw instead of resolving — a rejecting mailer must never propagate.');
  }
  if (onErrorCalls !== 1) {
    failures.push(`(1) expected onError to be called exactly once, was called ${onErrorCalls} time(s).`);
  }
  if (capturedError !== rejectionError) {
    failures.push('(1) onError was not called with the real rejection reason — the original error was lost or wrapped.');
  }
}

// (2) A resolving mailer: the composed call must resolve, and onError must never be called.
{
  const resolvingMailer = { send: async () => {} };
  let onErrorCalls = 0;

  let threw = false;
  try {
    await deliverConfirmationEmailAfterCommit(
      () => sendVendorApprovalConfirmationEmail(BASE_INPUT, { mailer: resolvingMailer }),
      () => {
        onErrorCalls += 1;
      },
    );
  } catch {
    threw = true;
  }

  if (threw) {
    failures.push('(2) the composed call threw for a resolving mailer.');
  }
  if (onErrorCalls !== 0) {
    failures.push(`(2) expected onError to be called zero times for a resolving mailer, was called ${onErrorCalls} time(s).`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: deliverConfirmationEmailAfterCommit composed with the real ' +
    'sendVendorApprovalConfirmationEmail resolves without throwing and calls onError exactly ' +
    'once for a rejecting mailer, and resolves with onError never called for a resolving mailer.',
);
process.exit(0);
