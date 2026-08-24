// F4 (ozow-payment-provider) — GetTransactionByReference 404 fix. Root cause (see
// contracts/golden/ozow-m1-f4/README.md §8): Ozow's own current https://ozow.com/integrations
// docs (Step 3) document an `IsTest` query parameter on GetTransactionByReference — "Defaults to
// false. Use true only to get results for test requests." confirmNotification() never sent it, so
// a real, hash-verified, IsTest=true, Status=Complete transaction (reference
// SAOC-2027-74NG1P6W9RKK) 404'd against an implicit IsTest=false filter and the order was
// wrongly, if safely, left `reserved` forever.
//
// Proves, offline, against the REAL createOzowProvider() (env/fetch deps-injected, no network):
//   1. A notification with raw.IsTest === 'true' -> confirmNotification() sends
//      IsTest=true (query param) to GetTransactionByReference, and the response's matching
//      Status:'Complete' row -> confirmed:true. THIS IS THE EXACT BUG SCENARIO.
//   2. A notification with raw.IsTest === 'false' (or absent) -> the request sent carries NO
//      IsTest param at all (byte-identical to this codebase's pre-fix behaviour) -> real
//      transactions are unaffected by this fix.
//   3. A notification claiming raw.IsTest === 'true' but whose matched row's Status is NOT
//      'Complete' -> confirmed:false/not-valid — sending IsTest=true never bypasses the existing
//      Status check.
//   4. No matching TransactionReference in the (correctly IsTest-scoped) response -> still
//      confirmed:false/not-valid — the fix changes what population of transactions is searched,
//      never whether an unmatched reference confirms.
//   5. Any non-'true' string for raw.IsTest (e.g. 'TRUE', '1', 'yes') -> treated as NOT a test
//      transaction (strict equality, no truthy-string shortcut) -> no IsTest param sent.
//
// FAILS ON: confirmNotification() never adding an IsTest param for a real IsTest='true'
// notification (the bug staying unfixed); adding IsTest=true unconditionally, which would be a
// no-op fix but is checked here as a positive requirement that a real-transaction request stays
// param-free; bypassing or weakening the Status==='Complete' check when IsTest is true (any
// widening of what counts as confirmed for test transactions specifically); a non-strict IsTest
// comparison (truthy-string shortcut) sending the param for values Ozow's docs don't define as
// 'true'.
//
// Run as: npx tsx contracts/checks/ozow-m1-f4/check-confirm-notification-istest-param.mjs

import { createOzowProvider } from '../../../lib/payments/ozow.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

const REAL_ENV = {
  OZOW_SANDBOX_SITE_CODE: 'TESTSITE001',
  OZOW_SANDBOX_PRIVATE_KEY: 'not-used-by-confirm',
  OZOW_SANDBOX_API_KEY: 'test-api-key-abc123',
};

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

function notificationWith(rawIsTest, overrides = {}) {
  return {
    reference: 'SAOC-2027-74NG1P6W9RKK',
    rawStatus: 'Complete',
    grossAmount: '0.01',
    grossAmountCents: 1,
    gatewayPaymentId: '34c3acfa-2618-410c-80d0-521a08190b82',
    sourceIp: null,
    sourceIpTrusted: null,
    raw: rawIsTest === undefined ? {} : { IsTest: rawIsTest },
    ...overrides,
  };
}

async function runCase(label, { notification, fetchImpl, expect }) {
  const calls = [];
  const wrappedFetch = async (url, init) => {
    calls.push({ url, init });
    return fetchImpl(url, init);
  };
  const provider = createOzowProvider({ env: REAL_ENV, fetch: wrappedFetch });
  const result = await provider.confirmNotification(notification);

  if (expect.confirmed !== undefined && result.confirmed !== expect.confirmed) {
    fail(`${label}: expected confirmed=${expect.confirmed}, got confirmed=${result.confirmed}`);
  }
  if (expect.reason !== undefined) {
    const actualReason = result.confirmed ? undefined : result.reason;
    if (actualReason !== expect.reason) {
      fail(`${label}: expected reason=${expect.reason}, got reason=${actualReason}`);
    }
  }
  if (calls.length === 0) {
    fail(`${label}: expected a fetch call but none was made`);
  } else {
    const url = String(calls[0].url);
    const hasIsTestTrue = /[?&]IsTest=true(&|$)/.test(url);
    if (expect.sendsIsTestTrue && !hasIsTestTrue) {
      fail(`${label}: expected IsTest=true in request URL, got: ${url}`);
    }
    if (!expect.sendsIsTestTrue && hasIsTestTrue) {
      fail(`${label}: expected NO IsTest param in request URL (real-transaction request must stay unchanged), got: ${url}`);
    }
  }
  return result;
}

