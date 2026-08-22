// F2b (ozow-payment-provider) — confirmNotification() must be a REAL, live-observable
// confirmation, never the permanently-failing stub F1 shipped. Ozow's own current
// https://ozow.com/integrations page (verified via Alembic, 2026-08-22 — see
// contracts/golden/ozow-m1-f2b/README.md §2) documents a LIVE, currently-resolving endpoint —
// https://api.ozow.com/GetTransactionByReference?siteCode={siteCode}&transactionReference={ref}
// with an `ApiKey` request header — as the gateway's own recommended anti-spoofing mechanism.
// This is a genuinely different situation than F1's refund()/confirmNotification() stub decision:
// that decision was about oldhub.ozow.com, a domain that no longer resolves at all (NXDOMAIN).
// api.ozow.com is live, current, and documented on the SAME page this project already trusted for
// the hash algorithm (contracts/golden/ozow-m1-f1/README.md §1). OZOW_SANDBOX_API_KEY is already
// staged in .env.local, corroborating that this call was always the intended next step.
//
// Proves, offline, against the REAL createOzowProvider() (deps-injected env + fetch, no network):
//   1. Missing OZOW_SANDBOX_SITE_CODE or OZOW_SANDBOX_API_KEY -> confirmed:false, reason
//      'not-configured', and ZERO fetch calls (fail closed BEFORE any network attempt, same
//      discipline as verifyNotification's passphrase-first check).
//   2. A matching transaction with Status:'Complete' -> confirmed:true.
//   3. A matching transaction with any OTHER Status (e.g. 'Cancelled') -> confirmed:false,
//      reason 'not-valid'. Status comparison is STRICT equality against 'Complete' only — no
//      case-folding, no truthy-string shortcut (mirrors mapStatus's own documented discipline).
//   4. No transaction in the response matches the notification's reference -> confirmed:false,
//      reason 'not-valid'. An attacker replaying an unrelated real transaction's payload must not
//      confirm a DIFFERENT reference.
//   5. A non-2xx HTTP response -> confirmed:false, reason 'not-valid'.
//   6. A network/fetch failure (thrown error) -> confirmed:false, reason 'request-failed'.
//   7. The request actually sent: GET, URL contains 'GetTransactionByReference', siteCode AND
//      transactionReference query params carrying the real values, 'ApiKey' header carrying the
//      real key. A call that silently drops the ApiKey header or reference would defeat the whole
//      point of this endpoint (anti-spoofing) while still reporting confirmed:true against a
//      loosely-matching response.
//
// WHAT MAKES THIS FAIL: confirmNotification staying a hardcoded stub; confirming without checking
// Status === 'Complete'; confirming a transaction whose TransactionReference does not match;
// confirming on non-2xx or malformed (non-array) responses; calling fetch before the config guard;
// omitting the ApiKey header or siteCode/transactionReference params from the real request.
//
// Run as: npx tsx contracts/checks/ozow-m1-f2b/check-confirm-notification-real.mjs

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

const baseNotification = {
  reference: 'ORDER-REF-999',
  rawStatus: 'Complete',
  grossAmount: '250.00',
  grossAmountCents: 25000,
  gatewayPaymentId: 'OZ-TXN-1',
  sourceIp: null,
  sourceIpTrusted: null,
  raw: {},
};

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

async function runCase(label, { env, fetchImpl, notification, expect }) {
  const calls = [];
  const wrappedFetch = fetchImpl
    ? async (url, init) => {
        calls.push({ url, init });
        return fetchImpl(url, init);
      }
    : async (url, init) => {
        calls.push({ url, init });
        throw new Error('unexpected fetch call in this case');
      };

  const provider = createOzowProvider({ env, fetch: wrappedFetch });
  const result = await provider.confirmNotification(notification ?? baseNotification);

  if (expect.confirmed !== undefined && result.confirmed !== expect.confirmed) {
    fail(`${label}: expected confirmed=${expect.confirmed}, got confirmed=${result.confirmed}`);
  }
  if (expect.reason !== undefined) {
    const actualReason = result.confirmed ? undefined : result.reason;
    if (actualReason !== expect.reason) {
      fail(`${label}: expected reason=${expect.reason}, got reason=${actualReason}`);
    }
  }
  if (expect.zeroFetchCalls) {
    if (calls.length !== 0) {
      fail(`${label}: expected zero fetch calls, got ${calls.length}`);
    }
  }
  if (expect.checkRequest) {
    if (calls.length === 0) {
      fail(`${label}: expected a fetch call but none was made`);
    } else {
      expect.checkRequest(calls[0], fail, label);
    }
  }
  return result;
}

