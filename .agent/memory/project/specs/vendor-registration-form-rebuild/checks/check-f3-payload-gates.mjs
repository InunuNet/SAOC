#!/usr/bin/env node
// F3 (vendor-registration-form-rebuild) — real calls to buildVendorRegistrationPayload() prove
// the five new leak-proof render-gate + payload-exclusion guards (mirroring
// isElectricalLoadApplicable/isFoodRetailer/isTradingNameFieldApplicable's existing shape and
// naming convention exactly) actually exclude their dependent field's value from the wire
// payload when the controlling boolean/checkbox says "no" / "not selected", even when the
// dependent field still holds a stale typed value, and include it otherwise:
//
//   - isVendorCategoryOtherFieldApplicable(state)   => state.vendorCategory.includes('other')
//   - isLivePlantTypesFieldApplicable(state)        => state.sellsLivePlants === 'true'
//   - isLivePlantTypesOtherFieldApplicable(state)   => state.livePlantTypes.includes('other')
//   - isImportCountryOfOriginFieldApplicable(state) => state.plantsImportedForEvent === 'true'
//   - isCitesPermitNumberFieldApplicable(state)     => state.citesListedSpecies === 'true'
//
// Also proves the existing isFoodRetailer() gate now additionally covers the new
// foodHealthTradingDocumentation field (source 3.9 sits inside the Food Retailers block,
// alongside the already-food-gated foodHandlingCertificateNumber/foodItemList).
//
// Defeating mutation: gating render only (hiding the input) without also excluding the value in
// the payload builder, or vice versa; wiring any of the 5 gates to the wrong controlling field.
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-f3-payload-gates.mjs

import {
  buildVendorRegistrationPayload,
  isVendorCategoryOtherFieldApplicable,
  isLivePlantTypesFieldApplicable,
  isLivePlantTypesOtherFieldApplicable,
  isImportCountryOfOriginFieldApplicable,
  isCitesPermitNumberFieldApplicable,
  isFoodRetailer,
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
  vendorCategoryOther: 'Stale other-category text',
  productDescription: 'Cattleya and Cymbidium hybrids.',
  sellsLivePlants: '',
  livePlantTypes: [],
  livePlantTypesOther: 'Stale live-plant-other text',
  plantsImportedForEvent: '',
  importCountryOfOrigin: 'Stale country text',
  citesListedSpecies: '',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: 'Stale CITES permit text',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  foodHealthTradingDocumentation: 'Stale food/health/trading text',
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
};

// (1) vendorCategory NOT including 'other' must omit vendorCategoryOther, despite a stale value.
{
  if (isVendorCategoryOtherFieldApplicable(BASE_STATE) !== false) {
    fail("isVendorCategoryOtherFieldApplicable must be false when vendorCategory doesn't include 'other'.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.vendorCategoryOther !== undefined) {
    fail(`vendorCategory without 'other' must omit vendorCategoryOther; got ${JSON.stringify(payload.vendorCategoryOther)}.`);
  }
}

// (2) vendorCategory including 'other' must send the real typed vendorCategoryOther.
{
  const state = { ...BASE_STATE, vendorCategory: ['plant-sales', 'other'] };
  if (isVendorCategoryOtherFieldApplicable(state) !== true) {
    fail("isVendorCategoryOtherFieldApplicable must be true when vendorCategory includes 'other'.");
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.vendorCategoryOther !== 'Stale other-category text') {
    fail(`vendorCategory including 'other' must send the typed vendorCategoryOther; got ${JSON.stringify(payload.vendorCategoryOther)}.`);
  }
}

// (3) sellsLivePlants !== 'true' must omit livePlantTypes and livePlantTypesOther.
{
  if (isLivePlantTypesFieldApplicable(BASE_STATE) !== false) {
    fail("isLivePlantTypesFieldApplicable must be false when sellsLivePlants is not 'true'.");
  }
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, livePlantTypes: ['orchids', 'other'] });
  if (payload.livePlantTypes !== undefined) {
    fail(`sellsLivePlants unanswered must omit livePlantTypes; got ${JSON.stringify(payload.livePlantTypes)}.`);
  }
  if (payload.livePlantTypesOther !== undefined) {
    fail(`sellsLivePlants unanswered must omit livePlantTypesOther; got ${JSON.stringify(payload.livePlantTypesOther)}.`);
  }
}

