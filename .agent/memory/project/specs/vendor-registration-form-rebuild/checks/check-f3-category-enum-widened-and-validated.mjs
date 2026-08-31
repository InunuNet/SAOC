#!/usr/bin/env node
// F3 (vendor-registration-form-rebuild) — THE DEPLOY-SAFETY / RIPPLE-SWEEP PROOF for the
// vendorCategory enum correction. Real calls to validateVendorSubmissionInput() (never a
// source-grep of VENDOR_CATEGORIES, which isn't exported) prove:
//
//   (a) every one of the 8 PRE-EXISTING VendorCategory values ('plant-sales', 'product-sales',
//       'rare-exotic-plants', 'food-retailer', 'hardware', 'books', 'art', 'other') still
//       validates with ZERO errors, individually and combined -- proving none was renamed or
//       removed, only relabelled in the UI;
//   (b) all 3 NEW values ('other-plant-sales', 'fertilisers-growing-media', 'pottery-ceramics')
//       now validate with zero errors -- proving the widening actually happened;
//   (c) a genuinely invalid value is still rejected, naming "category" in the error, proving
//       this is a real closed 11-member set, not an escape hatch to `string`;
//   (d) the new optional vendorCategoryOther field validates when present and respects its
//       max-length bound;
//   (e) F2's own two golden VendorRegisterFormState JSON fixtures (form-state-full.fixture.json,
//       form-state-minimal.fixture.json, built via the REAL buildVendorRegistrationPayload(), not
//       hand-typed), each still validate as valid:true with zero errors after this feature --
//       this is the concrete ripple-sweep proof: real, previously-passing golden payloads must
//       still pass, independent of any diff-scoped Codex review.
//
// Defeating mutation: renaming or removing any of the 8 old values, narrowing the union back to
// 8 (defeats (b)), widening validateVendorCategory to accept anything (defeats (c)), or breaking
// either golden fixture (defeats (e)).
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-f3-category-enum-widened-and-validated.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { validateVendorSubmissionInput } from '../../../../../../lib/vendor-submissions.ts';
import { buildVendorRegistrationPayload } from '../../../../../../lib/vendor-register-form-payload.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../../..');

const failures = [];
function fail(msg) {
  failures.push(msg);
}

const MINIMAL = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactCellPhone: '0834445555',
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

const EIGHT_OLD_VALUES = [
  'plant-sales',
  'product-sales',
  'rare-exotic-plants',
  'food-retailer',
  'hardware',
  'books',
  'art',
  'other',
];

const THREE_NEW_VALUES = ['other-plant-sales', 'fertilisers-growing-media', 'pottery-ceramics'];

// (a) Every old value, individually, must still validate.
for (const value of EIGHT_OLD_VALUES) {
  const result = validateVendorSubmissionInput({ ...MINIMAL, vendorCategory: [value] });
  if (!result.valid) {
    fail(
      `(a) pre-existing category "${value}" must still validate with zero errors -- got: ${result.errors.join('; ')}`,
    );
  }
}

// (b) Every new value, individually, must now validate.
for (const value of THREE_NEW_VALUES) {
  const result = validateVendorSubmissionInput({ ...MINIMAL, vendorCategory: [value] });
  if (!result.valid) {
    fail(
      `(b) new category "${value}" must validate with zero errors -- got: ${result.errors.join('; ')}`,
    );
  }
}

// (d1) All 11 values combined must validate.
{
  const result = validateVendorSubmissionInput({
    ...MINIMAL,
    vendorCategory: [...EIGHT_OLD_VALUES, ...THREE_NEW_VALUES],
  });
  if (!result.valid) {
    fail(`(d1) all 11 vendorCategory values combined must validate -- got: ${result.errors.join('; ')}`);
  }
}

// (c) A genuinely invalid value must still be rejected, naming "category".
{
  const result = validateVendorSubmissionInput({ ...MINIMAL, vendorCategory: ['flowers'] });
  if (result.valid) {
    fail('(c) an out-of-set vendorCategory value ("flowers") must be rejected, not silently accepted.');
  } else if (!result.errors.some((e) => e.toLowerCase().includes('category'))) {
    fail(`(c) rejection error must name "category" -- got: ${result.errors.join('; ')}`);
  }
}

// (d2) vendorCategoryOther validates when present, and respects its max length (100).
{
  const okResult = validateVendorSubmissionInput({
    ...MINIMAL,
    vendorCategory: ['other'],
    vendorCategoryOther: 'Orchid-themed jewellery',
  });
  if (!okResult.valid) {
    fail(`(d2) a populated vendorCategoryOther within bounds must validate -- got: ${okResult.errors.join('; ')}`);
  }

  const tooLong = 'x'.repeat(101);
  const overLengthResult = validateVendorSubmissionInput({
    ...MINIMAL,
    vendorCategory: ['other'],
    vendorCategoryOther: tooLong,
  });
  if (overLengthResult.valid) {
    fail('(d2) vendorCategoryOther over 100 characters must be rejected.');
  }
}

// (e) F2's own golden VendorRegisterFormState JSON fixtures, run through the REAL
// buildVendorRegistrationPayload(), must still validate as valid:true with zero errors.
const FIXTURE_PATHS = [
  'contracts/checks/vendor-form-ui/fixtures/form-state-full.fixture.json',
  'contracts/checks/vendor-form-ui/fixtures/form-state-minimal.fixture.json',
];

for (const relPath of FIXTURE_PATHS) {
  const absPath = path.join(REPO_ROOT, relPath);
  const state = JSON.parse(readFileSync(absPath, 'utf8'));
  const payload = buildVendorRegistrationPayload(state);
  const result = validateVendorSubmissionInput(payload);
  if (!result.valid) {
    fail(
      `(e) ripple-sweep: ${relPath}, built via the real buildVendorRegistrationPayload(), must still validate as valid:true after F3 -- got errors: ${result.errors.join('; ')}`,
    );
  }
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(
  'PASS: vendorCategory widened to 11 members (8 old preserved literally + 3 new), still a closed set, vendorCategoryOther validated, and both F2 golden form-state fixtures still validate end to end.',
);