// Case 1a — missing site code
await runCase('missing OZOW_SANDBOX_SITE_CODE', {
  env: { OZOW_SANDBOX_API_KEY: 'x' },
  expect: { confirmed: false, reason: 'not-configured', zeroFetchCalls: true },
});

// Case 1b — missing api key
await runCase('missing OZOW_SANDBOX_API_KEY', {
  env: { OZOW_SANDBOX_SITE_CODE: 'x' },
  expect: { confirmed: false, reason: 'not-configured', zeroFetchCalls: true },
});

// Case 2 — matching, Complete
await runCase('matching transaction, Status Complete', {
  env: REAL_ENV,
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'ORDER-REF-999', Status: 'Complete', Amount: '250.00' },
    ]),
  expect: { confirmed: true },
});

// Case 3 — matching, Cancelled
await runCase('matching transaction, Status Cancelled', {
  env: REAL_ENV,
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'ORDER-REF-999', Status: 'Cancelled', Amount: '250.00' },
    ]),
  expect: { confirmed: false, reason: 'not-valid' },
});

// Case 4 — no matching reference in the array
await runCase('response array has no matching TransactionReference', {
  env: REAL_ENV,
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'SOME-OTHER-REF', Status: 'Complete', Amount: '250.00' },
    ]),
  expect: { confirmed: false, reason: 'not-valid' },
});

// Case 5 — non-2xx
await runCase('non-2xx HTTP response', {
  env: REAL_ENV,
  fetchImpl: async () => jsonResponse({ error: 'nope' }, false, 500),
  expect: { confirmed: false, reason: 'not-valid' },
});

// Case 6 — thrown fetch error
await runCase('fetch throws', {
  env: REAL_ENV,
  fetchImpl: async () => {
    throw new Error('network down');
  },
  expect: { confirmed: false, reason: 'request-failed' },
});

// Case 7 — request shape: URL + ApiKey header
await runCase('request carries GetTransactionByReference, siteCode, transactionReference, ApiKey', {
  env: REAL_ENV,
  fetchImpl: async () =>
    jsonResponse([{ TransactionReference: 'ORDER-REF-999', Status: 'Complete' }]),
  expect: {
    confirmed: true,
    checkRequest(call, failFn, label) {
      const url = String(call.url);
      if (!url.includes('GetTransactionByReference')) {
        failFn(`${label}: request URL missing GetTransactionByReference: ${url}`);
      }
      if (!url.includes(encodeURIComponent(REAL_ENV.OZOW_SANDBOX_SITE_CODE)) && !url.includes(REAL_ENV.OZOW_SANDBOX_SITE_CODE)) {
        failFn(`${label}: request URL missing siteCode: ${url}`);
      }
      if (!url.includes('ORDER-REF-999')) {
        failFn(`${label}: request URL missing transactionReference: ${url}`);
      }
      const headers = call.init?.headers ?? {};
      const headerEntries =
        typeof headers.get === 'function'
          ? { ApiKey: headers.get('ApiKey') }
          : headers;
      const apiKeyValue = headerEntries.ApiKey ?? headerEntries.apikey;
      if (apiKeyValue !== REAL_ENV.OZOW_SANDBOX_API_KEY) {
        failFn(`${label}: request missing/wrong ApiKey header, got ${JSON.stringify(apiKeyValue)}`);
      }
    },
  },
});

// Case 8 — response.json() throws (malformed/non-JSON body on a 2xx response) must NOT
// propagate as an uncaught rejection; it must land on confirmed:false, reason 'not-valid'.
await runCase('response.json() throws (malformed JSON body)', {
  env: REAL_ENV,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    async json() {
      throw new SyntaxError('Unexpected token in JSON');
    },
    async text() {
      return '<html>not json</html>';
    },
  }),
  expect: { confirmed: false, reason: 'not-valid' },
});

