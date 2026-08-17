#!/usr/bin/env node
// F1 — A3: the naming decision is "internal names use vendor*" — this checks that promise
// holds INSIDE the new type itself, not just at the top-level type name (A1 already covers
// that). Deep-scans every field name, title, and description on the actual imported
// vendorNursery object for the substring "exhibitor" (case-insensitive).
//
// Scanning the IMPORTED RUNTIME OBJECT rather than the raw source file is deliberate: source
// comments are allowed and expected to reference the old feature (this contract's own checks
// do exactly that, for context) — what must never leak is a *field name, title, or
// user-facing description* copy-pasted from showExhibitorStep.ts/showExhibitorInfo.ts, which
// comments cannot produce but a lazy copy-paste of a defineField() call can.
//
// DEFEATING MUTATION: @dev copies a defineField() block from showExhibitorStep.ts as a
// starting point and forgets to rename the field (e.g. `exhibitorHistory` instead of
// `history`) or its description ("...matches the exhibitor journey stage pattern..." left in
// a live field description shown to editors in Studio).
//
// Run as: node --import tsx/esm contracts/checks/vendor-f1f2-naming-and-nursery-schema/check-no-exhibitor-leak-in-vendornursery.mjs

import { vendorNursery } from '../../../sanity/schemas/documents/vendorNursery.ts';

const LEAK_PATTERN = /exhibitor/i;
const failures = [];

function scan(value, path) {
  if (typeof value === 'string') {
    if (LEAK_PATTERN.test(value)) {
      failures.push(`${path} contains 'exhibitor': ${JSON.stringify(value)}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => scan(item, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    // `validation` is a function (Rule callback) — not serialisable, and not a naming
    // surface. Everything else (name/title/description/options/of/fields/...) is scanned.
    for (const [key, item] of Object.entries(value)) {
      if (key === 'validation') continue;
      scan(item, `${path}.${key}`);
    }
  }
}

scan(vendorNursery, 'vendorNursery');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log("PASS: no field name, title, or description on vendorNursery contains 'exhibitor'.");
process.exit(0);
