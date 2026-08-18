#!/usr/bin/env node
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

const NOW_MS = Date.parse('2026-08-19T12:00:00Z');
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