// Case 9 — readiness('initiate') must require OZOW_SANDBOX_API_KEY, not just SITE_CODE +
// PRIVATE_KEY. Codex GPT-5.5 finding (2026-08-22): readiness('initiate') is the ONLY readiness
// gate the checkout route calls (app/api/tickets/checkout/route.ts:647) before letting a buyer
// select Ozow, but confirmNotification() (this file) fails closed without OZOW_SANDBOX_API_KEY.
// A deployment missing only that key would previously report ready:true, let a buyer pay, and then
// have every notification for that order fail to confirm — the order never settles. REVERT-AND-
// CONFIRM-RED: with INITIATE_REQUIRED_KEYS reverted to its pre-fix two-key list
// (OZOW_SANDBOX_SITE_CODE, OZOW_SANDBOX_PRIVATE_KEY only), this case's provider would report
// ready:true with the API key missing — exactly the gap this case exists to close.
{
  const siteCodeAndPrivateKeyOnly = createOzowProvider({
    env: {
      OZOW_SANDBOX_SITE_CODE: REAL_ENV.OZOW_SANDBOX_SITE_CODE,
      OZOW_SANDBOX_PRIVATE_KEY: REAL_ENV.OZOW_SANDBOX_PRIVATE_KEY,
    },
  });
  const readiness = siteCodeAndPrivateKeyOnly.readiness('initiate');
  if (readiness.ready !== false) {
    fail(
      `case 9: readiness('initiate') with API key missing must report ready:false, got ${JSON.stringify(readiness)}`
    );
  } else if (!readiness.missing.includes('OZOW_SANDBOX_API_KEY')) {
    fail(`case 9: readiness('initiate') missing list must name OZOW_SANDBOX_API_KEY, got ${JSON.stringify(readiness.missing)}`);
  }

  const allThree = createOzowProvider({ env: REAL_ENV });
  const fullReadiness = allThree.readiness('initiate');
  if (fullReadiness.ready !== true) {
    fail(`case 9: readiness('initiate') with all three keys present must report ready:true, got ${JSON.stringify(fullReadiness)}`);
  }
}

// Case 10 — Ozow can return MULTIPLE rows sharing one TransactionReference (README §1: "Ozow does
// not prevent duplicate merchant references"), e.g. a buyer cancelling and retrying checkout under
// the same reference. Blindly taking the first array match could confirm against the wrong
// attempt. When the notification carries a TransactionId (gatewayPaymentId, read off the inbound
// notification in verifyNotification()), that must disambiguate — matching the specific row, not
// merely the first one sharing the reference.
await runCase('duplicate TransactionReference, disambiguated by TransactionId — matches the correct row', {
  env: REAL_ENV,
  notification: { ...baseNotification, gatewayPaymentId: 'OZ-TXN-CURRENT' },
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'ORDER-REF-999', TransactionId: 'OZ-TXN-STALE', Status: 'Cancelled' },
      { TransactionReference: 'ORDER-REF-999', TransactionId: 'OZ-TXN-CURRENT', Status: 'Complete' },
    ]),
  expect: { confirmed: true },
});
await runCase('duplicate TransactionReference, disambiguated by TransactionId — wrong row would have confirmed', {
  env: REAL_ENV,
  notification: { ...baseNotification, gatewayPaymentId: 'OZ-TXN-CURRENT' },
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'ORDER-REF-999', TransactionId: 'OZ-TXN-CURRENT', Status: 'Cancelled' },
      { TransactionReference: 'ORDER-REF-999', TransactionId: 'OZ-TXN-STALE', Status: 'Complete' },
    ]),
  expect: { confirmed: false, reason: 'not-valid' },
});

// Case 11 — no TransactionId available on the notification (gatewayPaymentId null) and more than
// one row shares the TransactionReference: ambiguous, must fail closed to not-valid rather than
// arbitrarily picking body.find()'s first hit. REVERT-AND-CONFIRM-RED: the pre-fix code
// (`body.find(t => t.TransactionReference === notification.reference)`) would take the FIRST
// element here — Status 'Complete' — and wrongly return confirmed:true.
await runCase('duplicate TransactionReference, no TransactionId to disambiguate — fails closed', {
  env: REAL_ENV,
  notification: { ...baseNotification, gatewayPaymentId: null },
  fetchImpl: async () =>
    jsonResponse([
      { TransactionReference: 'ORDER-REF-999', Status: 'Complete' },
      { TransactionReference: 'ORDER-REF-999', Status: 'Cancelled' },
    ]),
  expect: { confirmed: false, reason: 'not-valid' },
});

if (FAIL) {
  console.error('check-confirm-notification-real.mjs: FAIL');
  process.exit(1);
}
console.log('check-confirm-notification-real.mjs: PASS (13 cases)');