// Case 1 — THE REAL BUG SCENARIO: IsTest='true', matching row with Status Complete -> confirmed.
await runCase('IsTest=true, matching Complete row -> confirmed:true (the reproduced bug)', {
  notification: notificationWith('true'),
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'SAOC-2027-74NG1P6W9RKK', Status: 'Complete', Amount: '0.01' },
    ]),
  expect: { confirmed: true, sendsIsTestTrue: true },
});

// Case 2 — real transaction (IsTest absent) — request must be byte-identical to pre-fix
// behaviour: no IsTest param at all.
await runCase('IsTest absent (real transaction) -> no IsTest param sent, unaffected by fix', {
  notification: notificationWith(undefined),
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'SAOC-2027-74NG1P6W9RKK', Status: 'Complete', Amount: '0.01' },
    ]),
  expect: { confirmed: true, sendsIsTestTrue: false },
});

// Case 2b — real transaction explicitly marked IsTest='false' -> same, no param.
await runCase("IsTest='false' explicitly -> no IsTest param sent", {
  notification: notificationWith('false'),
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'SAOC-2027-74NG1P6W9RKK', Status: 'Complete', Amount: '0.01' },
    ]),
  expect: { confirmed: true, sendsIsTestTrue: false },
});

// Case 2c — real transaction whose status check fails (404) must still be rejected, unaffected
// by this fix (fail-closed preserved).
await runCase('IsTest absent, real transaction, status API 404s -> confirmed:false/not-valid (fail-closed preserved)', {
  notification: notificationWith(undefined),
  fetchImpl: async () => jsonResponse({}, false, 404),
  expect: { confirmed: false, reason: 'not-valid', sendsIsTestTrue: false },
});

// Case 3 — IsTest=true but the matched row's Status is NOT Complete -> the IsTest fix never
// bypasses the existing Status check.
await runCase('IsTest=true, matching row but Status Cancelled -> confirmed:false/not-valid', {
  notification: notificationWith('true'),
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'SAOC-2027-74NG1P6W9RKK', Status: 'Cancelled', Amount: '0.01' },
    ]),
  expect: { confirmed: false, reason: 'not-valid', sendsIsTestTrue: true },
});

// Case 4 — IsTest=true but no matching reference in the (correctly scoped) response -> still
// fails closed. Sending IsTest=true changes WHAT is searched, never whether an unmatched
// reference confirms.
await runCase('IsTest=true, no matching TransactionReference -> confirmed:false/not-valid', {
  notification: notificationWith('true'),
  fetchImpl: async () =>
    jsonResponse([{ TransactionReference: 'SOME-OTHER-REF', Status: 'Complete' }]),
  expect: { confirmed: false, reason: 'not-valid', sendsIsTestTrue: true },
});

// Case 5 — strict equality: a non-'true' string must not trigger the IsTest param (no
// truthy-string shortcut).
for (const value of ['TRUE', '1', 'yes']) {
  await runCase(`IsTest='${value}' (not exactly 'true') -> no IsTest param sent (strict equality)`, {
    notification: notificationWith(value),
    fetchImpl: async () =>
      jsonResponse([
        { TransactionReference: 'SAOC-2027-74NG1P6W9RKK', Status: 'Complete', Amount: '0.01' },
      ]),
    expect: { confirmed: true, sendsIsTestTrue: false },
  });
}

// Case 6 — SECURITY REGRESSION GUARD: a forged notification (bad/mismatched Hash) must still be
// rejected by verifyNotification() regardless of IsTest, and must never reach confirmNotification()
// at all — this fix touches only confirmNotification()'s GetTransactionByReference call, never
// verifyNotification()'s hash check.
{
  const provider = createOzowProvider({ env: REAL_ENV, fetch: async () => { throw new Error('confirmNotification must never be reached for a forged notification'); } });
  const forgedBody = new URLSearchParams({
    SiteCode: 'TESTSITE001',
    TransactionId: 'oz-txn-1',
    TransactionReference: 'SAOC-2027-74NG1P6W9RKK',
    Amount: '0.01',
    Status: 'Complete',
    CurrencyCode: 'ZAR',
    IsTest: 'true',
    StatusMessage: '',
    Hash: 'deliberately-wrong-hash-value',
  }).toString();
  const result = await provider.verifyNotification({
    rawBody: forgedBody,
    headers: { get: () => null },
  });
  if (result.verified !== false) {
    fail('case 6: forged notification (bad Hash, IsTest=true) must be verified:false, got verified:true');
  } else if (result.reason !== 'signature-mismatch') {
    fail(`case 6: expected reason='signature-mismatch', got '${result.reason}'`);
  }
}

if (FAIL) {
  console.error('check-confirm-notification-istest-param.mjs: FAIL');
  process.exit(1);
}
console.log('check-confirm-notification-istest-param.mjs: PASS (9 cases)');
