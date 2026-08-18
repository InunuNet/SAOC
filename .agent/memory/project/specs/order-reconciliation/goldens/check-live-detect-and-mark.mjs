#!/usr/bin/env node
// order-reconciliation F1, A4 — the "does it actually do the right thing with real data"
// proof the mission brief asks for, run against LIVE Firestore and the four orders proven
// stranded during mission prove-ticket-purchase-works-end-to-end-b + this contract's own
// review pass (booking refs SAOC-2027-5KYDSBMT38KX, SAOC-2027-R06HZ12P06EY,
// SAOC-2027-G08QJQK278NY, SAOC-2027-7HHE9QN51RH4; see .agent/memory/project/backlog.md).
//
// CORRECTED (2026-08-19): the original KNOWN_BOOKING_REFS were transcribed from the P1
// backlog entry as bare suffixes with the SAOC-2027- prefix dropped (a backlog transcription
// error, not a code defect — real docs always carried the prefix per lib/booking-ref.ts's
// BOOKING_REF_PREFIX). A live query against orders(status, expiresAt) also surfaced a FOURTH
// stranded E2E test order not in the original three; verified live (buyerEmail
// 'e2e-test@example.com', same test-fixture origin as the other three) and added to the
// allowlist below. A5th, unrelated document ('sentinel-order-recon-hold-...', a different
// contract's residue fixture, no m_payment_id) also matches the broad query — it is
// deliberately NOT in ALLOWED_ORDER_IDS and is exactly the case the write leash exists to
// protect against; see the "LEASHED WRITE" note below and this golden directory's README "A3
// is dynamic; A4's write leash is not (on purpose)".
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
// Pure helper only (no Firestore app init as a side effect of calling it) — same
// SENTINEL_EMAIL_DOMAIN marker contracts/checks/ticketing-hardening uses, so a fresh
// write-path sentinel this script creates (see "FORCED WRITE-PATH SENTINEL" below) is
// recognized by scripts/scan-firestore-residue.ts's org-wide residue scanner as a backstop,
// even though this script also deletes it directly in its own try/finally.
import { sentinelEmail } from '../../../../../../contracts/checks/ticketing-hardening/_shared.mjs';

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

// --- Resolve the four known stranded orders' Firestore order IDs via the same two-hop
// (tickets/{bookingRef} -> orderId) path A3 exercises dynamically. Booking refs carry the real
// BOOKING_REF_PREFIX (lib/booking-ref.ts) — tickets/{bookingRef}'s document id IS the full,
// prefixed booking ref (createOrderWithPosition writes tickets.doc(input.bookingRef)), so a
// bare suffix here would never resolve, which is exactly the bug this correction fixes.
const db = getFirestore(initAdmin());
const KNOWN_BOOKING_REFS = [
  'SAOC-2027-5KYDSBMT38KX',
  'SAOC-2027-R06HZ12P06EY',
  'SAOC-2027-G08QJQK278NY',
  'SAOC-2027-7HHE9QN51RH4',
];

const knownOrderIds = [];
// tickets/{bookingRef}'s document id IS the full, prefixed booking ref (see header) — so the
// position doc id for each known order is simply its KNOWN_BOOKING_REFS entry, in lockstep with
// knownOrderIds below.
const knownPositionIds = [];
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
  knownPositionIds.push(bookingRef);
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

