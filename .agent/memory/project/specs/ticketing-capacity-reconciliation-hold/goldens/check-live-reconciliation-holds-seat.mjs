#!/usr/bin/env node
// ============================================================================================
// WITHDRAWN 2026-08-19 — this contract's F1 was reverted before shipping (@qa found the
// premise false; no field this system records can distinguish a genuinely-paid order from an
// abandoned cart — see
// .agent/memory/project/specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md). RUNNING
// THIS WILL NOW FAIL: lib/data/tickets.ts's stillHoldsSeat no longer holds a seat on
// reconciliationAlertedAt, so step 5 below ("alerted expired reservation should be held") will
// correctly report the seat as released. That is the withdrawal working as intended, not a
// regression. Kept unexecuted, as historical record — read WITHDRAWN.md before touching this.
// ============================================================================================
// ticketing-capacity-reconciliation-hold F1, A4 — the "does it actually do the right thing"
// proof against LIVE Firestore and the REAL production capacity-counting path
// (getSoldCountsByTicketType, lib/data/tickets.ts) — not a fake store, not a reimplementation.
//
// Reuses contracts/checks/ticketing-hardening/_shared.mjs's proven fixture/lock/manifest/sweep
// infrastructure (same TARGET_TICKET_TYPE = 'exhibitor', price 0, already-safe fixture type,
// withCleanup for suite-lock + kill-safety + residue assertion) rather than inventing a new
// mutation-safety mechanism — see this project's own contract_checks_mutate_live_content
// incident memory for why that infrastructure exists, and this suite's own header comment on
// why mutating checks take the lock (a prior run's foreign sweep once deleted this run's
// in-flight fixtures).
//
// Sequence (see goldens/README.md "A4" for the full false-pass-risk table):
//   1. Sweep sentinels, read baseline held count for 'exhibitor' via the REAL
//      getSoldCountsByTicketType.
//   2. Write one sentinel-tagged reserved+EXPIRED order/position pair directly (no
//      reconciliationAlertedAt yet), manifest-recorded before each write for kill-safety.
//   3. Assert the real getSoldCountsByTicketType does NOT count it — negative control:
//      an ordinary stranded/abandoned reservation must still release.
//   4. Call the REAL markOrdersAlerted (live write, no injected deps.db) — the one live
//      mutation this script performs beyond fixture setup, and it writes exactly the
//      field the function is documented to write.
//   5. Assert getSoldCountsByTicketType NOW counts it — the seat is held.
//   withCleanup sweeps sentinels + asserts no residue afterwards regardless of outcome.
//
// Run as: npx tsx .agent/memory/project/specs/ticketing-capacity-reconciliation-hold/goldens/check-live-reconciliation-holds-seat.mjs
// Preconditions: same as contracts/checks/ticketing-hardening (.env.local present, dev
// Firebase admin credentials available). No running dev server required — this script calls
// lib functions directly, not HTTP.

import { Timestamp } from 'firebase-admin/firestore';
import { getSoldCountsByTicketType } from '../../../../../../lib/data/tickets.ts';
import { markOrdersAlerted } from '../../../../../../lib/reconciliation.ts';
import {
  db,
  sentinelEmail,
  sweepSentinels,
  recordFixtureCreated,
  withCleanup,
  assert,
  TARGET_TICKET_TYPE,
  NATIONAL_SHOW_ID,
} from '../../../../../../contracts/checks/ticketing-hardening/_shared.mjs';

async function heldCount() {
  const counts = await getSoldCountsByTicketType(NATIONAL_SHOW_ID);
  return counts[TARGET_TICKET_TYPE] ?? 0;
}

await withCleanup('A4 reconciliation-alerted reservation holds its seat past expiry', async () => {
  await sweepSentinels();
  const baseline = await heldCount();

  const runLabel = `recon-hold-${Date.now()}`;
  const orderId = `sentinel-order-${runLabel}`;
  const positionId = `sentinel-pos-${runLabel}`;
  const pastExpiry = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000); // 1h ago

  recordFixtureCreated('orders', orderId);
  await db()
    .collection('orders')
    .doc(orderId)
    .set({
      showId: NATIONAL_SHOW_ID,
      buyerName: 'Recon Hold Check',
      buyerEmail: sentinelEmail(`recon-hold-${runLabel}`),
      amount: 0,
      status: 'reserved',
      expiresAt: pastExpiry,
      idempotencyKey: `sentinel-${runLabel}`,
      purchasedAt: null,
      gateway: 'payfast',
      gatewayPaymentId: null,
      m_payment_id: null,
      pf_payment_id: null,
    });

  recordFixtureCreated('tickets', positionId);
  await db()
    .collection('tickets')
    .doc(positionId)
    .set({
      bookingRef: positionId,
      showId: NATIONAL_SHOW_ID,
      attendeeName: 'Recon Hold Check',
      attendeeEmail: sentinelEmail(`recon-hold-${runLabel}`),
      ticketType: TARGET_TICKET_TYPE,
      status: 'reserved',
      amount: 0,
      // ticketing-position-expiry-write F1 — stillHoldsSeat (lib/data/tickets.ts) reads
      // expiresAt off the POSITION document, not the order; without this field it fails
      // closed ("no expiresAt -> hold forever"), which masks the exact property this
      // script's negative control (step 3) exists to prove. Same Timestamp as the order
      // doc's expiresAt above — order and position always expire at the same instant.
      expiresAt: pastExpiry,
      purchasedAt: null,
      checkedInAt: null,
      m_payment_id: null,
      pf_payment_id: null,
      orderId,
    });

  // Step 3 — negative control: an ordinary stranded reservation, not yet alerted, must
  // still release once expired. This must hold BEFORE this contract's fix is regressed
  // into "hold everything forever".
  const heldBeforeAlert = await heldCount();
  assert(
    heldBeforeAlert === baseline,
    `negative control failed: expired-but-unalerted reservation should NOT be held (baseline ${baseline}, got ${heldBeforeAlert})`
  );

  // Step 4 — the one live reconciliation write in this script: exactly what
  // markOrdersAlerted is documented to write, against the real order created above.
  await markOrdersAlerted([orderId], Timestamp.now());

  // Step 5 — the new behaviour: now held.
  const heldAfterAlert = await heldCount();
  assert(
    heldAfterAlert === baseline + 1,
    `reconciliation-hold failed: alerted expired reservation should be held (expected ${baseline + 1}, got ${heldAfterAlert})`
  );
});
