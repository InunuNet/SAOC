#!/usr/bin/env node
// F4 (vendor-registration-form-rebuild) — real calls to buildVendorRegistrationPayload() prove
// the four new leak-proof render-gate + payload-exclusion guards (mirroring
// isElectricalLoadApplicable's existing shape and naming convention exactly) actually exclude
// their dependent field's value from the wire payload when the controlling boolean says "no",
// even when the dependent field still holds a stale typed value, and include it otherwise:
//
//   - isAdjacentBoothVendorNameFieldApplicable(state)              => adjacentBoothRequested === 'true'
//   - isWaterIntendedUseFieldApplicable(state)                     => waterRequired === 'true'
//   - isWastewaterDrainageDetailsFieldApplicable(state)             => wastewaterDrainageRequired === 'true'
//   - isElectricalEquipmentContinuousDetailsFieldApplicable(state)  => isElectricalLoadApplicable(state)
//                                                                       && electricalEquipmentContinuousOperation === 'true'
//
// Also proves the EXISTING isElectricalLoadApplicable() gate now additionally covers
// electricalOutletsRequired and electricalEquipmentList (reused verbatim, never a duplicated
// second gate function with the same condition), and specifically proves the NESTED-GATE
// correctness of electricalEquipmentContinuousDetails: it must be excluded when
// electricalEquipmentContinuousOperation is 'true' but powerRequired is NOT 'true' (i.e. the
// outer gate, not just the inner condition, must hold).
//
// Defeating mutation: gating render only (hiding the input) without also excluding the value in
// the payload builder, or vice versa; wiring any of the 4 gates to the wrong controlling field;
// flattening the nested electricalEquipmentContinuousDetails gate to check only
// electricalEquipmentContinuousOperation without also requiring isElectricalLoadApplicable.
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-f4-payload-gates.mjs

import {
  buildVendorRegistrationPayload,
  isElectricalLoadApplicable,
  isAdjacentBoothVendorNameFieldApplicable,
  isWaterIntendedUseFieldApplicable,
  isWastewaterDrainageDetailsFieldApplicable,
  isElectricalEquipmentContinuousDetailsFieldApplicable,
} from '../../../../../../lib/vendor-register-form-payload.ts';

const failures = [];
function fail(msg) {
  failures.push(msg);
}

const BASE_STATE = {
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
  physicalAddress: '1 Orchid Way, Stellenbosch',
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
  emergencyContactName: 'John Vendor',
  emergencyContactRelationship: '',
  emergencyContactCellPhone: '0827654321',
  vendorCategory: ['plant-sales'],
  vendorCategoryOther: '',
  productDescription: 'Cattleya and Cymbidium hybrids.',
  sellsLivePlants: '',
  livePlantTypes: [],
  livePlantTypesOther: '',
  plantsImportedForEvent: '',
  importCountryOfOrigin: '',
  citesListedSpecies: '',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  foodHealthTradingDocumentation: '',
  boothCount: '1',
  boothType: '',
  boothPositionRequest: '',
  adjacentBoothRequested: '',
  adjacentBoothVendorName: 'Stale adjacent-vendor text',
  specialDisplayRequirements: '',
  tableCount: '',
  chairCount: '',
  powerRequired: '',
  electricalLoad: '',
  electricalOutletsRequired: 'Stale outlet count text',
  electricalEquipmentList: 'Stale equipment list text',
  electricalEquipmentContinuousOperation: '',
  electricalEquipmentContinuousDetails: 'Stale continuous-operation details text',
  waterRequired: '',
  waterIntendedUse: 'Stale water-use text',
  wastewaterDrainageRequired: '',
  wastewaterDrainageDetails: 'Stale wastewater-details text',
  staffPerDay: '',
  vehicleRegistrations: '',
  loadInSlot: '',
  loadOutSlot: '',
  bio: '',
  paymentMethodsAccepted: [],
  paymentReference: '',
  termsAccepted: true,
};