// (4) sellsLivePlants === 'true' but livePlantTypes does not include 'other' must send
// livePlantTypes but omit livePlantTypesOther.
{
  const state = { ...BASE_STATE, sellsLivePlants: 'true', livePlantTypes: ['orchids', 'seeds'] };
  if (isLivePlantTypesFieldApplicable(state) !== true) {
    fail("isLivePlantTypesFieldApplicable must be true when sellsLivePlants === 'true'.");
  }
  if (isLivePlantTypesOtherFieldApplicable(state) !== false) {
    fail("isLivePlantTypesOtherFieldApplicable must be false when livePlantTypes doesn't include 'other'.");
  }
  const payload = buildVendorRegistrationPayload(state);
  if (!Array.isArray(payload.livePlantTypes) || payload.livePlantTypes.length !== 2) {
    fail(`sellsLivePlants:true must send livePlantTypes; got ${JSON.stringify(payload.livePlantTypes)}.`);
  }
  if (payload.livePlantTypesOther !== undefined) {
    fail(`livePlantTypes without 'other' must omit livePlantTypesOther; got ${JSON.stringify(payload.livePlantTypesOther)}.`);
  }
}

// (5) sellsLivePlants === 'true' and livePlantTypes includes 'other' must send both.
{
  const state = {
    ...BASE_STATE,
    sellsLivePlants: 'true',
    livePlantTypes: ['orchids', 'other'],
  };
  if (isLivePlantTypesOtherFieldApplicable(state) !== true) {
    fail("isLivePlantTypesOtherFieldApplicable must be true when livePlantTypes includes 'other'.");
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.livePlantTypesOther !== 'Stale live-plant-other text') {
    fail(`livePlantTypes including 'other' must send the typed livePlantTypesOther; got ${JSON.stringify(payload.livePlantTypesOther)}.`);
  }
}

// (6) plantsImportedForEvent !== 'true' must omit importCountryOfOrigin.
{
  if (isImportCountryOfOriginFieldApplicable(BASE_STATE) !== false) {
    fail("isImportCountryOfOriginFieldApplicable must be false when plantsImportedForEvent is not 'true'.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.importCountryOfOrigin !== undefined) {
    fail(`plantsImportedForEvent unanswered must omit importCountryOfOrigin; got ${JSON.stringify(payload.importCountryOfOrigin)}.`);
  }
}

// (7) plantsImportedForEvent === 'true' must send the real typed importCountryOfOrigin.
{
  const state = { ...BASE_STATE, plantsImportedForEvent: 'true' };
  if (isImportCountryOfOriginFieldApplicable(state) !== true) {
    fail("isImportCountryOfOriginFieldApplicable must be true when plantsImportedForEvent === 'true'.");
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.importCountryOfOrigin !== 'Stale country text') {
    fail(`plantsImportedForEvent:true must send the typed importCountryOfOrigin; got ${JSON.stringify(payload.importCountryOfOrigin)}.`);
  }
}

// (8) citesListedSpecies !== 'true' must omit citesPermitNumber, despite a stale typed value.
{
  if (isCitesPermitNumberFieldApplicable(BASE_STATE) !== false) {
    fail("isCitesPermitNumberFieldApplicable must be false when citesListedSpecies is not 'true'.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.citesPermitNumber !== undefined) {
    fail(`citesListedSpecies unanswered must omit citesPermitNumber; got ${JSON.stringify(payload.citesPermitNumber)}.`);
  }
}

// (9) citesListedSpecies === 'true' must send the real typed citesPermitNumber.
{
  const state = { ...BASE_STATE, citesListedSpecies: 'true' };
  if (isCitesPermitNumberFieldApplicable(state) !== true) {
    fail("isCitesPermitNumberFieldApplicable must be true when citesListedSpecies === 'true'.");
  }
  const payload = buildVendorRegistrationPayload(state);
  if (payload.citesPermitNumber !== 'Stale CITES permit text') {
    fail(`citesListedSpecies:true must send the typed citesPermitNumber; got ${JSON.stringify(payload.citesPermitNumber)}.`);
  }
}

// (10) foodHealthTradingDocumentation is gated by the EXISTING isFoodRetailer(), same as
// foodHandlingCertificateNumber/foodItemList -- not by any new gate.
{
  if (isFoodRetailer(BASE_STATE) !== false) {
    fail("isFoodRetailer must be false when vendorCategory is ['plant-sales'] only.");
  }
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  if (payload.foodHealthTradingDocumentation !== undefined) {
    fail(`non-food-retailer vendorCategory must omit foodHealthTradingDocumentation; got ${JSON.stringify(payload.foodHealthTradingDocumentation)}.`);
  }

  const foodState = { ...BASE_STATE, vendorCategory: ['food-retailer'] };
  if (isFoodRetailer(foodState) !== true) {
    fail("isFoodRetailer must be true when vendorCategory includes 'food-retailer'.");
  }
  const foodPayload = buildVendorRegistrationPayload(foodState);
  if (foodPayload.foodHealthTradingDocumentation !== 'Stale food/health/trading text') {
    fail(`food-retailer vendorCategory must send the typed foodHealthTradingDocumentation; got ${JSON.stringify(foodPayload.foodHealthTradingDocumentation)}.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(
  'PASS: all five new F3 render-gate + payload-exclusion guards, plus foodHealthTradingDocumentation reusing the existing isFoodRetailer() gate, are leak-proof.',
);
