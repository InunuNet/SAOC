#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F2 -- the two downstream sends inside the settlement
// handler's `if (paidNotice) { ... }` block (lib/vendor-stand-payment-notification.ts, admin
// notice ~line 234, vendor receipt ~line 258) are SEQUENTIAL and fully awaited.
// deliverConfirmationEmailAfterCommit() catches a REJECTION, but nothing bounds a send's
// runtime -- if the FIRST send (the admin notice) never resolves at all (a real, observed
// failure mode for an HTTP call with no client-side timeout: a stalled TCP connection, a
// provider outage that accepts the connection but never responds), the vendor receipt is never
// even ATTEMPTED, and the HTTP 200 acknowledgement at the end of the handler never returns --
// after Firestore has ALREADY committed the order as 'paid'. The gateway then retries against
// an order that is already settled, which is at best wasted gateway retries and at worst (if a
// serverless platform kills the still-hung request) an invocation that never completes at all.
//
// Fix must (per the contract's chosen design, EMAIL_SEND_TIMEOUT_MS, justified in the golden
// README): (a) bound each send's runtime so a hang cannot run forever, and (b) make the two
// sends genuinely independent (concurrent, not sequential-await) so a hang in one cannot even
// delay the START of the other.
//
// BEHAVIOURAL, via the real route-runner harness (real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments/mailer infrastructure
// faked). Two scenarios, symmetric: the admin notice's send hangs forever; the vendor receipt's
// send hangs forever. In each: the OTHER send must still have been attempted, and the route
// must still return HTTP 200, within a bounded WATCHDOG_MS ceiling.
//
// WATCHDOG_MS (this check's OWN outer bound, distinct from the fix's internal
// EMAIL_SEND_TIMEOUT_MS) is deliberately set well ABOVE the timeout value this contract
// specifies for the fix (see the golden README's "Choosing the timeout value") so a correctly
// bounded implementation has comfortable headroom to resolve before this check's own watchdog
// would fire. Racing the real POST call against a local timer is the only way to write a
// FINITE-RUNTIME check for a defect whose failure mode is "never resolves" -- a check that
// simply `await`ed the hung call would itself hang forever pre-fix.
//
// RED-verified live (2026-09-02): FAILS both scenarios -- neither the sibling send nor the 200
// ack happens within WATCHDOG_MS, because today's sequential-await code is still stuck awaiting
// the permanently-hung first send when the watchdog fires.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-hung-send-does-not-block-sibling-or-ack.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const { resetPaymentsFixture, initiateCalls } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const {
  sentVendorPaymentConfirmations,
  resetVendorPaymentConfirmationFixture,
  setVendorPaymentConfirmationShouldHang,
} = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const {
  sentVendorPaymentAdminNotices,
  resetVendorPaymentAdminNoticeFixture,
  setVendorPaymentAdminNoticeShouldHang,
} = require('../../harness/route-runner/fixture-vendor-payment-admin-notice.mjs');

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const PAYFAST_ITN = '../../../app/api/vendors/stand-payment/payfast-itn/route.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: initiatePost } = await import(INITIATE);
const { POST: payfastItnPost } = await import(PAYFAST_ITN);
const { mintVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com';
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

// This check's OWN outer bound -- see header comment. Must exceed the fix's specified
// EMAIL_SEND_TIMEOUT_MS (5000ms, see the golden README) with real headroom for event-loop /
// harness overhead, while staying short enough that a RED run finishes promptly.
const WATCHDOG_MS = 9000;

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

// Returns the REAL `reference` the initiate route minted (F3's per-attempt id, threaded through
// this field) -- see check-unconfirmed-blocks-settlement.mjs's identical helper for why a
// hardcoded `VSO-{id}` literal is no longer the right shape to test against.
async function seedPendingOrder(vendorSubmissionId) {
  vendorSubmissions.set(vendorSubmissionId, {
    status: 'approved',
    businessName: 'Fynbos Pottery',
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@fynbospottery.example',
  });
  setActiveGateway('payfast');
  const token = mintToken(vendorSubmissionId);
  const result = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
  if (result.status !== 200) {
    throw new Error(`fixture setup failed: initiate returned ${result.status}`);
  }
  const reference = initiateCalls.at(-1)?.reference;
  if (!reference) {
    throw new Error('test setup error: could not capture the real reference from initiateCalls');
  }
  return reference;
}

const WATCHDOG_TOKEN = Symbol('watchdog');
async function callItnWithWatchdog(reference) {
  const payload = { reference, rawStatus: 'paid', grossAmountCents: 145000, gatewayPaymentId: `pf-${reference}` };
  const callPromise = payfastItnPost({ text: async () => JSON.stringify(payload), headers: new Headers() }).then(
    async (res) => ({ status: res.status, body: await res.json() }),
  );
  const watchdogPromise = new Promise((resolve) => setTimeout(() => resolve(WATCHDOG_TOKEN), WATCHDOG_MS));
  const result = await Promise.race([callPromise, watchdogPromise]);
  return result === WATCHDOG_TOKEN ? { timedOut: true } : { timedOut: false, ...result };
}

// =============================================================================================
// Scenario A: the admin notice's send hangs forever. The vendor receipt must still be
// attempted, and the route must still return 200, both within WATCHDOG_MS.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setVendorPaymentAdminNoticeShouldHang(true);

const referenceA = await seedPendingOrder('sub-hang-admin');
const scenarioA = await callItnWithWatchdog(referenceA);

assert(
  !scenarioA.timedOut,
  `Scenario A: the route did not return within ${WATCHDOG_MS}ms while the admin notice's send hung -- the vendor receipt send and the 200 ack must both be reachable within a bounded time even when the admin notice never resolves.`,
);
if (!scenarioA.timedOut) {
  assert(scenarioA.status === 200, `Scenario A: expected 200, got ${scenarioA.status}`);
}
assert(
  vendorStandOrders.get('sub-hang-admin')?.status === 'paid',
  'Scenario A: the order must still be settled to \'paid\' (the Firestore transaction is unaffected by an email hang, which happens strictly after it commits)',
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `Scenario A: the vendor receipt send must have been GENUINELY ATTEMPTED even though the admin notice hung -- got ${sentVendorPaymentConfirmations.length} attempt(s).`,
);

// =============================================================================================
// Scenario B: the vendor receipt's send hangs forever instead (symmetric). The admin notice
// must still be attempted, and the route must still return 200.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setVendorPaymentConfirmationShouldHang(true);

const referenceB = await seedPendingOrder('sub-hang-vendor');
const scenarioB = await callItnWithWatchdog(referenceB);

assert(
  !scenarioB.timedOut,
  `Scenario B: the route did not return within ${WATCHDOG_MS}ms while the vendor receipt's send hung.`,
);
if (!scenarioB.timedOut) {
  assert(scenarioB.status === 200, `Scenario B: expected 200, got ${scenarioB.status}`);
}
assert(
  vendorStandOrders.get('sub-hang-vendor')?.status === 'paid',
  'Scenario B: the order must still be settled to \'paid\'',
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `Scenario B: the admin notice send must have been GENUINELY ATTEMPTED even though the vendor receipt hung -- got ${sentVendorPaymentAdminNotices.length} attempt(s).`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `PASS: a send that never resolves does not prevent the sibling send from being attempted, ` +
    `and does not prevent the gateway's 200 ack, within ${WATCHDOG_MS}ms, in both directions.`,
);
process.exit(0);
