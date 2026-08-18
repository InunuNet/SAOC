#!/usr/bin/env node
// A2 -- field-spec.golden.json's 31 field keys, in order, are deep-equal to the property names
// mechanically extracted from lib/vendor-submissions.ts's buildVendorSubmission() real
// return-object-literal source (excluding the two trailing system-set lines, status/submittedAt)
// -- NOT a hand-typed list independently re-derived by this check, and NOT VendorSubmissionDraft's
// full key set (which structurally also carries the 8 F6/F7 admin-only additive fields --
// reviewedBy, reviewedAt, proofOfPaymentPath, proofOfPaymentUploadedAt, boothNumber,
// paymentReceived, paymentConfirmedBy, paymentConfirmedAt -- that a public form must NEVER
// collect). This is the same derivation technique used to generate the golden in the first
// place -- run again here so a future edit to buildVendorSubmission's field list without a
// matching golden update fails the gate instead of silently drifting.
//
// DEFEATING MUTATION: a form that adds/renders a 32nd input for one of the 8 admin-only fields
// (e.g. a stray boothNumber input); a form missing one of the real 31 keys in field-spec.golden.json
// while buildVendorSubmission still expects it.
//
// Run as: node contracts/checks/vendor-form-ui/check-field-spec-key-completeness.mjs

import { readFileSync } from 'node:fs';

const repoRoot = new URL('../../../', import.meta.url);
const src = readFileSync(new URL('lib/vendor-submissions.ts', repoRoot), 'utf8');

const match = src.match(/export function buildVendorSubmission[\s\S]*?return \{([\s\S]*?)\};/);
if (!match) {
  console.error('FAIL: could not locate buildVendorSubmission\'s return object literal in lib/vendor-submissions.ts');
  process.exit(1);
}

const realKeys = [...match[1].matchAll(/^\s*([a-zA-Z]+):/gm)]
  .map((m) => m[1])
  .filter((k) => k !== 'status' && k !== 'submittedAt');

const golden = JSON.parse(
  readFileSync(new URL('../../golden/vendor-form-ui/field-spec.golden.json', import.meta.url), 'utf8'),
);
const goldenKeys = golden.fields.map((f) => f.key);

const failures = [];

if (realKeys.length !== 31) {
  failures.push(`expected exactly 31 real fields derived from buildVendorSubmission, found ${realKeys.length}`);
}

if (JSON.stringify(realKeys) !== JSON.stringify(goldenKeys)) {
  const missing = realKeys.filter((k) => !goldenKeys.includes(k));
  const extra = goldenKeys.filter((k) => !realKeys.includes(k));
  failures.push(
    `field-spec.golden.json's field keys are not deep-equal, in order, to the real ` +
      `buildVendorSubmission() field list. Missing from golden: ${JSON.stringify(missing)}. ` +
      `Extra in golden (not a real public field -- check it isn't an admin-only F6/F7 field): ` +
      `${JSON.stringify(extra)}.`,
  );
}

if (new Set(goldenKeys).size !== goldenKeys.length) {
  failures.push('field-spec.golden.json contains a duplicate field key');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: field-spec.golden.json enumerates exactly the 31 real public VendorSubmission fields.');
process.exit(0);
