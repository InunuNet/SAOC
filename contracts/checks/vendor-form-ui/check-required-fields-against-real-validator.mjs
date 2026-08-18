#!/usr/bin/env node
// A3 -- field-spec.golden.json's `requiredKeys` (and each field's `required` flag) is exactly
// the set the REAL validateVendorSubmissionInput() (lib/vendor-submissions.ts, F4) treats as
// required -- derived by actually calling the real function, omitting one required key at a
// time from an otherwise-valid payload and confirming it rejects, then confirming a
// required-only payload (every optional field absent) is accepted. Not an inspection of the
// validator's source text -- a real, repeated function call.
//
// DEFEATING MUTATION: marking a field `required: true` in the golden that the real validator
// does not actually require (or the reverse) -- either direction is caught, since this proves
// BOTH "omitting it breaks validation" AND "the full required-only set alone passes."
//
// Run as: npx tsx contracts/checks/vendor-form-ui/check-required-fields-against-real-validator.mjs

import { readFileSync } from 'node:fs';

import { validateVendorSubmissionInput } from '../../../lib/vendor-submissions.ts';

const golden = JSON.parse(
  readFileSync(new URL('../../golden/vendor-form-ui/field-spec.golden.json', import.meta.url), 'utf8'),
);

const failures = [];

const BASE_VALID_PAYLOAD = {
  businessName: 'Acme Orchids',
  contactPersonName: 'Jane Doe',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@acme.co.za',
  productDescription: 'Cattleya hybrids',
  vendorCategory: ['plant-sales'],
  boothCount: 2,
  powerRequired: true,
  termsAccepted: true,
};

// --- A3a: the required-only payload, with every optional field absent, validates true. ---
{
  const result = validateVendorSubmissionInput(BASE_VALID_PAYLOAD);
  if (!result.valid) {
    failures.push(
      `a payload containing ONLY the golden's requiredKeys should validate true against the ` +
        `real validator, but got errors: ${JSON.stringify(result.errors)}`,
    );
  }
}

// --- A3b: omitting any one golden requiredKey from the base payload makes it invalid. ---
for (const key of golden.requiredKeys) {
  const payload = { ...BASE_VALID_PAYLOAD };
  delete payload[key];
  const result = validateVendorSubmissionInput(payload);
  if (result.valid) {
    failures.push(
      `golden.requiredKeys claims "${key}" is required, but omitting it from an otherwise-valid ` +
        `payload still validates true against the real validator`,
    );
  }
}

// --- A3c: golden.requiredKeys is exactly the set of fields marked required:true in field-spec's
// fields array (no drift between the two representations within the golden itself). ---
const fromFields = golden.fields.filter((f) => f.required).map((f) => f.key).sort();
const requiredKeysSorted = [...golden.requiredKeys].sort();
if (JSON.stringify(fromFields) !== JSON.stringify(requiredKeysSorted)) {
  failures.push(
    `field-spec.golden.json's per-field "required" flags disagree with its own top-level ` +
      `requiredKeys list. From fields[]: ${JSON.stringify(fromFields)}. From requiredKeys: ` +
      `${JSON.stringify(requiredKeysSorted)}.`,
  );
}

// --- A3d: exactly 9 required fields, matching F4's own validator body (5 requireNonEmptyString
// calls + vendorCategory + boothCount + powerRequired + termsAccepted). ---
if (golden.requiredKeys.length !== 9) {
  failures.push(`expected exactly 9 required fields, golden.requiredKeys has ${golden.requiredKeys.length}`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: field-spec.golden.json\'s required-field set matches the real F4 validator exactly.');
process.exit(0);
