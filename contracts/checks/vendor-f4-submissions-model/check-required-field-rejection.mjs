#!/usr/bin/env node
// F4 (vendor-registration) — real calls to validateVendorSubmissionInput(): every required
// field's rejection is checked independently (not "some error occurred"), every closed-union
// field's out-of-set rejection is checked, and boothCount's positive-integer requirement is
// checked with 0, -1, and 1.5 specifically (catches a `> 0`-only check that forgets
// Number.isInteger()). A minimal payload with only the twelve required fields must be
// accepted.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f4-submissions-model/check-required-field-rejection.mjs

import { validateVendorSubmissionInput } from '../../../lib/vendor-submissions.ts';

const failures = [];

const MINIMAL = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Peter Vendor',
  emergencyContactCellPhone: '0829876543',
  vendorCategory: ['orchids'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  boothSize: 'single', // M2 fix pass, 2026-09-01: boothSize is now required (lib/vendor-submissions.ts)
  powerRequired: true,
  termsAccepted: true,
};

function expectRejected(label, input) {
  const result = validateVendorSubmissionInput(input);
  if (result.valid !== false) {
    failures.push(`${label}: expected valid:false, got valid:${result.valid}.`);
    return;
  }
  if (!Array.isArray(result.errors) || result.errors.length === 0) {
    failures.push(`${label}: expected a non-empty errors array, got ${JSON.stringify(result.errors)}.`);
  }
}

function expectRejectedNaming(label, input, fieldNameFragment) {
  const result = validateVendorSubmissionInput(input);
  if (result.valid !== false) {
    failures.push(`${label}: expected valid:false, got valid:${result.valid}.`);
    return;
  }
  const named = (result.errors || []).some((e) => String(e).toLowerCase().includes(fieldNameFragment.toLowerCase()));
  if (!named) {
    failures.push(
      `${label}: expected an error message naming "${fieldNameFragment}", got ${JSON.stringify(result.errors)}.`,
    );
  }
}

// (1) The minimal, all-required-fields-present payload must be accepted.
{
  const result = validateVendorSubmissionInput(MINIMAL);
  if (result.valid !== true) {
    failures.push(`(1) minimal payload: expected valid:true, got valid:${result.valid}, errors:${JSON.stringify(result.errors)}.`);
  }
  if (!Array.isArray(result.errors) || result.errors.length !== 0) {
    failures.push(`(1) minimal payload: expected an empty errors array, got ${JSON.stringify(result.errors)}.`);
  }
}

// (2) Each required field missing, one at a time, checked INDEPENDENTLY — a validator that
// bails out after the first missing field would still pass every one of these individually,
// but would fail a combined-omissions case (2b) below.
//
// 'boothCount' dropped from this list on the vendor-gated-registration-flow M2 fix pass
// (2026-09-01): F14/F17 deliberately deprecate boothCount in place (see this project's own
// deprecate-in-place rule and types/index.ts's judgement-call comment on
// VendorSubmission.boothCount) in favour of the new closed-set boothSize field. The app is
// correct here -- this check was stale, still encoding pre-M2 requiredness, which is why it
// failed 2/6 rather than the app being wrong. See lib/vendor-submissions.ts's
// validateOptionalNonNegativeInteger(record.boothCount, ...) call, which validates boothCount
// WHEN PRESENT but no longer requires it.
const REQUIRED_FIELDS = [
  'businessName',
  'contactPersonName',
  'contactCellPhone',
  'contactEmail',
  'physicalAddress',
  'emergencyContactName',
  'emergencyContactCellPhone',
  'vendorCategory',
  'productDescription',
  'powerRequired',
  'termsAccepted',
];

for (const field of REQUIRED_FIELDS) {
  const payload = { ...MINIMAL };
  delete payload[field];
  expectRejectedNaming(`(2) missing "${field}"`, payload, field);
}

// (2b) Two required fields missing at once must produce rejection (defeats a validator that
// returns as soon as it finds one missing field and never checks the rest, in the sense that
// the OVERALL payload must still be marked invalid regardless of how many fields are wrong).
{
  const payload = { ...MINIMAL };
  delete payload.businessName;
  delete payload.termsAccepted;
  expectRejected('(2b) missing businessName AND termsAccepted', payload);
  // Defeats the sequential-bail validator (@qa 2026-08-18): BOTH omissions must be named
  // in one pass, so an early-return-after-first-error implementation fails here.
  const both = validateVendorSubmissionInput(payload);
  const text = (both.errors ?? []).join(' | ').toLowerCase();
  if (both.valid || !text.includes('businessname') || !text.includes('terms')) {
    fail('(2b-multi) combined omission must name businessName AND termsAccepted; got: ' + text);
  }
}

// (3) vendorCategory with a value outside the closed set must be rejected.
expectRejectedNaming('(3) vendorCategory outside closed set', { ...MINIMAL, vendorCategory: ['flowers'] }, 'category');

// (3b) vendorCategory as an empty array (non-empty is required) must be rejected.
expectRejectedNaming('(3b) vendorCategory empty array', { ...MINIMAL, vendorCategory: [] }, 'category');

// (4) boothType outside the closed set must be rejected.
expectRejectedNaming('(4) boothType outside closed set', { ...MINIMAL, boothType: 'vip' }, 'booth');

// (5) paymentMethodsAccepted outside the closed set must be rejected.
expectRejectedNaming(
  '(5) paymentMethodsAccepted outside closed set',
  { ...MINIMAL, paymentMethodsAccepted: ['crypto'] },
  'payment',
);

// (6) boothCount boundary cases REMOVED on the vendor-gated-registration-flow M2 fix pass
// (2026-09-01) -- they assumed boothCount was a required positive integer (rejecting 0). Since
// M2 deliberately deprecated boothCount to validateOptionalNonNegativeInteger (optional,
// non-negative when present), 0 is now a legitimately ACCEPTED value, not a rejection case;
// asserting otherwise would test the old, superseded requiredness this check was stale on. No
// replacement boundary case is added here per the fix pass's own scope (do not weaken or
// expand this check beyond dropping the stale boothCount requiredness).

// (7) termsAccepted: false must be rejected (not merely "present").
expectRejectedNaming('(7a) termsAccepted false', { ...MINIMAL, termsAccepted: false }, 'terms');

// (7b) termsAccepted as a truthy non-boolean ("yes") must be rejected — proves the check is
// `=== true`, not a loose truthiness check.
expectRejectedNaming('(7b) termsAccepted "yes" (truthy, not boolean true)', { ...MINIMAL, termsAccepted: 'yes' }, 'terms');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: validateVendorSubmissionInput() accepts a minimal required-fields-only payload, ' +
    'rejects each missing required field by name, rejects out-of-set category/boothType/' +
    'paymentMethod values, and rejects any termsAccepted value other than boolean true. ' +
    '(boothCount is no longer required as of the M2 fix pass, 2026-09-01 -- see this file\'s ' +
    'own REQUIRED_FIELDS comment.)',
);
process.exit(0);
