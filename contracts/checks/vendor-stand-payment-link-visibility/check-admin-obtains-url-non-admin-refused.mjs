#!/usr/bin/env node
// contract-stand-payment-link-visibility -- A1: proves, via the REAL
// POST /api/admin/vendors/[id]/resend-payment-link route handler (route-runner harness), that:
//   1. An authenticated admin passing lib/admin-auth.ts's gate can obtain a stand-payment URL
//      from the JSON response WITHOUT relying on email delivery (email is currently broken --
//      forms.saoc.co.za unverified in Resend -- so this is the only reachable path tonight).
//   2. That URL's token verifies against the REAL verifyVendorStandPaymentToken() and resolves
//      to the correct vendorSubmissionId -- not a malformed string.
//   3. The URL lands on the usable payment page path (/national-show/vendors/payment), the
//      same path app/api/admin/vendors/[id]/review/route.ts's buildVendorStandPaymentUrl()
//      already builds for the (currently broken) email path -- proving @dev reused it rather
//      than inventing a second URL-building function.
//   4. An unauthenticated/non-admin caller (FIXTURE_ADMIN_DENIED=1 -- see
//      fixture-admin-auth.mjs) gets refused 401/403 by the SAME gate as every other admin
//      route, and its response body contains no paymentUrl and no raw token string anywhere.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-link-visibility/check-admin-obtains-url-non-admin-refused.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require(
  '../../harness/route-runner/store.mjs',
);

const RESEND = '../../../app/api/admin/vendors/[id]/resend-payment-link/route.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: resendPost } = await import(RESEND);
const { verifyVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

function seedApprovedUnpaid(id) {
  resetAllCollections();
  vendorSubmissions.set(id, {
    status: 'approved',
    businessName: 'Fynbos Pottery',
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@example.com',
  });
}

async function callResend(id) {
  const res = await resendPost({}, { params: Promise.resolve({ id }) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, body, rawText: text };
}

// --- (1)-(3): admin obtains a valid, verifiable payment URL without email ---------------------
delete process.env.FIXTURE_ADMIN_DENIED;
seedApprovedUnpaid('sub-admin-visible');
const adminResult = await callResend('sub-admin-visible');

assert(
  adminResult.status === 200,
  `expected 200 for an admin resend against an approved, unpaid submission, got ${adminResult.status} ${adminResult.rawText}`,
);
assert(
  typeof adminResult.body?.paymentUrl === 'string' && adminResult.body.paymentUrl.length > 0,
  `expected the JSON response to carry a "paymentUrl" string field so the admin UI can display/copy it without email -- got ${adminResult.rawText}`,
);

if (typeof adminResult.body?.paymentUrl === 'string') {
  let parsedUrl;
  try {
    parsedUrl = new URL(adminResult.body.paymentUrl);
  } catch {
    failures.push(`paymentUrl "${adminResult.body.paymentUrl}" is not a well-formed URL.`);
  }
  if (parsedUrl) {
    assert(
      parsedUrl.pathname === '/national-show/vendors/payment',
      `expected paymentUrl's path to be /national-show/vendors/payment (the real payment page, same as buildVendorStandPaymentUrl() already builds for the email path), got "${parsedUrl.pathname}".`,
    );
    const token = parsedUrl.searchParams.get('token');
    assert(!!token, 'expected a non-empty "token" query param on paymentUrl.');
    if (token) {
      const verification = verifyVendorStandPaymentToken({ token, secret: TEST_SECRET, now: new Date() });
      assert(
        verification.ok === true && verification.vendorSubmissionId === 'sub-admin-visible',
        `expected the token to verify and resolve to "sub-admin-visible", got ${JSON.stringify(verification)}.`,
      );
    }
  }
}

// --- (4): a non-admin/unauthenticated caller is refused and gets no URL -----------------------
process.env.FIXTURE_ADMIN_DENIED = '1';
seedApprovedUnpaid('sub-non-admin');
const deniedResult = await callResend('sub-non-admin');
delete process.env.FIXTURE_ADMIN_DENIED;

assert(
  deniedResult.status === 401 || deniedResult.status === 403,
  `expected a non-admin/unauthenticated caller to be refused 401/403, got ${deniedResult.status} ${deniedResult.rawText}`,
);
assert(
  !('paymentUrl' in (deniedResult.body ?? {})),
  `a refused (non-admin) response must never carry a "paymentUrl" key -- got ${deniedResult.rawText}`,
);
assert(
  !/token=/.test(deniedResult.rawText),
  `a refused (non-admin) response body must never contain a raw payment token -- got ${deniedResult.rawText}`,
);

// --- static guard: the route file never logs the minted token or URL --------------------------
const fs = await import('node:fs');
const routeSource = fs.readFileSync(
  new URL('../../../app/api/admin/vendors/[id]/resend-payment-link/route.ts', import.meta.url),
  'utf8',
);
const consoleLinesWithTokenOrUrl = routeSource
  .split('\n')
  .filter((line) => /console\.(log|error|warn|info)/.test(line) && /\b(token|paymentUrl)\b/i.test(line));
assert(
  consoleLinesWithTokenOrUrl.length === 0,
  `the route must never console.log/error the minted token or paymentUrl -- found: ${JSON.stringify(consoleLinesWithTokenOrUrl)}`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: an admin obtains a valid, verifiable stand-payment URL from the resend route\'s JSON ' +
    'response without email; a non-admin/unauthenticated caller is refused and receives no URL ' +
    'or raw token anywhere in the response; the route never logs the token or URL.',
);
process.exit(0);
