#!/usr/bin/env node
// A1 -- lib/vendor-register-form-payload.ts's buildVendorRegistrationPayload() output, run
// through the REAL validateVendorSubmissionInput() (lib/vendor-submissions.ts, F4), must
// validate true for both a fully-populated form state and a minimal-required-only form state.
// This proves the payload SHAPE the form actually sends satisfies the real API contract --
// not an assumed shape gated only by this contract's own opinion of what "correct" looks like.
//
// DEFEATING MUTATION: boothCount/tableCount/chairCount/staffPerDay left as strings instead of
// coerced to number (the real validator's validatePositiveInteger/validateOptionalNonNegativeInteger
// both require `typeof value === 'number'` -- a string "2" fails silently); powerRequired/
// waterRequired left as the string "true" instead of coerced to the boolean true; an empty-string
// optional field forwarded as "" instead of omitted/undefined (harmless for validation today, but
// this check ALSO asserts full.fixture's optional fields survive intact, so a mutation that turns
// "" into a dropped key entirely would still be caught by A1b's round-trip check below).
//
// Run as: npx tsx contracts/checks/vendor-form-ui/check-payload-against-real-validator.mjs

import { readFileSync } from 'node:fs';

import { validateVendorSubmissionInput } from '../../../lib/vendor-submissions.ts';
import { buildVendorRegistrationPayload } from '../../../lib/vendor-register-form-payload.ts';

const failures = [];

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

const fullState = loadFixture('form-state-full.fixture.json');
const minimalState = loadFixture('form-state-minimal.fixture.json');

// --- A1a: full and minimal states both produce a payload the REAL validator accepts. ---
for (const [label, state] of [['full', fullState], ['minimal', minimalState]]) {
  const clean = { ...state };
  delete clean._comment;
  const payload = buildVendorRegistrationPayload(clean);
  const result = validateVendorSubmissionInput(payload);
  if (!result.valid) {
    failures.push(
      `buildVendorRegistrationPayload(${label} fixture) produced a payload the REAL ` +
        `validateVendorSubmissionInput() rejects: ${JSON.stringify(result.errors)}`,
    );
  }
}

// --- A1b: numeric/boolean coercion is real, not string pass-through. ---
{
  const clean = { ...fullState };
  delete clean._comment;
  const payload = buildVendorRegistrationPayload(clean);
  if (typeof payload.boothCount !== 'number' || payload.boothCount !== 2) {
    failures.push(`boothCount not coerced to number 2 (got ${JSON.stringify(payload.boothCount)})`);
  }
  if (typeof payload.tableCount !== 'number' || payload.tableCount !== 2) {
    failures.push(`tableCount not coerced to number 2 (got ${JSON.stringify(payload.tableCount)})`);
  }
  if (typeof payload.powerRequired !== 'boolean' || payload.powerRequired !== true) {
    failures.push(`powerRequired not coerced to boolean true (got ${JSON.stringify(payload.powerRequired)})`);
  }
  if (typeof payload.waterRequired !== 'boolean' || payload.waterRequired !== true) {
    failures.push(`waterRequired not coerced to boolean true (got ${JSON.stringify(payload.waterRequired)})`);
  }
  if (!Array.isArray(payload.vendorCategory) || payload.vendorCategory.length !== 2) {
    failures.push(`vendorCategory not preserved as a 2-entry array (got ${JSON.stringify(payload.vendorCategory)})`);
  }
  if (payload.website !== 'https://highveldorchids.co.za') {
    failures.push(`website value lost or mutated (got ${JSON.stringify(payload.website)})`);
  }
}

// --- A1c: an empty-string optional field in the minimal fixture must not become a REQUIRED
// non-empty string on the wire (proves optional fields are genuinely omittable, not forced to
// empty-string-as-value which some backends would reject differently from "absent"). ---
{
  const clean = { ...minimalState };
  delete clean._comment;
  const payload = buildVendorRegistrationPayload(clean);
  if (payload.tradingName === '') {
    failures.push(
      'tradingName left as empty string "" in the minimal-fixture payload -- optional text ' +
        'fields must be omitted (undefined) when left blank, not sent as "", so the built ' +
        'VendorSubmission document does not carry a garbage empty-string field forever',
    );
  }
  if (payload.paymentMethodsAccepted !== undefined && payload.paymentMethodsAccepted.length !== 0) {
    failures.push('paymentMethodsAccepted unexpectedly non-empty in the minimal fixture');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: buildVendorRegistrationPayload() output validates against the real F4 validator.');
process.exit(0);
