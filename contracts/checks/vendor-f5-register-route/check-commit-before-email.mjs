#!/usr/bin/env node
// F5 (vendor-registration) — design constraint 2: commit-before-email, non-fatal email failure
// (the F10/F11 posture from ticketing-foundation). Two cases against the REAL
// handleVendorRegistration(), never a reimplementation:
//
// (a) deps.write succeeds, deps.sendConfirmationEmail REJECTS: the handler must still return
//     201 with the write's real id, and deps.onEmailError must be called with the real
//     rejection error — proving deliverConfirmationEmailAfterCommit (lib/confirmation-email.ts,
//     F10/F11) is genuinely wired in, not merely awaited-and-ignored.
// (b) deps.write REJECTS: the handler must return 500, and deps.sendConfirmationEmail must be
//     proven to have been called ZERO times — a call-order array both fakes push into is
//     inspected directly, not inferred from the response shape.
//
// Defeating mutation: calling sendConfirmationEmail before awaiting write() (or calling it
// regardless of write's outcome) — case (b)'s zero-calls assertion would then fail.
//
// FIXTURE NOTE (repaired 2026-09-02, architect pass on vendor-flow-notifications): this
// payload dated from 2026-08-18 (commit 521a233b) and predated M2's field-set changes, so it
// silently failed validation ('plant-sales' is no longer a member of VENDOR_CATEGORIES in
// lib/vendor-submissions.ts, and boothSize became required) — every assertion below was
// failing at 400 before ever reaching write()/sendConfirmationEmail(), so this check proved
// nothing for however long it sat red. Because tsconfig.json excludes contracts/, `pnpm
// type-check` never catches a stale fixture like this — see
// contracts/golden/vendor-flow-notifications/README.md.
//
// Run as: npx tsx contracts/checks/vendor-f5-register-route/check-commit-before-email.mjs

import { handleVendorRegistration } from '../../../lib/vendor-registration-handler.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');

const VALID_PAYLOAD = {
  businessName: 'Test Nursery',
  contactPersonName: 'Jane Grower',
  contactCellPhone: '+27821234567',
  contactEmail: 'jane@example.com',
  physicalAddress: '12 Orchid Lane, Stellenbosch, Western Cape, 7600',
  emergencyContactName: 'Peter Grower',
  emergencyContactCellPhone: '+27829876543',
  productDescription: 'Cymbidium and Cattleya orchids',
  vendorCategory: ['orchids'],
  boothCount: 1,
  boothSize: 'single',
  powerRequired: true,
  termsAccepted: true,
};

function baseDeps() {
  const callOrder = [];
  return {
    now: NOW,
    rateLimitKey: 'vendor-register-ip:203.0.113.5',
    getPriorAttempts: () => [],
    recordAttempt: () => {},
    callOrder,
  };
}

// (a) write succeeds, sendConfirmationEmail rejects — still 201, onEmailError called with the
// real rejection error.
async function checkEmailFailureNonFatal() {
  const deps = baseDeps();
  const emailError = new Error('resend delivery failed (fixture)');
  let capturedOnEmailError = null;

  const fullDeps = {
    ...deps,
    write: async (doc) => {
      deps.callOrder.push('write');
      return { id: 'real-write-id-123', doc };
    },
    sendConfirmationEmail: async () => {
      deps.callOrder.push('sendConfirmationEmail');
      throw emailError;
    },
    // G1 (vendor-flow-notifications) — VendorRegistrationHandlerDeps gained this required dep;
    // a resolving fake here so this check exercises the real, current deps shape rather than a
    // stale one TypeScript would reject at compile time but this plain-JS check would not.
    sendAdminNotice: async () => {
      deps.callOrder.push('sendAdminNotice');
    },
    onEmailError: (error) => {
      capturedOnEmailError = error;
    },
  };

  const result = await handleVendorRegistration(VALID_PAYLOAD, fullDeps);

  if (result.status !== 201) {
    failures.push(`(a) expected status 201 on a write success + email failure, got ${result.status}.`);
  }
  if (!result.body || result.body.success !== true || result.body.id !== 'real-write-id-123') {
    failures.push(
      `(a) expected body { success: true, id: 'real-write-id-123' }, got ${JSON.stringify(result.body)}.`,
    );
  }
  if (capturedOnEmailError !== emailError) {
    failures.push(
      `(a) deps.onEmailError was not called with the real rejection error — got ${String(capturedOnEmailError)}. ` +
        'This proves deliverConfirmationEmailAfterCommit is genuinely wired in, not awaited-and-ignored.',
    );
  }
  const writeIndex = deps.callOrder.indexOf('write');
  const emailIndex = deps.callOrder.indexOf('sendConfirmationEmail');
  if (writeIndex === -1 || emailIndex === -1 || writeIndex > emailIndex) {
    failures.push(`(a) expected call order [write, sendConfirmationEmail], got ${JSON.stringify(deps.callOrder)}.`);
  }
}

// (b) write rejects — 500, sendConfirmationEmail called ZERO times.
async function checkWriteFailureNeverEmails() {
  const deps = baseDeps();
  const writeError = new Error('firestore write failed (fixture)');

  const fullDeps = {
    ...deps,
    write: async () => {
      deps.callOrder.push('write');
      throw writeError;
    },
    sendConfirmationEmail: async () => {
      deps.callOrder.push('sendConfirmationEmail');
    },
    sendAdminNotice: async () => {
      deps.callOrder.push('sendAdminNotice');
    },
    onEmailError: () => {},
  };

  const result = await handleVendorRegistration(VALID_PAYLOAD, fullDeps);

  if (result.status !== 500) {
    failures.push(`(b) expected status 500 on a write failure, got ${result.status}.`);
  }
  const emailCallCount = deps.callOrder.filter((entry) => entry === 'sendConfirmationEmail').length;
  if (emailCallCount !== 0) {
    failures.push(
      `(b) deps.sendConfirmationEmail was called ${emailCallCount} time(s) after a write failure — ` +
        'a submission that was never persisted must never trigger a confirmation email.',
    );
  }
  // G1 — the write-failure short-circuit must also skip the new admin-notice call, same
  // reasoning as sendConfirmationEmail: a submission that was never persisted must never
  // trigger ANY notification.
  const adminNoticeCallCount = deps.callOrder.filter((entry) => entry === 'sendAdminNotice').length;
  if (adminNoticeCallCount !== 0) {
    failures.push(
      `(b) deps.sendAdminNotice was called ${adminNoticeCallCount} time(s) after a write failure — ` +
        'a submission that was never persisted must never trigger an admin notice either.',
    );
  }
}

await checkEmailFailureNonFatal();
await checkWriteFailureNeverEmails();

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a rejecting deps.sendConfirmationEmail never changes the 201 response and reaches ' +
    'deps.onEmailError with the real error; a rejecting deps.write returns 500 and never calls ' +
    'deps.sendConfirmationEmail.',
);
process.exit(0);
