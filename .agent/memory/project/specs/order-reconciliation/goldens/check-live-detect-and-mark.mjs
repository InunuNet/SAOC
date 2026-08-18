#!/usr/bin/env node
// order-reconciliation F1, A4 — the "does it actually do the right thing with real data"
// proof the mission brief asks for, run against LIVE Firestore and the three orders proven
// stranded during mission prove-ticket-purchase-works-end-to-end-b (booking refs
// 5KYDSBMT38KX, R06HZ12P06EY, G08QJQK278NY; see .agent/memory/project/backlog.md).
//
// Calls the REAL lib/reconciliation.ts functions with NO injected fake store (deps.db
// omitted -> real getFirestore(initAdmin())) — this is the one script in this contract that is
// deliberately allowed to write to live Firestore, and it writes exactly ONE field:
// `reconciliationAlertedAt` on the orders/{orderId} documents for the known stranded orders.
// That field is new, alert-bookkeeping-only, and is precisely what this feature is supposed to
// write in production once shipped — it is not a "silent mutation" in the sense of the
// project's fixture-leak/sentinel-corruption incidents (those wrote FAKE data into fields real
// pages read and trust; this writes a real, disclosed field this feature owns end to end).
// Money-state fields (status, amount, gatewayPaymentId, purchasedAt) are asserted UNCHANGED
// below — that assertion is the actual point of this script.
//
// LEASHED WRITE (added after review — see project memory contract_checks_mutate_live_content,
// a prior contract check whose sentinel corruption sat on the deployed site for three days):
// DETECTION exercises the real, broad `status=='reserved' AND expiresAt<now` query against
// whatever is actually in Firestore — that's necessary, it's the only way to prove the query
// itself is correct. But the WRITE (markOrdersAlerted) is restricted to an explicit, hardcoded
// allowlist (ALLOWED_ORDER_IDS, resolved only from KNOWN_BOOKING_REFS below, never from the
// query's own output) and assertAllowlisted() HARD-FAILS the whole script (exit 1) if it is
// ever asked to write an id outside that allowlist. This makes it structurally impossible for
// this gate to stamp `reconciliationAlertedAt` onto a real customer's order, even in an
// environment whose Firestore holds real data alongside the three known sandbox test orders,
// and even if a future edit to the filtering logic above the write call accidentally widened
// it. If the live query surfaces OTHER stranded orders beyond the allowlist, that's logged as
// informational only — this script never touches them.
//
// Deliberately does NOT call sendReconciliationAlert / lib/email.ts / Resend anywhere — this
// script proves the detection + idempotent-marking pipeline only. The live HTTP route,
// including the real alert email, is a human-run manual verification step (see this golden
// directory's README "Manual verification step") — same deferral F8's comp-tickets contract
// made for its live-session HTTP round trip, for the same reason: an automated gate that can
// re-run at any time must never have a side effect (a real email landing in a real inbox) that
// depends on how many times it happened to run.
//
// Run as: npx tsx .agent/memory/project/specs/order-reconciliation/goldens/check-live-detect-and-mark.mjs

import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { readEnvLocal } from '../../../../../../scripts/scan-firestore-residue.ts';
import {
  findStrandedOrders,
  filterOrdersNeedingAlert,
  markOrdersAlerted,
} from '../../../../../../lib/reconciliation.ts';
import { initAdmin } from '../../../../../../lib/firebase-admin.ts';

const envLocal = readEnvLocal();
for (const key of ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY']) {
  if (!process.env[key] && envLocal[key]) process.env[key] = envLocal[key];
}
for (const key of ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY']) {
  if (!process.env[key]) {
    console.error(`SETUP FAILURE: ${key} missing from environment and .env.local`);
    process.exit(2);
  }
}

const failures = [];
const now = Timestamp.now();

// --- Resolve the three known stranded orders' Firestore order IDs via the same two-hop
// (tickets/{bookingRef} -> orderId) path verify_stranded_orders_live.py (A3) already proved.
// Re-implemented minimally here (read-only get, no import of Python) since this file needs the
// order IDs to check post-run state, not just booking refs.
const db = getFirestore(initAdmin());
const KNOWN_BOOKING_REFS = ['5KYDSBMT38KX', 'R06HZ12P06EY', 'G08QJQK278NY'];

const knownOrderIds = [];
for (const bookingRef of KNOWN_BOOKING_REFS) {
  const positionSnap = await db.collection('tickets').doc(bookingRef).get();
  if (!positionSnap.exists) {
    console.error(`SETUP FAILURE: tickets/${bookingRef} does not exist in live Firestore — this golden's premise (see A3) no longer holds`);
    process.exit(2);
  }
  const orderId = positionSnap.data().orderId;
  if (!orderId) {
    console.error(`SETUP FAILURE: tickets/${bookingRef} has no orderId`);
    process.exit(2);
  }
  knownOrderIds.push(orderId);
}

// The ONLY ids this script is ever permitted to write to. Deliberately built solely from the
// hardcoded KNOWN_BOOKING_REFS resolution above — never from findStrandedOrders()'s own
// output — so a mutation to the filtering logic below the write call cannot silently widen the
// blast radius. Frozen so nothing downstream can mutate it either.
const ALLOWED_ORDER_IDS = Object.freeze([...knownOrderIds]);

/**
 * Hard leash on the one write this script performs. Throws (never warns, never silently
 * drops) if asked to write any id outside ALLOWED_ORDER_IDS — see this file's header
 * "LEASHED WRITE" for why this exists.
 */
