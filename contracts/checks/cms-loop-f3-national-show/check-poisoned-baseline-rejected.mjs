#!/usr/bin/env node
// META — proves the poisoned-baseline guard actually refuses to start against sentinel-shaped
// content, and that it recognises the FULL dataset-residue-guard marker catalogue, not just this
// contract's own F3- prefix.
//
// WHY THIS CHECK EXISTS
// ----------------------
// A4's grep-based check only proves assertUsableBaseline/PoisonedBaselineError are MENTIONED at
// least three times in check-headline-round-trip.mjs — it cannot prove the guard actually throws
// on real sentinel-shaped input, nor that it recognises markers OTHER than this contract's own
// F3- prefix. That second gap matters concretely: check-show-identity-sweep.mjs (a different
// contract, same document) can leave its own sentinel in nationalShow, and A1 must refuse to
// capture THAT as a baseline too, not only its own leftovers.
//
// This runs the REAL assertUsableBaseline from the real guard module against fixture values —
// including markers lifted directly from contracts/golden/dataset-residue-guard/marker-catalogue
// patterns (SVI-, EXH-, not-a-real-status-, ZZCHECK-, F6-LOOP-PROOF-, generic SENTINEL, and the
// far-future-year shape for countdownDate) — never a mock of the guard's logic, and never touches
// Sanity or the network.

import { assertUsableBaseline, PoisonedBaselineError } from './_mutation-guard.mjs';

let failures = 0;
function check(ok, label, detail = '') {
  if (ok) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function expectRejected(field, value, label, opts) {
  let threw = false;
  let isRightType = false;
  try {
    assertUsableBaseline(field, value, opts);
  } catch (err) {
    threw = true;
    isRightType = err instanceof PoisonedBaselineError;
  }
  check(threw && isRightType, label, threw ? 'threw, but not a PoisonedBaselineError' : 'did not throw at all — the guard would have captured this as a restorable baseline');
}

function expectAccepted(field, value, label, opts) {
  let threw = false;
  try {
    assertUsableBaseline(field, value, opts);
  } catch (err) {
    threw = true;
  }
  check(!threw, label, threw ? 'threw on genuinely clean, real editorial content — a false positive' : '');
}

// --- text fields (title/location): reject markers from the FULL residue-guard catalogue -------
expectRejected('title', 'F3-TITLE-SENTINEL-1787355547212', 'rejects this contract\'s own F3- sentinel shape');
expectRejected('location', 'SVI-PARKING-SENTINEL-1786481132420', 'rejects show-visitor-info\'s SVI- sentinel shape (a different contract\'s residue)');
expectRejected('title', 'EXH-DEADLINE-SENTINEL-1786482650802', 'rejects show-exhibitor-info\'s EXH- sentinel shape');
expectRejected('title', 'not-a-real-status-42', 'rejects the not-a-real-status- marker shape');
expectRejected('title', 'ZZCHECK-AB12-CD34', 'rejects the ZZCHECK- marker shape');
expectRejected('title', 'F6-LOOP-PROOF-1-abc123', 'rejects the F6-LOOP-PROOF- marker shape');
expectRejected('title', 'leftover SENTINEL text from somewhere', 'rejects the generic SENTINEL catch-all shape');
expectRejected('title', 'stray nonce 1755616984123 left in the field', 'rejects the EPOCH-MS-NONCE catch-all shape (bare 13-digit Date.now() nonce, matching scan-dataset-residue.ts\'s 9th marker pattern)');
expectRejected('title', '', 'rejects an empty baseline (unusable, not restorable)');
expectRejected('title', null, 'rejects a missing (null) baseline');

// --- countdownDate: far-future-year shape, distinct from the text patterns ---------------------
expectRejected('countdownDate', '2098-12-31T22:00:00.000Z', 'rejects this contract\'s own far-future-year sentinel (2098)', { isDate: true });
expectRejected('countdownDate', '2099-01-01T00:00:00.000Z', 'rejects the far-future-year sentinel (2099)', { isDate: true });

// --- positive control: real content must NOT be rejected, or the guard is useless --------------
expectAccepted('title', 'The South African National Orchid Show', 'accepts real, clean title content');
expectAccepted('location', 'The Hangar, Stellenbosch Flying Club', 'accepts real, clean location content');
expectAccepted('countdownDate', '2027-09-18T09:00:00.000Z', 'accepts a real, near-future countdownDate', { isDate: true });

if (failures === 0) {
  console.log('PASS: the poisoned-baseline guard rejects every catalogued sentinel shape and accepts real content.');
  process.exit(0);
} else {
  console.error(`FAIL: ${failures} check(s) failed — see above.`);
  process.exit(1);
}
