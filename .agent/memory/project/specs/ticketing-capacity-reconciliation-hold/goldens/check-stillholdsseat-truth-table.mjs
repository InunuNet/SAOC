#!/usr/bin/env node
// ============================================================================================
// WITHDRAWN 2026-08-19 — this contract's F1 was reverted before shipping (@qa found the
// premise false; no field this system records can distinguish a genuinely-paid order from an
// abandoned cart). lib/data/tickets.ts's stillHoldsSeat is no longer exported and no longer has
// the reconciliation-hold branch this script tests — RUNNING THIS WILL FAIL ON THE IMPORT, not
// because the code under test regressed. Kept unexecuted, as historical record, per
// .agent/memory/project/specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md — read that
// file before touching this one. Do not "fix" the import to make this pass again without first
// reading WITHDRAWN.md's "For the next reader".
// ============================================================================================
// ticketing-capacity-reconciliation-hold F1, A2 — proves stillHoldsSeat() (lib/data/tickets.ts)
// against its full truth table, importing the REAL exported function — no reimplementation.
//
// Five scenarios; (4) is the actual new behaviour this contract adds, the other four are
// regression guards on behaviour that must NOT change. See goldens/README.md "A2" for the
// full false-pass-risk table.
//
// Run as: npx tsx .agent/memory/project/specs/ticketing-capacity-reconciliation-hold/goldens/check-stillholdsseat-truth-table.mjs

import { stillHoldsSeat } from '../../../../../../lib/data/tickets.ts';
import { Timestamp } from 'firebase-admin/firestore';

// stillHoldsSeat calls Date.now() internally (it is not clock-injectable — deliberately
// kept simple, see lib/data/tickets.ts) — so PAST/FUTURE MUST be derived from the real
// Date.now() at run time, not a hardcoded calendar date. A hardcoded date drifts into the
// past or future as real wall-clock time moves past it, silently flipping which branch
// each case actually exercises (this is exactly what happened here originally: a fixture
// "PAST" that was still in the future by the time this check ran, making case 3 fail on
// the fixture, not on the code under test).
const NOW_MS = Date.now();
const PAST = Timestamp.fromMillis(NOW_MS - 60 * 60 * 1000); // 1h ago
const FUTURE = Timestamp.fromMillis(NOW_MS + 60 * 60 * 1000); // 1h from now

const failures = [];

function check(label, data, expected) {
  const actual = stillHoldsSeat(data);
  if (actual !== expected) {
    failures.push(`${label}: expected stillHoldsSeat() === ${expected}, got ${actual}`);
  }
}

// (1) paid, unconditional — reconciliationAlertedAt absent, expiresAt irrelevant/absent.
check('1: paid, no expiresAt', { status: 'paid' }, true);
check('1b: paid, expired expiresAt', { status: 'paid', expiresAt: PAST }, true);

// (2) reserved, not yet expired — the ordinary in-progress checkout.
check('2: reserved, future expiresAt', { status: 'reserved', expiresAt: FUTURE }, true);

// (3) reserved, expired, no alert — MUST still release (negative control: a lazy
// "always hold" implementation of this feature would fail here).
check('3: reserved, past expiresAt, no reconciliationAlertedAt', { status: 'reserved', expiresAt: PAST }, false);

// (4) reserved, expired, alerted — THE NEW BEHAVIOUR. Must hold.
check(
  '4: reserved, past expiresAt, reconciliationAlertedAt SET',
  { status: 'reserved', expiresAt: PAST, reconciliationAlertedAt: Timestamp.fromMillis(NOW_MS - 5000) },
  true
);

// (5) reserved, no expiresAt field at all — existing fail-closed guard, must not regress.
check('5: reserved, no expiresAt field', { status: 'reserved' }, true);

if (failures.length > 0) {
  console.error('FAIL — stillHoldsSeat truth table violated:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('PASS — stillHoldsSeat truth table (5/5), including the new reconciliation-hold case.');
