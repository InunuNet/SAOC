#!/usr/bin/env node
// F13 follow-up (vendor-gated-registration-flow, M2) -- A41: waterRequired
// (lib/vendor-submissions.ts, typed `waterRequired?: boolean` at types/index.ts) is copied
// into the persisted vendorSubmissions document by buildVendorSubmission but was never named
// by validateVendorSubmissionInput -- pre-existing since before this mission (confirmed via
// `git log -S "'waterRequired'"` on lib/vendor-submissions.ts, which returns nothing: it was
// never validated at any point in the repo's history). A direct POST could persist any
// non-boolean value under that key. Fixed by adding the same
// validateOptionalBoolean(record, 'waterRequired', errors) call already used for the sibling
// field powerRequired's required counterpart pattern.
//
// BEHAVIOURAL, not a grep for the function-call text: drives the real, exported
// validateVendorSubmissionInput() directly with an otherwise-fully-valid input, once with a
// non-boolean waterRequired (must now be rejected), once with each real boolean value and once
// omitted entirely (all three must still be accepted -- proves this is additive tightening,
// not a regression on the legitimate cases the real form sends).
//
// FAILS ON: waterRequired: 'yes' (a non-boolean) being accepted, or waterRequired: true / false
// / undefined being wrongly rejected.
//
// Run as: npx tsx contracts/checks/vendor-gated-registration-flow-m2/check-water-required-validated.mjs

import { validateVendorSubmissionInput } from '../../../lib/vendor-submissions.ts';

const failures = [];

// A minimal, otherwise-fully-valid raw input -- every field validateVendorSubmissionInput
// actually requires, per lib/vendor-submissions.ts.
function baseInput(waterRequiredOverride) {
  const input = {
    businessName: 'Test Orchid Traders',
    contactPersonName: 'Jane Test',
    contactCellPhone: '0821234567',
    contactEmail: 'jane.test@example.com',
    productDescription: 'Assorted cymbidium and cattleya orchids.',
    physicalAddress: '123 Orchid Lane, Cape Town',
    emergencyContactName: 'John Test',
    emergencyContactCellPhone: '0837654321',
    vendorCategory: ['orchids'],
    boothCount: 1,
    boothSize: 'single', // M2 fix pass, 2026-09-01: boothSize is now required (lib/vendor-submissions.ts)
    powerRequired: false,
    termsAccepted: true,
  };
  if (waterRequiredOverride !== undefined) {
    input.waterRequired = waterRequiredOverride;
  }
  return input;
}

// (1) A non-boolean waterRequired must now be rejected.
{
  const result = validateVendorSubmissionInput(baseInput('yes'));
  if (result.valid !== false) {
    failures.push(
      "waterRequired: 'yes' (a non-boolean string) was accepted -- validateVendorSubmissionInput " +
        'still does not validate waterRequired.',
    );
  } else if (!result.errors.some((e) => e.includes('waterRequired'))) {
    failures.push(
      `waterRequired: 'yes' was correctly rejected, but no reported error names 'waterRequired' ` +
        `-- errors: ${JSON.stringify(result.errors)}. The rejection may be for an unrelated reason, ` +
        'proving nothing about waterRequired specifically.',
    );
  }
}

// (2)-(4) Every legitimate value the real form can send must still be accepted.
for (const value of [true, false, undefined]) {
  const result = validateVendorSubmissionInput(baseInput(value));
  if (result.valid !== true) {
    failures.push(
      `waterRequired: ${JSON.stringify(value)} was wrongly rejected -- errors: ` +
        `${JSON.stringify(result.errors)}. This must be additive tightening, not a regression ` +
        'on a legitimate real-form value.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: validateVendorSubmissionInput now rejects a non-boolean waterRequired and still " +
    'accepts true, false, and omitted.',
);
process.exit(0);
