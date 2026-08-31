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
  'boothCount',
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

// (6) boothCount must be a positive integer — 0, -1, and 1.5 each rejected. The 1.5 case
// specifically defeats a `boothCount > 0` check that forgets Number.isInteger().
expectRejectedNaming('(6a) boothCount 0', { ...MINIMAL, boothCount: 0 }, 'booth');
expectRejectedNaming('(6b) boothCount -1', { ...MINIMAL, boothCount: -1 }, 'booth');
expectRejectedNaming('(6c) boothCount 1.5 (non-integer)', { ...MINIMAL, boothCount: 1.5 }, 'booth');

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
    'paymentMethod values, rejects non-positive and non-integer boothCount, and rejects any ' +
    'termsAccepted value other than boolean true.',
);
process.exit(0);