// ticketing-capacity-reconciliation-hold F1 — markOrdersAlerted also writes
// reconciliationAlertedAt onto every tickets/{id} position sharing the order's orderId (see
// lib/reconciliation.ts's markOrdersAlerted header). The "reconciliation never mutates
// money state" guarantee this script proves is only actually proven against the collection
// this write touches if the position docs are snapshotted too, not just the order docs — a
// version that "helpfully" flipped a position's status/amount alongside the order-doc write
// would otherwise pass this whole script undetected.
const beforePositionStates = {};
for (const positionId of knownPositionIds) {
  const snap = await db.collection('tickets').doc(positionId).get();
  const data = snap.data();
  beforePositionStates[positionId] = {
    status: data.status,
    amount: data.amount,
    m_payment_id: data.m_payment_id,
    pf_payment_id: data.pf_payment_id,
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

// This script is expected to be safe to run repeatedly — including twice in a row within
// RE_ALERT_WINDOW_MS, which is exactly what a gate re-run does. So `needingAlertIds1` being
// empty (every known order was already alerted by an earlier run, inside the window) is a
// VALID outcome, not a failure — it's the idempotency guarantee already holding. What must
// never happen is BOTH "nothing needs alerting" AND "some known order has no
// reconciliationAlertedAt on record" at the same time — that combination would mean
// filterOrdersNeedingAlert() is wrongly excluding an order that was never actually marked.
if (needingAlertIds1.length > 0) {
  try {
    assertAllowlistedForWrite(needingAlertIds1);
    await markOrdersAlerted(needingAlertIds1, now);
  } catch (error) {
    failures.push(`write leash tripped: ${error instanceof Error ? error.message : String(error)}`);
  }
} else {
  console.log(
    'INFO: all known stranded orders were already alerted within RE_ALERT_WINDOW_MS (likely ' +
      'by an earlier run of this same check) — verifying the already-alerted state is real ' +
      'rather than performing a new write.'
  );
  for (const orderId of knownOrderIds) {
    const snap = await db.collection('orders').doc(orderId).get();
    if (!snap.data().reconciliationAlertedAt) {
      failures.push(
        `order ${orderId} was excluded from needing an alert but has NO reconciliationAlertedAt ` +
          'on record — filterOrdersNeedingAlert() is excluding an order that was never actually marked.'
      );
    }
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

// Same no-money-state-mutation guarantee, re-checked on the `tickets` position docs —
// markOrdersAlerted's other write target. status / amount / m_payment_id / pf_payment_id /
// purchasedAt must be unchanged even though reconciliationAlertedAt WAS written.
for (const positionId of knownPositionIds) {
  const snap = await db.collection('tickets').doc(positionId).get();
  const data = snap.data();
  const before = beforePositionStates[positionId];

  if (data.status !== before.status) {
    failures.push(`tickets/${positionId}.status changed from '${before.status}' to '${data.status}' — reconciliation must NEVER auto-settle a position's status.`);
  }
  if (data.amount !== before.amount) {
    failures.push(`tickets/${positionId}.amount changed from ${before.amount} to ${data.amount}.`);
  }
  if (data.m_payment_id !== before.m_payment_id) {
    failures.push(`tickets/${positionId}.m_payment_id changed from ${before.m_payment_id} to ${data.m_payment_id}.`);
  }
  if (data.pf_payment_id !== before.pf_payment_id) {
    failures.push(`tickets/${positionId}.pf_payment_id changed from ${before.pf_payment_id} to ${data.pf_payment_id}.`);
  }
  const afterPurchasedAtMs = data.purchasedAt ? data.purchasedAt.toMillis() : null;
  if (afterPurchasedAtMs !== before.purchasedAt) {
    failures.push(`tickets/${positionId}.purchasedAt changed — reconciliation must never set a purchase timestamp.`);
  }
  if (!data.reconciliationAlertedAt) {
    failures.push(`tickets/${positionId}.reconciliationAlertedAt was NOT set by markOrdersAlerted() — the position-write half of the alert-bookkeeping did not land.`);
  }
}

// --- FORCED WRITE-PATH SENTINEL --------------------------------------------------------------
// Everything above can go fully green while never actually calling markOrdersAlerted() in
// anger: if the four known orders were already alerted by an earlier run within
// RE_ALERT_WINDOW_MS, `needingAlertIds1` above is empty and Run 1 takes the "verify
// already-alerted state" branch — a documented-valid outcome, but one where the before/after
// money-state comparisons above are trivially true because nothing was written THIS run. On a
// machine where this gate is re-run more often than the 6-hour window elapses (exactly what a
// CI-style re-run does), the write path — including the atomic per-order WriteBatch this
// contract's sibling ticketing-capacity-reconciliation-hold extended to cover the `tickets`
// position doc, and the exact silent-oversell class Codex's review caught — could go
// unexercised by this gate indefinitely. So: create one fresh, never-before-alerted sentinel
// order+position pair, guaranteed to need an alert, on EVERY run, independent of the four known
// orders' current state. Cleaned up in its own try/finally regardless of outcome — an assertion
// failure here must never leave residue, matching this project's sentinel-cleanup convention
// (see scripts/scan-firestore-residue.ts).
const sentinelSuffix = `recon-write-path-${Date.now()}`;
const sentinelOrderId = `sentinel-order-${sentinelSuffix}`;
const sentinelPositionId = `sentinel-pos-${sentinelSuffix}`;
const sentinelBuyerEmail = sentinelEmail(sentinelSuffix);
// 24h ago — well clear of RE_ALERT_WINDOW_MS (6h), so there is no ambiguity about whether this
// fresh reservation "needs" an alert.
const sentinelExpiry = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

try {
  await db.collection('orders').doc(sentinelOrderId).set({
    showId: 'nationalShow',
    buyerName: 'Recon A4 Write-Path Sentinel',
    buyerEmail: sentinelBuyerEmail,
    amount: 0,
    status: 'reserved',
    expiresAt: sentinelExpiry,
    idempotencyKey: `sentinel-${sentinelSuffix}`,
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: null,
    m_payment_id: null,
    pf_payment_id: null,
  });
  await db.collection('tickets').doc(sentinelPositionId).set({
    bookingRef: sentinelPositionId,
    showId: 'nationalShow',
    attendeeName: 'Recon A4 Write-Path Sentinel',
    attendeeEmail: sentinelBuyerEmail,
    ticketType: 'exhibitor',
    status: 'reserved',
    amount: 0,
    purchasedAt: null,
    checkedInAt: null,
    m_payment_id: null,
    pf_payment_id: null,
    orderId: sentinelOrderId,
  });

  const nowForSentinel = Timestamp.now();
  const strandedSentinel = await findStrandedOrders(nowForSentinel);
  const sentinelStrandedIds = strandedSentinel.map((o) => o.orderId);
  if (!sentinelStrandedIds.includes(sentinelOrderId)) {
    failures.push(
      `findStrandedOrders() (live) did not detect the fresh write-path sentinel order ` +
        `${sentinelOrderId} — it was created reserved+expired and must always be stranded.`
    );
  }

  const needingAlertSentinelIds = filterOrdersNeedingAlert(strandedSentinel, nowForSentinel).map(
    (o) => o.orderId
  );
  if (!needingAlertSentinelIds.includes(sentinelOrderId)) {
    failures.push(
      `filterOrdersNeedingAlert() did not include the fresh sentinel order ${sentinelOrderId} ` +
        '— it has never been alerted and must always need one, regardless of the four known ' +
        "orders' current alert state."
    );
  } else {
    await markOrdersAlerted([sentinelOrderId], nowForSentinel);

    const orderAfter = (await db.collection('orders').doc(sentinelOrderId).get()).data();
    const positionAfter = (await db.collection('tickets').doc(sentinelPositionId).get()).data();

    if (!orderAfter.reconciliationAlertedAt) {
      failures.push(
        `sentinel order ${sentinelOrderId}.reconciliationAlertedAt was NOT set by ` +
          'markOrdersAlerted() — the write path did not actually execute this run.'
      );
    }
    if (!positionAfter.reconciliationAlertedAt) {
      failures.push(
        `sentinel position ${sentinelPositionId}.reconciliationAlertedAt was NOT set by ` +
          'markOrdersAlerted() — the position-write half of the write path did not execute ' +
          'this run.'
      );
    }
    if (orderAfter.status !== 'reserved' || orderAfter.amount !== 0) {
      failures.push(
        `sentinel order ${sentinelOrderId} money-state fields changed after a real, ` +
          `this-run write-path execution (status='${orderAfter.status}', amount=${orderAfter.amount}).`
      );
    }
    if (positionAfter.status !== 'reserved' || positionAfter.amount !== 0) {
      failures.push(
        `sentinel position ${sentinelPositionId} money-state fields changed after a real, ` +
          `this-run write-path execution (status='${positionAfter.status}', amount=${positionAfter.amount}).`
      );
    }

    // Idempotency, proven on THIS run's own fresh write rather than inherited from an earlier
    // run's state.
    const nowAfterSentinel = Timestamp.now();
    const strandedAfterSentinel = await findStrandedOrders(nowAfterSentinel);
    const needingAfterSentinelIds = filterOrdersNeedingAlert(
      strandedAfterSentinel,
      nowAfterSentinel
    ).map((o) => o.orderId);
    if (needingAfterSentinelIds.includes(sentinelOrderId)) {
      failures.push(
        `filterOrdersNeedingAlert() still included the sentinel order ${sentinelOrderId} ` +
          'immediately after markOrdersAlerted() ran on it — idempotency did not hold on a ' +
          'run that genuinely executed the write path.'
      );
    }
  }
} finally {
  await db.collection('orders').doc(sentinelOrderId).delete().catch(() => {});
  await db.collection('tickets').doc(sentinelPositionId).delete().catch(() => {});
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: against LIVE Firestore, findStrandedOrders() detected all four known stranded ' +
    'orders, markOrdersAlerted() wrote reconciliationAlertedAt on both the order docs and their ' +
    'tickets position docs, an immediate second run correctly excluded them (idempotency), and ' +
    'status/amount/gatewayPaymentId(/m_payment_id, pf_payment_id on positions)/purchasedAt were ' +
    'left completely untouched on every one of them — reconciliation flags, it never ' +
    'auto-settles. A fresh, never-before-alerted sentinel order+position also proved the write ' +
    'path itself (not just its no-op branch) on THIS run, independent of the four known ' +
    "orders' current alert state, and was cleaned up afterwards."
);
process.exit(0);
