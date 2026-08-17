#!/usr/bin/env node
// F3 (ticketing-foundation) — proves spec §5.3's definition of `owner`: "every currently-
// defined capability, full stop." The design intent (dispatch brief, "Design points already
// decided") is that `owner`'s bundle should be DERIVED from the fixed CAPABILITIES set in
// lib/admin-roles.ts, not hand-listed — so a capability added later automatically lands in
// `owner` without a second edit.
//
// NARROWED CLAIM (2026-08-18, per @qa): this check does NOT prove derivation/authorship — a
// hand-listed `owner` that currently, coincidentally, lists all seven capabilities would
// pass this check identically to a genuinely derived one. `resolve()` can only ever report
// what a bundle currently CONTAINS, not how it was constructed; only reading the source
// (see check-manager-hand-listed-source.mjs, A8, for why that's the right instrument for an
// authorship property) could distinguish the two, and that distinction doesn't carry the
// same security weight for `owner` that it does for `manager` — see README's "Why only
// manager gets a source-level construction check." What THIS check actually proves, and
// which remains real and durable regardless of authorship: owner's CONTENTS equal the full
// fixed CAPABILITIES set exactly, right now, and will keep failing loudly the moment that
// stops being true — i.e. it is the regression guard for future drift (a capability added to
// CAPABILITIES without a matching addition to owner's bundle), not a proof of present
// derivation.
//
// `manager` and `owner` being identical today is INTENTIONAL (both currently equal the
// full fixed set) — this file deliberately does NOT assert they differ.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f3-admin-roles/check-owner-derived-from-fixed-set.mjs

import { CAPABILITIES, resolve } from '../../../lib/admin-roles.ts';

const failures = [];

const owner = resolve(['owner']);
const fixedSet = new Set(CAPABILITIES);

if (owner.size !== fixedSet.size) {
  failures.push(
    `resolve(['owner']) has ${owner.size} capabilities, expected exactly ${fixedSet.size} ` +
      '(the full fixed CAPABILITIES set).'
  );
}

for (const cap of fixedSet) {
  if (!owner.has(cap)) {
    failures.push(`resolve(['owner']) is missing capability '${cap}' from the fixed set.`);
  }
}

for (const cap of owner) {
  if (!fixedSet.has(cap)) {
    failures.push(`resolve(['owner']) includes '${cap}', which is not in the fixed CAPABILITIES set.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: resolve(['owner']) equals the full fixed CAPABILITIES set exactly, proven live. " +
    "(Proves owner's current contents match the fixed set and will keep doing so as it " +
    'grows — does NOT prove owner is derived rather than hand-listed; see this file\'s ' +
    'header.)'
);
process.exit(0);
