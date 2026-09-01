#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A8: EMAIL-FAILURE-NEVER-BLOCKS proof, across all four new
// sender modules. Composes the REAL deliverConfirmationEmailAfterCommit
// (lib/confirmation-email.ts) with each REAL send function and a fixture mailer, proving each
// composition: a rejecting mailer resolves (never throws) and calls onError exactly once with
// the real rejection reason; a resolving mailer resolves and never calls onError. This is the
// paired PRESENCE half of "never blocks" — check-recipients-allowlist-only.mjs already proves
// mailer.send(...) is actually called by the three admin-notice modules; this proves a call
// that FAILS still doesn't propagate, AND (via the resolving-mailer case) that mailer.send was
// genuinely attempted, not skipped.
//
// For the three ADMIN-NOTICE modules specifically, ADMIN_EMAIL_ALLOWLIST is set to two
// addresses before each case, so the resolver-driven Promise.all([...]) loop is genuinely
// exercised (not a zero-recipient no-op, which would trivially "resolve without throwing" for
// the wrong reason).
//
// Run as: npx tsx contracts/checks/vendor-flow-notifications/check-email-failure-isolation.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com,admin-two@example.com';

const { deliverConfirmationEmailAfterCommit } = await import('../../../lib/confirmation-email.ts');

const failures = [];

async function proveIsolation(label, sendFn, baseInput) {
  // (a) rejecting mailer
  {
    const rejectionError = new Error(`fixture: Resend unavailable (${label})`);
    const rejectingMailer = { send: async () => { throw rejectionError; } };
    let sendCalls = 0;
    const countingMailer = {
      send: async (...args) => {
        sendCalls += 1;
        return rejectingMailer.send(...args);
      },
    };
    let onErrorCalls = 0;
    let capturedError;
    let threw = false;
    try {
      await deliverConfirmationEmailAfterCommit(
        () => sendFn(baseInput, { mailer: countingMailer }),
        (error) => {
          onErrorCalls += 1;
          capturedError = error;
        },
      );
    } catch {
      threw = true;
    }
    if (threw) {
      failures.push(`${label}: the composed call threw instead of resolving for a rejecting mailer.`);
    }
    if (onErrorCalls !== 1) {
      failures.push(`${label}: expected onError called exactly once for a rejecting mailer, got ${onErrorCalls}.`);
    }
    if (sendCalls === 0) {
      failures.push(`${label}: mailer.send was never called at all — the send function is not attempting delivery.`);
    }
    if (onErrorCalls === 1 && capturedError === undefined) {
      failures.push(`${label}: onError was called but with no captured error.`);
    }
  }

  // (b) resolving mailer
  {
    let sendCalls = 0;
    const resolvingMailer = {
      send: async () => {
        sendCalls += 1;
      },
    };
    let onErrorCalls = 0;
    let threw = false;
    try {
      await deliverConfirmationEmailAfterCommit(
        () => sendFn(baseInput, { mailer: resolvingMailer }),
        () => {
          onErrorCalls += 1;
        },
      );
    } catch {
      threw = true;
    }
    if (threw) {
      failures.push(`${label}: the composed call threw for a resolving mailer.`);
    }
    if (onErrorCalls !== 0) {
      failures.push(`${label}: expected onError called zero times for a resolving mailer, got ${onErrorCalls}.`);
    }
    if (sendCalls === 0) {
      failures.push(`${label}: mailer.send was never called for a resolving mailer — no delivery was attempted.`);
    }
  }
}

// (1) The new vendor-facing application confirmation.
try {
  const { sendVendorApplicationConfirmationEmail } = await import('../../../lib/vendor-application-confirmation.ts');
  await proveIsolation('vendor-application-confirmation', sendVendorApplicationConfirmationEmail, {
    businessName: 'Cape Orchid Traders',
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@example.com',
  });
} catch (error) {
  failures.push(`vendor-application-confirmation: could not import/exercise lib/vendor-application-confirmation.ts — ${error.message}`);
}

// (2) Application-submitted admin notice.
try {
  const { sendVendorApplicationAdminNoticeEmail } = await import('../../../lib/vendor-application-admin-notice.ts');
  await proveIsolation('vendor-application-admin-notice', sendVendorApplicationAdminNoticeEmail, {
    businessName: 'Cape Orchid Traders',
    contactPersonName: 'Jane Vendor',
    applicationId: 'app-123',
    reviewUrl: 'https://saoc.co.za/admin/vendors/applications',
  });
} catch (error) {
  failures.push(`vendor-application-admin-notice: could not import/exercise lib/vendor-application-admin-notice.ts — ${error.message}`);
}

// (3) Full-registration-submitted admin notice.
try {
  const { sendVendorSubmissionAdminNoticeEmail } = await import('../../../lib/vendor-submission-admin-notice.ts');
  await proveIsolation('vendor-submission-admin-notice', sendVendorSubmissionAdminNoticeEmail, {
    businessName: 'Cape Orchid Traders',
    contactPersonName: 'Jane Vendor',
    vendorSubmissionId: 'sub-123',
    reviewUrl: 'https://saoc.co.za/admin/vendors',
  });
} catch (error) {
  failures.push(`vendor-submission-admin-notice: could not import/exercise lib/vendor-submission-admin-notice.ts — ${error.message}`);
}

// (4) Payment-received admin notice.
try {
  const { sendVendorPaymentAdminNoticeEmail } = await import('../../../lib/vendor-payment-admin-notice.ts');
  await proveIsolation('vendor-payment-admin-notice', sendVendorPaymentAdminNoticeEmail, {
    businessName: 'Cape Orchid Traders',
    contactPersonName: 'Jane Vendor',
    standOrderRef: 'VSO-sub-123',
    reviewUrl: 'https://saoc.co.za/admin/vendors',
  });
} catch (error) {
  failures.push(`vendor-payment-admin-notice: could not import/exercise lib/vendor-payment-admin-notice.ts — ${error.message}`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: all four new sender modules, composed with the real deliverConfirmationEmailAfterCommit, ' +
    'resolve without throwing and call onError exactly once for a rejecting mailer (with mailer.send ' +
    'genuinely attempted), and resolve with onError never called for a resolving mailer.',
);
process.exit(0);
