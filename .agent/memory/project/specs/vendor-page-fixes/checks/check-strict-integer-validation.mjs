#!/usr/bin/env node
// Behavioural (not structural) check for lib/vendor-register-form-validation.ts's
// validateVendorRegisterFormClientSide(). Imports the REAL module and calls it with a matrix
// of inputs -- this catches a validator that looks right in a grep but is wired to the wrong
// regex, per this project's own "assertion satisfiable by adjacent code, not the real
// property" defect class (see learned.md, the boothCount/Codex history).
//
// Run via tsx (already a devDependency in this repo's Next.js/TS toolchain) so the real
// TypeScript source is exercised, not a hand-copied JS reimplementation.
//
// Usage: npx tsx check-strict-integer-validation.mjs

import { validateVendorRegisterFormClientSide } from '../../../../../../lib/vendor-register-form-validation.ts';

const BASE_VALID_STATE = {
  businessName: 'Test Orchids CC',
  tradingName: '',
  contactPersonName: 'Test Person',
  contactCellPhone: '0821234567',
  contactEmail: 'test@example.com',
  physicalAddress: '',
  cipcNumber: '',
  vatNumber: '',
  website: '',
  socialMediaHandle: '',
  vendorCategory: ['plant-sales'],
  productDescription: 'Orchids',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  boothCount: '2',
  boothType: '',
  tableCount: '',
  chairCount: '',
  powerRequired: 'false',
  electricalLoad: '',
  waterRequired: '',
  staffPerDay: '',
  vehicleRegistrations: '',
  loadInSlot: '',
  loadOutSlot: '',
  bio: '',
  paymentMethodsAccepted: [],
  paymentReference: '',
  termsAccepted: true,
};

let failures = 0;

function expectEmpty(label, state) {
  const errors = validateVendorRegisterFormClientSide(state);
  if (errors.length !== 0) {
    console.error(`FAIL [${label}]: expected no errors, got ${JSON.stringify(errors)}`);
    failures++;
  } else {
    console.log(`PASS [${label}]`);
  }
}

function expectContains(label, state, expectedMessage) {
  const errors = validateVendorRegisterFormClientSide(state);
  if (!errors.includes(expectedMessage)) {
    console.error(
      `FAIL [${label}]: expected errors to include ${JSON.stringify(expectedMessage)}, got ${JSON.stringify(errors)}`,
    );
    failures++;
  } else {
    console.log(`PASS [${label}]`);
  }
}

// Baseline: a fully valid state produces zero errors.
expectEmpty('valid baseline', BASE_VALID_STATE);

// The exact defect Brad hit live: "e1" must be rejected, not silently coerced.
expectContains('boothCount "e1" rejected', { ...BASE_VALID_STATE, boothCount: 'e1' }, 'boothCount is required and must be a positive integer');

// The two Codex-identified false-valid cases: parseInt-only validation would accept these.
expectContains('boothCount "1.5" rejected', { ...BASE_VALID_STATE, boothCount: '1.5' }, 'boothCount is required and must be a positive integer');
expectContains('boothCount "1e3" rejected', { ...BASE_VALID_STATE, boothCount: '1e3' }, 'boothCount is required and must be a positive integer');

// Blank required field, zero, and negative must all be rejected with the same message.
expectContains('boothCount "" rejected', { ...BASE_VALID_STATE, boothCount: '' }, 'boothCount is required and must be a positive integer');
expectContains('boothCount "0" rejected', { ...BASE_VALID_STATE, boothCount: '0' }, 'boothCount is required and must be a positive integer');
expectContains('boothCount "-1" rejected', { ...BASE_VALID_STATE, boothCount: '-1' }, 'boothCount is required and must be a positive integer');

// A genuinely valid boothCount must NOT trip the check.
expectEmpty('boothCount "3" valid', { ...BASE_VALID_STATE, boothCount: '3' });

// Optional numeric fields: blank is fine, malformed is not, valid is fine.
expectEmpty('tableCount blank optional', { ...BASE_VALID_STATE, tableCount: '' });
expectContains('tableCount "1.5" rejected', { ...BASE_VALID_STATE, tableCount: '1.5' }, 'tableCount must be a non-negative integer');
expectEmpty('tableCount "0" valid', { ...BASE_VALID_STATE, tableCount: '0' });

// Required string fields.
expectContains('businessName blank rejected', { ...BASE_VALID_STATE, businessName: '   ' }, 'businessName is required and must be a non-empty string');

// vendorCategory empty array.
expectContains('vendorCategory empty rejected', { ...BASE_VALID_STATE, vendorCategory: [] }, 'vendorCategory is required and must be a non-empty array');

// termsAccepted false.
expectContains('termsAccepted false rejected', { ...BASE_VALID_STATE, termsAccepted: false }, 'termsAccepted must be true');

// powerRequired blank.
expectContains('powerRequired blank rejected', { ...BASE_VALID_STATE, powerRequired: '' }, 'powerRequired is required and must be a boolean');

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
