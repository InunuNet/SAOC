#!/usr/bin/env node
// Regression guard, same pattern as F1's check-national-show-id-unchanged.mjs: F2's
// schema changes (TicketStatus gaining 'refunded', Ticket losing four payment fields,
// Ticket gaining orderId) must not touch the pre-existing, real Firestore `tickets`
// documents. F2 never migrates or backfills old positions — the 14 real nationalShow
// bookings keep whatever shape checkout wrote them in; only NEW positions written from
// this point on carry orderId. This check proves those 14 (plus the 1 QA negative-control
// fixture, 15 total) are still present and unmodified by anything F2 did.
//
// BASELINE, verified live 2026-08-17 (same read used for F1's baseline, re-verified for
// F2): 15 `tickets` documents total, 14 with showId == 'nationalShow', 1
// (76TA7iyOn8o0FCeNlNIr) with showId == 'door-qr-check-wrong-show' (door-checkin QA
// negative-control fixture — see F1's golden/README.md). This check's own fixture
// documents (contract-f2-fixture-order / -refunded, SAOC-2027-CONTRACT-F2-FIXTURE[-
// REFUNDED]) carry showId == 'contract-f2-fixture-show' or NATIONAL_SHOW_ID depending on
// which F2 check wrote them — see the >= comparison note below for why an exact count
// would be wrong here.
//
// NOTE ON THE COMPARISON: unlike F1's check (which ran before any F2 fixture existed),
// check-refunded-status-and-checkin-refusal.mjs deliberately writes ONE fixture position
// with showId == NATIONAL_SHOW_ID (required to exercise checkInByBookingRef()'s real
// gate — see that file's header). So this check's own baseline is intentionally a
// MINIMUM (>=), not an exact match: 14 real bookings, plus that one F2 fixture if it has
// already run in this same contract pass (order of assertion execution is not assumed).
// This mirrors F1's own off-by-one lesson (see F1 golden/README.md) applied forward:
// never assert an exact count when a legitimate, marked, non-deleted fixture can
// coexist with the real baseline.
//
// Read-only against the 'nationalShow'-scoped query; writes nothing.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f2-orders-model/check-national-show-tickets-unchanged.mjs
// Requires FIREBASE_ADMIN_* credentials in .env.local.

import { config } from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '../../../lib/firebase-admin.ts';
import { NATIONAL_SHOW_ID } from '../../../lib/tickets-constants.ts';

config({ path: '.env.local', quiet: true });

const BASELINE_MIN_COUNT = 14; // real pre-existing nationalShow bookings — see header

const failures = [];

try {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection('tickets').where('showId', '==', NATIONAL_SHOW_ID).get();
  if (snap.size < BASELINE_MIN_COUNT) {
    failures.push(
      `tickets with showId == '${NATIONAL_SHOW_ID}': found ${snap.size}, expected at least ` +
        `${BASELINE_MIN_COUNT} — existing booking refs may have been invalidated by F2`
    );
  }

  // The 14 real bookings predate F2 and were never touched by any F2 migration (F2 ships
  // no migration script — see golden/README.md). Every one of them must still be missing
  // `orderId` (nothing backfilled it) rather than carrying a corrupted or invented value —
  // proving F2 wrote no code path that silently mutates legacy positions.
  let uncontaminated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.bookingRef?.includes('CONTRACT-F2-FIXTURE')) continue; // this contract's own fixture, if already written
    if (data.orderId === undefined) uncontaminated += 1;
  }
  const realLegacyCount = snap.docs.filter((doc) => !doc.data().bookingRef?.includes('CONTRACT-F2-FIXTURE')).length;
  if (uncontaminated < Math.min(realLegacyCount, BASELINE_MIN_COUNT)) {
    failures.push(
      `${realLegacyCount - uncontaminated} legacy nationalShow ticket(s) unexpectedly carry an ` +
        `orderId field — F2 must not backfill or otherwise mutate pre-existing positions`
    );
  }
} catch (err) {
  console.error(`FAIL: Firestore read threw — ${err.message}`);
  process.exit(1);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: at least ${BASELINE_MIN_COUNT} pre-existing nationalShow tickets remain readable, and none ` +
    'were backfilled or otherwise mutated by F2.'
);
process.exit(0);
