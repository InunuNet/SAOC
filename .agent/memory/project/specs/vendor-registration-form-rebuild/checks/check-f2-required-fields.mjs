#!/usr/bin/env node
// F2 (vendor-registration-form-rebuild) — real calls to BOTH validators prove the deploy-safety
// tightening actually landed in the SAME deploy as the UI: physicalAddress, emergencyContactName,
// and emergencyContactCellPhone are now required by validateVendorSubmissionInput() (server,
// lib/vendor-submissions.ts) AND validateVendorRegisterFormClientSide() (client,
// lib/vendor-register-form-validation.ts) -- never just one of the two. Also proves
// emergencyContactRelationship stays optional on both, and that a fully-populated Section 1/2
// payload (F1's new fields + this feature's requireds) is accepted by the real server validator.
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-f2-required-fields.mjs

import { validateVendorSubmissionInput } from '../../../../../../lib/vendor-submissions.ts';
import { validateVendorRegisterFormClientSide } from '../../../../../../lib/vendor-register-form-validation.ts';

const failures = [];

function fail(msg) {
  failures.push(msg);
}

const SERVER_MINIMAL_OLD_SHAPE = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

// (1) The exact old-shaped minimal payload (no physicalAddress/emergencyContact* fields) must
// now be REJECTED by the server validator, naming all three newly-required fields.
{
  const result = validateVendorSubmissionInput(SERVER_MINIMAL_OLD_SHAPE);
  if (result.valid !== false) {
    fail('Old-shaped minimal payload (missing physicalAddress/emergencyContact*) must now be rejected by validateVendorSubmissionInput.');
  } else {
    for (const field of ['physicalAddress', 'emergencyContactName', 'emergencyContactCellPhone']) {
      const named = (result.errors || []).some((e) => String(e).toLowerCase().includes(field.toLowerCase()));
      if (!named) {
        fail(`validateVendorSubmissionInput errors must name "${field}"; got ${JSON.stringify(result.errors)}.`);
      }
    }
  }
}

// (2) Same payload plus valid values for all three required fields must now validate.
{
  const result = validateVendorSubmissionInput({
    ...SERVER_MINIMAL_OLD_SHAPE,
    physicalAddress: '1 Orchid Way, Stellenbosch',
    emergencyContactName: 'John Vendor',
    emergencyContactCellPhone: '0827654321',
  });
  if (result.valid !== true) {
    fail(`Payload with all three required fields populated must validate true; got errors ${JSON.stringify(result.errors)}.`);
  }
}

// (3) A malformed emergencyContactCellPhone is still rejected by format, distinctly from
// presence -- proves the existing phone-pattern check (added by F1) still runs correctly once
// the field is mandatory.
{
  const result = validateVendorSubmissionInput({
    ...SERVER_MINIMAL_OLD_SHAPE,
    physicalAddress: '1 Orchid Way, Stellenbosch',
    emergencyContactName: 'John Vendor',
    emergencyContactCellPhone: 'not-a-phone-number',
  });
  if (result.valid !== false) {
    fail('A malformed emergencyContactCellPhone must still be rejected.');
  }
}

// (4) emergencyContactRelationship is NOT required -- omitting it must not fail validation.
{
  const result = validateVendorSubmissionInput({
    ...SERVER_MINIMAL_OLD_SHAPE,
    physicalAddress: '1 Orchid Way, Stellenbosch',
    emergencyContactName: 'John Vendor',
    emergencyContactCellPhone: '0827654321',
  });
  if (result.valid !== true) {
    fail('emergencyContactRelationship must remain optional on the server validator.');
  }
}

const CLIENT_STATE_BASE = {
  businessName: 'Cape Orchid Nursery',
  tradingName: '',
  tradingNameSameAsBusiness: false,
  contactPersonName: 'Jane Vendor',
  contactPosition: '',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  alternativeContactNumber: '',
  accountsContactName: '',
  accountsContactEmail: '',
  physicalAddress: '',
  postalAddress: '',
  postalAddressSameAsPhysical: false,
  businessEntityType: '',
  businessEntityTypeOther: '',
  cipcNumber: '',
  vatRegistered: '',
  vatNumber: '',
  countryOfBusinessRegistration: '',
  website: '',
  socialMediaHandle: '',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  boothCount: '1',
  boothType: '',
  tableCount: '',
  chairCount: '',
  powerRequired: 'true',
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
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactCellPhone: '',
};

// (5) Client-side validator must also now block on the same three empty fields.
{
  const errors = validateVendorRegisterFormClientSide(CLIENT_STATE_BASE);
  for (const field of ['physicalAddress', 'emergencyContactName', 'emergencyContactCellPhone']) {
    const named = errors.some((e) => String(e).toLowerCase().includes(field.toLowerCase()));
    if (!named) {
      fail(`validateVendorRegisterFormClientSide errors must name "${field}"; got ${JSON.stringify(errors)}.`);
    }
  }
}

// (6) Client-side validator accepts once all three (plus a valid phone) are filled in.
{
  const errors = validateVendorRegisterFormClientSide({
    ...CLIENT_STATE_BASE,
    physicalAddress: '1 Orchid Way, Stellenbosch',
    emergencyContactName: 'John Vendor',
    emergencyContactCellPhone: '0827654321',
  });
  if (errors.length !== 0) {
    fail(`Expected no client errors once required Section 1/2 fields are filled; got ${JSON.stringify(errors)}.`);
  }
}

// (7) Client-side validator flags a malformed (but non-empty) emergencyContactCellPhone.
{
  const errors = validateVendorRegisterFormClientSide({
    ...CLIENT_STATE_BASE,
    physicalAddress: '1 Orchid Way, Stellenbosch',
    emergencyContactName: 'John Vendor',
    emergencyContactCellPhone: 'nope',
  });
  const named = errors.some((e) => String(e).toLowerCase().includes('emergencycontactcellphone'));
  if (!named) {
    fail(`Expected a client error naming "emergencyContactCellPhone" for a malformed value; got ${JSON.stringify(errors)}.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('PASS: physicalAddress/emergencyContactName/emergencyContactCellPhone are required on both validators; emergencyContactRelationship stays optional.');
