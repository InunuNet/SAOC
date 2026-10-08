#!/usr/bin/env node
// F1 (vendor-form-copy-20261007) -- real calls to buildVendorRegistrationPayload() prove:
// (a) the 5 new per-day staff fields (staffCountSetupDay/Day1/Day2/Day3/BreakdownDay) reach
//     the wire payload as numbers when populated;
// (b) the deprecated-in-place staffPerDay field is never set by the payload builder any more
//     (no UI collects it after this feature -- a stale literal line would silently keep
//     sending whatever old key happened to survive refactoring);
// (c) the new isWasteTypesOtherFieldApplicable gate is leak-proof, exactly like every existing
//     gate in this file (wasteTypesOther is omitted when 'other' is not selected, even with a
//     stale typed value, and included when it is selected);
// (d) storageRiskAcknowledged and wasteTypes themselves survive onto the payload untouched.
//
// Run as:
//   npx tsx .agent/memory/project/specs/vendor-form-copy-20261007/checks/check-f1-payload-gates.mjs

import { buildVendorRegistrationPayload } from '../../../../../../lib/vendor-register-form-payload.ts';

const failures = [];
function fail(msg) {
  failures.push(msg);
}

// Full current VendorRegisterFormState shape (lib/vendor-register-form-payload.ts) plus the
// fields this feature adds. Every helper in that file (omitBlank, toOptionalInt, trim()) is
// called unconditionally across most of these keys, so every key must be a real string/array/
// boolean, never omitted -- an undefined here would throw before the assertions below run.
const BASE_STATE = {
  businessName: 'Cape Orchid Nursery',
  tradingName: '',
  tradingNameSameAsBusiness: true,
  businessEntityType: 'sole-proprietor',
  businessEntityTypeOther: '',
  contactPersonName: 'Jane Vendor',
  contactPosition: 'Owner',
  contactCellPhone: '0821234567',
  alternativeContactNumber: '',
  contactEmail: 'jane@capeorchid.example',
  accountsContactName: '',
  accountsContactEmail: '',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  postalAddressSameAsPhysical: true,
  postalAddress: '',
  cipcNumber: '',
  vatRegistered: '',
  vatNumber: '',
  countryOfBusinessRegistration: '',
  website: '',
  emergencyContactName: 'John Vendor',
  emergencyContactRelationship: '',
  emergencyContactCellPhone: '0827654321',
  facebookHandle: '',
  instagramHandle: '',
  tiktokHandle: '',
  youtubeHandle: '',
  otherSocialMediaHandle: '',
  vendorCategory: ['orchids'],
  vendorCategoryOther: '',
  productDescription: 'Cattleya and Cymbidium hybrids.',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  citesListedSpecies: '',
  foodHealthTradingDocumentation: '',
  foodVendorCertifications: [],
  boothSize: 'single',
  boothType: '',
  boothPositionRequest: '',
  adjacentBoothRequested: '',
  adjacentBoothVendorName: '',
  specialDisplayRequirements: '',
  tableCount: '',
  chairCount: '',
  powerRequired: '',
  electricalOutletsRequired: '',
  electricalEquipmentEntries: [],
  gasEquipmentEntries: [],
  waterRequired: '',
  waterIntendedUse: '',
  wastewaterDrainageRequired: '',
  wastewaterDrainageDetails: '',
  staffPerDay: '', // deprecated-in-place -- never set by the UI after this feature
  carRegistrationNumber: '',
  suvBakkieRegistrationNumber: '',
  panelVanRegistrationNumber: '',
  deliveryVanRegistrationNumber: '',
  truckRegistrationNumber: '',
  trailerRegistrationNumber: '',
  otherVehicleRegistrationNumber: '',
  otherVehicleDescription: '',
  loadInSlot: '',
  loadOutSlot: '',
  bio: '',
  marketingPermission: '',
  publicLiabilityInsurancePolicyNumber: '',
  productLiabilityInsurancePolicyNumber: '',
  paymentMethodsAccepted: [],
  paymentReference: '',
  termsAccepted: true,
  signatureFullName: '',

  // F1 (vendor-form-copy-20261007) additions.
  staffCountSetupDay: '2',
  staffCountDay1: '3',
  staffCountDay2: '3',
  staffCountDay3: '3',
  staffCountBreakdownDay: '1',
  storageRiskAcknowledged: true,
  wasteTypes: ['general', 'plant-material'],
  wasteTypesOther: 'Stale other-waste text',
};

// (1) The 5 per-day staff counts reach the payload as real numbers.
{
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  const expected = {
    staffCountSetupDay: 2,
    staffCountDay1: 3,
    staffCountDay2: 3,
    staffCountDay3: 3,
    staffCountBreakdownDay: 1,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (payload[key] !== value) {
      fail(`Expected payload.${key} === ${JSON.stringify(value)}, got ${JSON.stringify(payload[key])}.`);
    }
  }
}

// (2) staffPerDay is never set by the payload builder any more -- no fieldset collects it, so a
// stale literal line (`staffPerDay: toOptionalInt(state.staffPerDay)`) must not survive.
{
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.staffPerDay !== undefined) {
    fail(`buildVendorRegistrationPayload() must not set staffPerDay any more; got ${JSON.stringify(payload.staffPerDay)}.`);
  }
}

// (3) wasteTypes survives onto the payload untouched when populated.
{
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (JSON.stringify(payload.wasteTypes) !== JSON.stringify(['general', 'plant-material'])) {
    fail(`Expected payload.wasteTypes === ["general","plant-material"], got ${JSON.stringify(payload.wasteTypes)}.`);
  }
}

// (4) wasteTypesOther is leak-proof: 'other' NOT selected must omit it even with a stale typed
// value -- same property every existing gate in this file (isTradingNameFieldApplicable etc.)
// already has.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, wasteTypes: ['general'] });
  if (payload.wasteTypesOther !== undefined) {
    fail(`'other' not selected must omit wasteTypesOther from the payload; got ${JSON.stringify(payload.wasteTypesOther)}.`);
  }
}

// (5) wasteTypesOther is sent once 'other' is selected.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, wasteTypes: ['other'] });
  if (payload.wasteTypesOther !== 'Stale other-waste text') {
    fail(`'other' selected must send the typed wasteTypesOther; got ${JSON.stringify(payload.wasteTypesOther)}.`);
  }
}

// (6) storageRiskAcknowledged survives onto the payload as a real boolean, both ways.
{
  const trueCase = buildVendorRegistrationPayload({ ...BASE_STATE, storageRiskAcknowledged: true });
  const falseCase = buildVendorRegistrationPayload({ ...BASE_STATE, storageRiskAcknowledged: false });
  if (trueCase.storageRiskAcknowledged !== true) {
    fail(`Expected payload.storageRiskAcknowledged === true, got ${JSON.stringify(trueCase.storageRiskAcknowledged)}.`);
  }
  if (falseCase.storageRiskAcknowledged !== false) {
    fail(`Expected payload.storageRiskAcknowledged === false, got ${JSON.stringify(falseCase.storageRiskAcknowledged)}.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('PASS: F1 staff-per-day / waste / storage fields reach the payload correctly; staffPerDay is retired from the builder; wasteTypesOther is leak-proof.');
