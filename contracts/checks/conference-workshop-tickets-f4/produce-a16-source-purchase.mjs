#!/usr/bin/env node
// F4 (conference-workshop-tickets, M2) — ONE-OFF MANUAL HELPER for producing A16's gws
// inbox-check manifest. NEVER part of the automated gate — no contract assertion calls
// this script, and it must not be added as one. Mirrors F3's
// produce-a30-source-purchase.mjs exactly (same ITN-to-paid path, same no-cleanup
// posture, same credential/usage conventions) — see that file's own header for the full
// rationale on why this drives the REAL PayFast ITN harness rather than a plain
// checkout POST, and why it owns its own one-off real-email write instead of going
// through createOrderAndPosition() (which hard-refuses any non-sentinel email).
//
// DIFFERENCE from A30: buys an EARLY-BIRD position (day-visitor's EB tier,
// requiresDaySelection: true) with a valid chosenDay (Friday, 2027-09-24) at its real
// price from ADMISSION_PRODUCTS — proving the confirmation email path for a
// day-qualified product, not day-visitor's plain tier. Built via
// buildMultiReservationDocs()/LineItemPlan (the chosenDay-aware builder — F1's single-
// item buildReservationDocs() used by A30 has no chosenDay field at all), same
// CLAUDE.md-documented "safe reference pattern" for Firestore builders.
//
// NO CLEANUP, deliberately: the resulting order/position stays `paid` under a real
// address (brad@inunu.net) so the confirmation email is real and gws-readable.
//
// USAGE (run by hand, exactly once per manifest (re)production):
//   node contracts/checks/conference-workshop-tickets-f4/produce-a16-source-purchase.mjs
// Prints the resulting bookingRef once position.status === 'paid'. After running:
//   1. Wait for the confirmation email to arrive at brad@inunu.net.
//   2. Find it: gws gmail users messages list (read-only — never `send`).
//   3. Read it: gws gmail users messages get <message_id>.
//   4. Write the manifest at
//      .agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f4-a16-confirmation-email-manifest.json
//      in the gws_manifest_good.json shape: {gws_subcommand: "mail read", message_id,
//      subject, from, recipient, timestamp, content_sha256, outcome, notes}.
//      `recipient` must be brad@inunu.net and `timestamp` must be within
//      gws_inbox_check.sh's 4h freshness window at gate time.
//
// CREDENTIALS: PAYFAST_SANDBOX_PASSPHRASE + the FIREBASE_ADMIN_* triple from .env.local
// — same as every other payfast-m1 behavioural check. Never printed.
import { register } from 'tsx/esm/api';

register();

const harness = await import('../payfast-m1/_itn-harness.mts');
const {
  credentialsAvailable,
  skipForMissingCredentials,
  realPayfastIp,
  buildXff,
  buildItnRequest,
  loadItnPost,
  withFetchStub,
  confirmStub,
  itnFields,
  signAndEncode,
  waitUntilQueryable,
} = harness;

const ASSERTION_ID = 'A16 source purchase (conference-workshop-tickets F4, manual helper)';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const { randomBytes } = await import('node:crypto');
const { Timestamp } = await import('firebase-admin/firestore');
const { buildMultiReservationDocs } = await import('@/lib/checkout-reservation');
const shared = await import('../ticketing-hardening/_shared.mjs');

const { ADMISSION_PRODUCTS } = await import('../../../lib/provisional-figures.ts');
const earlyBird = ADMISSION_PRODUCTS.find((p) => p.slug === 'early-bird');
if (!earlyBird) {
  console.error('FAIL: produce-a16-source-purchase.mjs');
  console.error("  - no 'early-bird' product in ADMISSION_PRODUCTS — cannot exercise its real price");
  process.exit(1);
}

const REAL_READABLE_RECIPIENT = 'brad@inunu.net';
const CHOSEN_DAY = '2027-09-24'; // Friday — not in DAY_VISITOR_EXCLUDED_DAYS
const database = shared.db();
const bookingRef = `CWT-F4-A16-${Date.now().toString(36)}`;
const orderRef = database.collection('orders').doc();
const positionRef = database.collection('tickets').doc(bookingRef);

const now = Timestamp.now();
const expiresAt = Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000);
const recoveryToken = randomBytes(16).toString('hex');

const { order, positions } = buildMultiReservationDocs({
  orderId: orderRef.id,
  reference: bookingRef,
  showId: shared.NATIONAL_SHOW_ID,
  lineItems: [
    {
      ticketType: 'early-bird',
      attendeeName: 'Brad (A16 manifest source purchase)',
      attendeeEmail: REAL_READABLE_RECIPIENT,
      amount: earlyBird.price,
      bookingRef,
      chosenDay: CHOSEN_DAY,
    },
  ],
  idempotencyKey: randomBytes(16).toString('hex'),
  expiresAt,
  recoveryToken,
  recoveryTokenExpiresAt: expiresAt,
  now,
  gateway: 'payfast',
  expectedGatewayAmount: null,
});

await orderRef.set(order);
await positionRef.set(positions[0]);
await waitUntilQueryable(database, order.m_payment_id, orderRef.id);

const POST = await loadItnPost();
const realIp = await realPayfastIp();
const xff = buildXff(realIp);

const fields = itnFields({ mPaymentId: bookingRef, amountGross: earlyBird.price.toFixed(2) });
const body = await signAndEncode(fields);

const { result: response } = await withFetchStub(confirmStub('VALID'), () =>
  POST(buildItnRequest({ body, xff })),
);

if (response.status !== 200) {
  console.error(`FAIL: produce-a16-source-purchase.mjs — ITN POST returned ${response.status}, expected 200`);
  process.exit(1);
}

const snapshot = await positionRef.get();
const data = snapshot.data();
if (!data || data.status !== 'paid') {
  console.error(`FAIL: produce-a16-source-purchase.mjs — position status is ${JSON.stringify(data?.status)}, expected 'paid'`);
  process.exit(1);
}

console.log(`Purchase settled: bookingRef=${bookingRef}, ticketType=early-bird, chosenDay=${CHOSEN_DAY}, recipient=${REAL_READABLE_RECIPIENT}, status=paid`);
console.log('Next: wait for the confirmation email, then use gws gmail users messages list/get ' +
  '(read-only) per this script\'s own header comment to produce f4-a16-confirmation-email-manifest.json.');