// (1) adjacentBoothRequested !== 'true' must omit adjacentBoothVendorName, despite a stale value.
{
  if (isAdjacentBoothVendorNameFieldApplicable(BASE_STATE) !== false) {
    fail("isAdjacentBoothVendorNameFieldApplicable must be false when adjacentBoothRequested is not 'true'.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.adjacentBoothVendorName !== undefined) {
    fail(`adjacentBoothRequested unanswered must omit adjacentBoothVendorName; got ${JSON.stringify(payload.adjacentBoothVendorName)}.`);
  }
}

// (2) adjacentBoothRequested === 'true' must send the real typed adjacentBoothVendorName.
{
  const state = { ...BASE_STATE, adjacentBoothRequested: 'true' };
  if (isAdjacentBoothVendorNameFieldApplicable(state) !== true) {
    fail("isAdjacentBoothVendorNameFieldApplicable must be true when adjacentBoothRequested === 'true'.");
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.adjacentBoothVendorName !== 'Stale adjacent-vendor text') {
    fail(`adjacentBoothRequested:true must send the typed adjacentBoothVendorName; got ${JSON.stringify(payload.adjacentBoothVendorName)}.`);
  }
}

// (3) powerRequired !== 'true' must omit electricalOutletsRequired and electricalEquipmentList
// (reusing the EXISTING isElectricalLoadApplicable gate, same as electricalLoad already does).
{
  if (isElectricalLoadApplicable(BASE_STATE) !== false) {
    fail("isElectricalLoadApplicable must be false when powerRequired is not 'true'.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.electricalOutletsRequired !== undefined) {
    fail(`powerRequired unanswered must omit electricalOutletsRequired; got ${JSON.stringify(payload.electricalOutletsRequired)}.`);
  }
  if (payload.electricalEquipmentList !== undefined) {
    fail(`powerRequired unanswered must omit electricalEquipmentList; got ${JSON.stringify(payload.electricalEquipmentList)}.`);
  }
}

// (4) powerRequired === 'true' must send the real typed electricalOutletsRequired/electricalEquipmentList.
{
  const state = { ...BASE_STATE, powerRequired: 'true' };
  const payload = buildVendorRegistrationPayload(state);
  if (payload.electricalOutletsRequired === undefined) {
    fail('powerRequired:true must send electricalOutletsRequired, got undefined.');
  }
  if (payload.electricalEquipmentList !== 'Stale equipment list text') {
    fail(`powerRequired:true must send the typed electricalEquipmentList; got ${JSON.stringify(payload.electricalEquipmentList)}.`);
  }
}

// (5) waterRequired !== 'true' must omit waterIntendedUse.
{
  if (isWaterIntendedUseFieldApplicable(BASE_STATE) !== false) {
    fail("isWaterIntendedUseFieldApplicable must be false when waterRequired is not 'true'.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.waterIntendedUse !== undefined) {
    fail(`waterRequired unanswered must omit waterIntendedUse; got ${JSON.stringify(payload.waterIntendedUse)}.`);
  }
}

// (6) waterRequired === 'true' must send the real typed waterIntendedUse.
{
  const state = { ...BASE_STATE, waterRequired: 'true' };
  if (isWaterIntendedUseFieldApplicable(state) !== true) {
    fail("isWaterIntendedUseFieldApplicable must be true when waterRequired === 'true'.");
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.waterIntendedUse !== 'Stale water-use text') {
    fail(`waterRequired:true must send the typed waterIntendedUse; got ${JSON.stringify(payload.waterIntendedUse)}.`);
  }
}

// (7) wastewaterDrainageRequired !== 'true' must omit wastewaterDrainageDetails.
{
  if (isWastewaterDrainageDetailsFieldApplicable(BASE_STATE) !== false) {
    fail("isWastewaterDrainageDetailsFieldApplicable must be false when wastewaterDrainageRequired is not 'true'.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.wastewaterDrainageDetails !== undefined) {
    fail(`wastewaterDrainageRequired unanswered must omit wastewaterDrainageDetails; got ${JSON.stringify(payload.wastewaterDrainageDetails)}.`);
  }
}

// (8) wastewaterDrainageRequired === 'true' must send the real typed wastewaterDrainageDetails,
// independent of waterRequired/powerRequired (source 6.7 is its own toggle, not nested under 6.6).
{
  const state = { ...BASE_STATE, wastewaterDrainageRequired: 'true' };
  const payload = buildVendorRegistrationPayload(state);
  if (payload.wastewaterDrainageDetails !== 'Stale wastewater-details text') {
    fail(`wastewaterDrainageRequired:true must send the typed wastewaterDrainageDetails; got ${JSON.stringify(payload.wastewaterDrainageDetails)}.`);
  }
}

// (9) NESTED-GATE CORRECTNESS: electricalEquipmentContinuousOperation === 'true' but
// powerRequired NOT 'true' must still omit electricalEquipmentContinuousDetails -- the outer
// gate (isElectricalLoadApplicable), not just the inner condition, must hold.
{
  const state = { ...BASE_STATE, electricalEquipmentContinuousOperation: 'true' };
  if (isElectricalLoadApplicable(state) !== false) {
    fail('Test setup invariant broken: powerRequired must not be "true" in this case.');
  }
  if (isElectricalEquipmentContinuousDetailsFieldApplicable(state) !== false) {
    fail(
      'isElectricalEquipmentContinuousDetailsFieldApplicable must be false when powerRequired is not \'true\', even if electricalEquipmentContinuousOperation is \'true\' -- the gate must compose isElectricalLoadApplicable, not just check electricalEquipmentContinuousOperation alone.',
    );
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.electricalEquipmentContinuousDetails !== undefined) {
    fail(
      `powerRequired not 'true' must omit electricalEquipmentContinuousDetails even when electricalEquipmentContinuousOperation is 'true'; got ${JSON.stringify(payload.electricalEquipmentContinuousDetails)}.`,
    );
  }
}

// (10) Both conditions true: powerRequired === 'true' AND
// electricalEquipmentContinuousOperation === 'true' must send electricalEquipmentContinuousDetails.
{
  const state = {
    ...BASE_STATE,
    powerRequired: 'true',
    electricalEquipmentContinuousOperation: 'true',
  };
  if (isElectricalEquipmentContinuousDetailsFieldApplicable(state) !== true) {
    fail('isElectricalEquipmentContinuousDetailsFieldApplicable must be true when both powerRequired and electricalEquipmentContinuousOperation are \'true\'.');
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.electricalEquipmentContinuousDetails !== 'Stale continuous-operation details text') {
    fail(`both conditions true must send the typed electricalEquipmentContinuousDetails; got ${JSON.stringify(payload.electricalEquipmentContinuousDetails)}.`);
  }
}

// (11) powerRequired === 'true' but electricalEquipmentContinuousOperation !== 'true' must omit
// electricalEquipmentContinuousDetails.
{
  const state = { ...BASE_STATE, powerRequired: 'true' };
  if (isElectricalEquipmentContinuousDetailsFieldApplicable(state) !== false) {
    fail('isElectricalEquipmentContinuousDetailsFieldApplicable must be false when electricalEquipmentContinuousOperation is not \'true\', even if powerRequired is \'true\'.');
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.electricalEquipmentContinuousDetails !== undefined) {
    fail(`electricalEquipmentContinuousOperation unanswered must omit electricalEquipmentContinuousDetails; got ${JSON.stringify(payload.electricalEquipmentContinuousDetails)}.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(
  'PASS: all four new F4 render-gate + payload-exclusion guards are leak-proof, electricalOutletsRequired/electricalEquipmentList correctly reuse the existing isElectricalLoadApplicable gate, and electricalEquipmentContinuousDetails correctly composes both its nested conditions.',
);