function assertAllowlistedForWrite(orderIds) {
  const disallowed = orderIds.filter((id) => !ALLOWED_ORDER_IDS.includes(id));
  if (disallowed.length > 0) {
    throw new Error(
      `refusing to write reconciliationAlertedAt to order id(s) outside the hardcoded ` +
        `allowlist: ${disallowed.join(', ')}. ALLOWED_ORDER_IDS=[${ALLOWED_ORDER_IDS.join(', ')}]. ` +
        'This is a hard stop, not a filter — a contract gate must never be able to mutate a ' +
        'record it was not explicitly told about.'
    );
  }
}

// Snapshot money-state fields BEFORE this script touches anything.
const beforeStates = {};
for (const orderId of knownOrderIds) {
  const snap = await db.collection('orders').doc(orderId).get();
  const data = snap.data();
  beforeStates[orderId] = {
    status: data.status,
    amount: data.amount,
    gatewayPaymentId: data.gatewayPaymentId,
    purchasedAt: data.purchasedAt ? data.purchasedAt.toMillis() : null,
  };
}

// --- Run 1: detect + mark. ---
// Detection is run against the REAL, unrestricted query — this is what proves the query
// itself is correct against whatever the live dataset actually contains.
const stranded1 = await findStrandedOrders(now);
const strandedIds1 = stranded1.map((o) => o.orderId);
const missingFromRun1 = knownOrderIds.filter((id) => !strandedIds1.includes(id));
if (missingFromRun1.length > 0) {
  failures.push(
    `findStrandedOrders() (live) did not detect known stranded order(s): ${missingFromRun1.join(', ')}`
  );
}

// Informational only: other real stranded orders may legitimately exist in this dataset.
// This script never touches them — see assertAllowlistedForWrite below.
const otherStrandedIds1 = strandedIds1.filter((id) => !ALLOWED_ORDER_IDS.includes(id));
if (otherStrandedIds1.length > 0) {
  console.log(
    `INFO: findStrandedOrders() also surfaced ${otherStrandedIds1.length} order(s) outside ` +
      `this script's allowlist (not written to): ${otherStrandedIds1.join(', ')}`
  );
}

const needingAlert1 = filterOrdersNeedingAlert(stranded1, now);
// Restricted to the allowlist BEFORE the write — the filter above is a normal business-logic
// step; this second, allowlist-only filter plus the assertAllowlistedForWrite() guard right
// before the write call is the actual leash.
const needingAlertIds1 = needingAlert1.map((o) => o.orderId).filter((id) => ALLOWED_ORDER_IDS.includes(id));
if (needingAlertIds1.length === 0) {
  failures.push('filterOrdersNeedingAlert() (live) excluded ALL known stranded orders on run 1 — expected at least one needing an alert.');
} else {
  try {
    assertAllowlistedForWrite(needingAlertIds1);
    await markOrdersAlerted(needingAlertIds1, now);
  } catch (error) {
    failures.push(`write leash tripped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Run 2, immediately after: proves idempotency. The orders just marked must now be
// EXCLUDED from filterOrdersNeedingAlert (inside RE_ALERT_WINDOW_MS), so a reconciliation run
// seconds apart never re-alerts on the same still-unresolved order every single time.
const now2 = Timestamp.now();
const stranded2 = await findStrandedOrders(now2);
const needingAlert2 = filterOrdersNeedingAlert(stranded2, now2);
const needingAlertIds2 = needingAlert2.map((o) => o.orderId);
const stillNeedingAlert = needingAlertIds1.filter((id) => needingAlertIds2.includes(id));
if (stillNeedingAlert.length > 0) {
  failures.push(
    `filterOrdersNeedingAlert() (live, run 2, immediately after markOrdersAlerted) still ` +
      `included order(s) just marked: ${stillNeedingAlert.join(', ')} — idempotency guard did not hold.`
  );
}

// --- No-money-state-mutation guarantee: re-read the three known orders and confirm status /
// amount / gatewayPaymentId / purchasedAt are UNCHANGED from before this script ran, even
// though reconciliationAlertedAt WAS written. A reconciliation implementation that "helpfully"
// auto-settled a stranded order to 'paid' would fail exactly here.
for (const orderId of knownOrderIds) {
  const snap = await db.collection('orders').doc(orderId).get();
  const data = snap.data();
  const before = beforeStates[orderId];

  if (data.status !== before.status) {
    failures.push(`order ${orderId}.status changed from '${before.status}' to '${data.status}' — reconciliation must NEVER auto-settle an order's status.`);
  }
  if (data.amount !== before.amount) {
    failures.push(`order ${orderId}.amount changed from ${before.amount} to ${data.amount}.`);
  }
  if (data.gatewayPaymentId !== before.gatewayPaymentId) {
    failures.push(`order ${orderId}.gatewayPaymentId changed from ${before.gatewayPaymentId} to ${data.gatewayPaymentId}.`);
  }
  const afterPurchasedAtMs = data.purchasedAt ? data.purchasedAt.toMillis() : null;
  if (afterPurchasedAtMs !== before.purchasedAt) {
    failures.push(`order ${orderId}.purchasedAt changed — reconciliation must never set a purchase timestamp.`);
  }
  if (!data.reconciliationAlertedAt) {
    failures.push(`order ${orderId}.reconciliationAlertedAt was NOT set by markOrdersAlerted() — the alert-bookkeeping write did not land.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: against LIVE Firestore, findStrandedOrders() detected all three known stranded ' +
    'orders, markOrdersAlerted() wrote reconciliationAlertedAt, an immediate second run correctly ' +
    'excluded them (idempotency), and status/amount/gatewayPaymentId/purchasedAt were left ' +
    'completely untouched on every one of them — reconciliation flags, it never auto-settles.'
);
process.exit(0);
