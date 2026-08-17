#!/usr/bin/env node
// Behavioural proof of the hard backward-compatibility constraint from the README:
// NATIONAL_SHOW_ID must stay the literal string 'nationalShow' (Firestore showId
// scoping, decoupled from any Sanity 'show' document _id — see README's "corrected
// design"), and the pre-existing Firestore `tickets` documents keyed to that showId
// must remain readable and undiminished. Read-only against Firestore; writes nothing.
//
// BASELINE, verified live 2026-08-17: 15 `tickets` documents total, of which 14 carry
// showId == 'nationalShow' and 1 (76TA7iyOn8o0FCeNlNIr) deliberately carries showId ==
// 'door-qr-check-wrong-show' — the door-checkin QA suite's known negative-control
// fixture, not a nationalShow booking. The baseline below is 14, filtered to match
// exactly what the query below filters to. Do NOT "correct" this back to 15 — that
// would be asserting the FILTERED count against the TOTAL count, which is the exact
// off-by-one this check shipped with originally (caught in review 2026-08-17).
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f1-show-collision/check-national-show-id-unchanged.mjs
// Requires FIREBASE_ADMIN_* credentials in .env.local — read-only.

import { config } from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '../../../lib/firebase-admin.ts';
import { NATIONAL_SHOW_ID } from '../../../lib/tickets-constants.ts';

config({ path: '.env.local', quiet: true });

const failures = [];

if (NATIONAL_SHOW_ID !== 'nationalShow') {
  failures.push(`NATIONAL_SHOW_ID is '${NATIONAL_SHOW_ID}', expected the unchanged literal 'nationalShow'`);
}

const BASELINE_MIN_COUNT = 14; // showId == 'nationalShow' only — see header comment above

try {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection('tickets').where('showId', '==', NATIONAL_SHOW_ID).get();
  if (snap.size < BASELINE_MIN_COUNT) {
    failures.push(
      `tickets with showId == '${NATIONAL_SHOW_ID}': found ${snap.size}, expected at least ` +
        `${BASELINE_MIN_COUNT} (the pre-F1 baseline) — existing booking refs may have been invalidated`
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

console.log(`PASS: NATIONAL_SHOW_ID is unchanged and at least ${BASELINE_MIN_COUNT} existing tickets keyed to it are still readable.`);
process.exit(0);
