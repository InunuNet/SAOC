#!/usr/bin/env node
// F1 — A2: the non-collision half of the naming decision, proven both directions. It is not
// enough that the NEW type is named 'vendor*' (A1 covers that) — the OLD, unrelated
// 'exhibitor' feature (judged-entry guide behind /national-show/exhibitors) must survive this
// mission completely untouched: same identifiers, same registration, same field shape.
//
// THIS IS AN INVARIANT CHECK, not a before/after flip (same pattern as
// contracts/checks/cms-loop-f4-orphaned-types/check-province-registered-and-intact.mjs) — it
// is expected to PASS before, during, and after F1/F2 land, because adding vendorNursery
// should never require touching showExhibitorInfo.ts, showExhibitorStep.ts, or their object
// types. A failure here at ANY point is a real regression, not a flip this contract is
// waiting for.
//
// DEFEATING MUTATION: @dev "cleans up" by renaming showExhibitorStep -> vendorExhibitorStep
// to "match the new convention", or drops one of its fields while refactoring nearby files.
// A check that only greps for the substring "exhibitor" somewhere in index.ts would miss a
// field-level regression inside the existing type files themselves — this check imports the
// real modules and re-validates their field lists field-by-field.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f1f2-naming-and-nursery-schema/check-existing-exhibitor-feature-intact.mjs

import { readFileSync } from 'node:fs';
import { showExhibitorInfo } from '../../../sanity/schemas/documents/showExhibitorInfo.ts';
import { showExhibitorStep } from '../../../sanity/schemas/documents/showExhibitorStep.ts';
import { schemaTypes } from '../../../sanity/schemas/index.ts';

const baselinePath = new URL('./fixtures/existing-exhibitor-identifiers.json', import.meta.url);
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

const failures = [];

// --- showExhibitorInfo: name unchanged, still a document, still registered ---
if (showExhibitorInfo?.name !== 'showExhibitorInfo') {
  failures.push(`showExhibitorInfo.name changed to '${showExhibitorInfo?.name}'`);
}
if (showExhibitorInfo?.type !== 'document') {
  failures.push(`showExhibitorInfo.type changed to '${showExhibitorInfo?.type}'`);
}

// --- showExhibitorStep: name unchanged, still a document, its 6 fields still present ---
if (showExhibitorStep?.name !== 'showExhibitorStep') {
  failures.push(`showExhibitorStep.name changed to '${showExhibitorStep?.name}'`);
}
const stepFieldNames = (showExhibitorStep?.fields ?? []).map((f) => f.name);
for (const expected of ['title', 'when', 'body', 'order', 'status', 'active']) {
  if (!stepFieldNames.includes(expected)) {
    failures.push(`showExhibitorStep lost field '${expected}' — had: ${JSON.stringify(stepFieldNames)}`);
  }
}

// --- every identifier from the recorded baseline is still registered in schemaTypes ---
const registeredNames = schemaTypes.map((t) => t?.name);
for (const identifier of baseline.allIdentifiers) {
  if (!registeredNames.includes(identifier)) {
    failures.push(
      `schemaTypes no longer registers '${identifier}' (part of the pre-existing exhibitor ` +
        `feature) — found: ${JSON.stringify(registeredNames)}`
    );
  }
}

// --- the existing exhibitor route file still exists (F1 must not delete/rename it) ---
try {
  readFileSync(new URL(`../../../app/(marketing)/national-show/exhibitors/page.tsx`, import.meta.url));
} catch {
  failures.push(
    `app/(marketing)/national-show/exhibitors/page.tsx no longer exists — the pre-existing ` +
      `exhibitor-entry route must survive this mission untouched`
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the pre-existing exhibitor-entry feature (types, fields, route) is unchanged by this mission.'
);
process.exit(0);
