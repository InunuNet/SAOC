#!/usr/bin/env node
// F3 (conference-workshop-tickets, M2) — ONE-OFF MANUAL HELPER for producing A30's gws
// inbox-check manifest. NEVER part of the automated gate — no contract assertion calls
// this script, and it must not be added as one.
//
// FIX (team-lead run, 2026-10-07): v1 of this script drove a plain checkout POST and
// stopped at `reserved` — WRONG. app/api/tickets/checkout/route.ts never sends a
// confirmation email on reservation; the send fires from the ITN handler on settlement
// to `paid` (same as A29's own path). A real checkout POST against beta also resolves
// the site's currently-active gateway (observed live: Ozow, not PayFast), and there is
// no Ozow ITN test harness in this project — so driving that order to paid would need a
// different route (`/api/tickets/ozow-itn`) this harness doesn't support.
//
// v2 (this version) drives the SAME ITN-to-paid path A29 uses
// (contracts/checks/payfast-m1/_itn-harness.mts's loadItnPost() + PayFast ITN fields/
// signature), against an order THIS script creates directly — same shape
// createOrderAndPosition() builds (same buildReservationDocs() call, gateway: 'payfast'
// explicitly, so the existing unmodified PayFast ITN route applies) — but NOT via
// createOrderAndPosition() itself, which hard-refuses any non-sentinel email
// (_itn-harness.mts:242-244, `Refusing to create an order/position without the sentinel
// email marker`) — a real guard that exists for good reason and stays untouched. This
// script owns its own one-off real-email write instead, entirely inside this file, so
// every OTHER PayFast-m1 check keeps that guard exactly as before.
//
// NO CLEANUP, deliberately: the resulting order/position stays `paid` under a real
// address (brad@inunu.net) so the confirmation email is real and gws-readable — the
// entire point of this script. Not swept, not deleted.
//
// Settles SAOC-2027-F6HZVA7K3RH5 (v1's stranded `reserved` order, created via a real
// checkout POST against beta): per team-lead's framing, left to expire naturally per this
// project's own documented reservation-expiry rules (docs/order-reconciliation.md,
// docs/ticketing-position-expiry-write.md) — it is an ordinary unsettled reservation,
// exactly the shape those mechanisms already handle, so no manual action was taken on it.
//
// USAGE (run by hand, exactly once per manifest (re)production):
//   node contracts/checks/conference-workshop-tickets-f3/produce-a30-source-purchase.mjs
// Prints the resulting bookingRef once position.status === 'paid'. After running:
//   1. Wait for the confirmation email to arrive at brad@inunu.net.
//   2. Find it: gws gmail users messages list (read-only — never `send`).
//   3. Read it: gws gmail users messages get <message_id>.
//   4. Write the manifest at
//      .agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f3-a30-confirmation-email-manifest.json
//      in the shape .agent/memory/project/specs/verification-triad-gate/goldens/fixtures/gws_manifest_good.json
//      uses: {gws_subcommand, message_id, subject, from, recipient, timestamp,
//      content_sha256, outcome, notes}. `recipient` must be brad@inunu.net and
//      `timestamp` must be within gws_inbox_check.sh's 4h freshness window at gate time.
//
// CREDENTIALS: PAYFAST_SANDBOX_PASSPHRASE + the FIREBASE_ADMIN_* triple from .env.local —
// same as every other payfast-m1 behavioural check.
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

const ASSERTION_ID = 'A30 source purchase (conference-workshop-tickets F3, manual helper)';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const { randomBytes } = await import('node:crypto');
const { Timestamp } = await import('firebase-admin/firestore');
const { buildReservationDocs } = await import('@/lib/checkout-reservation');
const shared = await import('../ticketing-hardening/_shared.mjs');

const { ADMISSION_PRODUCTS } = await import('../../../lib/provisional-figures.ts');
const dayVisitor = ADMISSION_PRODUCTS.find((p) => p.slug === 'day-visitor');
if (!dayVisitor) {
  console.error('FAIL: produce-a30-source-purchase.mjs');
  console.error("  - no 'day-visitor' product in ADMISSION_PRODUCTS — cannot exercise its real price");
  process.exit(1);
}

const REAL_READABLE_RECIPIENT = 'brad@inunu.net';
const database = shared.db();
const bookingRef = `CWT-F3-A30-${Date.now().toString(36)}`;
const orderRef = database.collection('orders').doc();
const positionRef = database.collection('tickets').doc(bookingRef);

const now = Timestamp.now();
const expiresAt = Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000);

const { order, position } = buildReservationDocs({
  orderId: orderRef.id,
  bookingRef,
  showId: shared.NATIONAL_SHOW_ID,
  attendeeName: 'Brad (A30 manifest source purchase)',
  attendeeEmail: REAL_READABLE_RECIPIENT,
  ticketType: 'day-visitor',
  amount: dayVisitor.price,
  idempotencyKey: randomBytes(16).toString('hex'),
  expiresAt,
  recoveryToken: randomBytes(16).toString('hex'),
  recoveryTokenExpiresAt: expiresAt,
  now,
  gateway: 'payfast',
});

await orderRef.set(order);
await positionRef.set(position);
await waitUntilQueryable(database, order.m_payment_id, orderRef.id);

const POST = await loadItnPost();
const realIp = await realPayfastIp();
const xff = buildXff(realIp);

const fields = itnFields({ mPaymentId: bookingRef, amountGross: dayVisitor.price.toFixed(2) });
const body = await signAndEncode(fields);

const { result: response } = await withFetchStub(confirmStub('VALID'), () =>
  POST(buildItnRequest({ body, xff })),
);

if (response.status !== 200) {
  console.error(`FAIL: produce-a30-source-purchase.mjs — ITN POST returned ${response.status}, expected 200`);
  process.exit(1);
}

const snapshot = await positionRef.get();
const data = snapshot.data();
if (!data || data.status !== 'paid') {
  console.error(`FAIL: produce-a30-source-purchase.mjs — position status is ${JSON.stringify(data?.status)}, expected 'paid'`);
  process.exit(1);
}

console.log(`Purchase settled: bookingRef=${bookingRef}, recipient=${REAL_READABLE_RECIPIENT}, status=paid`);
console.log('Next: wait for the confirmation email, then use gws gmail users messages list/get ' +
  '(read-only) per this script\'s own header comment to produce f3-a30-confirmation-email-manifest.json.');
