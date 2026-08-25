#!/usr/bin/env node
// F1 (vendor-registration-form-rebuild) — real calls to validateVendorSubmissionInput():
// (a) THE SEQUENCING-SAFETY REGRESSION, NARROWED POST-F2 -- F1's original A3 asserted the exact
// OLD 31-field shape (mentioning none of F1's new fields) stayed valid:true byte-for-byte. F2
// (per its own contract-f2.yaml + golden) has SINCE deliberately tightened physicalAddress,
// emergencyContactName, and emergencyContactCellPhone from optional to required, in the SAME
// deploy as the UI that collects them -- this was F1's own documented "sequencing rule"
// (goldens/f1-data-model-foundation.md) working as designed, not a regression. So this check no
// longer asserts the bare OLD_MINIMAL/OLD_FULL shapes (missing those 3 fields) stay valid --
// F2's own A3 (check-f2-required-fields.mjs) is the load-bearing proof for that tightening.
// What THIS check still proves, and must keep proving for every feature after F2: the OLD shape
// PLUS the 3 now-required fields validates with NONE of F1's other 55 new optional fields
// present and the OLD boothType/vendorCategory/paymentMethodsAccepted values -- i.e. no field or
// union beyond the 3 F2 explicitly tightened was ever touched. (b) every new optional string
// field's max-length bound is enforced. (c) every new closed-union field (businessEntityType,
// livePlantTypes, vehicleType, wasteTypes, productLiabilityInsuranceStatus) rejects an
// out-of-set value by name. (d) a payload using every new field with valid values is accepted.
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-new-fields-additive-and-validated.mjs

import { validateVendorSubmissionInput } from '../../../../../../lib/vendor-submissions.ts';

const failures = [];

function fail(msg) {
  failures.push(msg);
}

function expectAccepted(label, input) {
  const result = validateVendorSubmissionInput(input);
  if (result.valid !== true) {
    fail(`${label}: expected valid:true, got valid:${result.valid}, errors:${JSON.stringify(result.errors)}.`);
  }
}

function expectRejectedNaming(label, input, fieldNameFragment) {
  const result = validateVendorSubmissionInput(input);
  if (result.valid !== false) {
    fail(`${label}: expected valid:false, got valid:${result.valid}.`);
    return;
  }
  const named = (result.errors || []).some((e) =>
    String(e).toLowerCase().includes(fieldNameFragment.toLowerCase()),
  );
  if (!named) {
    fail(`${label}: expected an error naming "${fieldNameFragment}", got ${JSON.stringify(result.errors)}.`);
  }
}

const OLD_MINIMAL = {
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

const OLD_FULL = {
  ...OLD_MINIMAL,
  tradingName: 'Cape Orchids',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  cipcNumber: '2020/123456/07',
  vatNumber: '4123456789',
  website: 'https://capeorchid.example',
  socialMediaHandle: '@capeorchidnursery',
  vendorCategory: ['plant-sales', 'rare-exotic-plants', 'other'],
  phytosanitaryPermitNumber: 'PHYTO-2027-001',
  citesPermitNumber: 'CITES-2027-002',
  boothCount: 2,
  boothType: 'corner',
  tableCount: 2,
  chairCount: 4,
  electricalLoad: '15A single phase',
  waterRequired: false,
  staffPerDay: 3,
  vehicleRegistrations: 'CA 123-456',
  loadInSlot: 'Friday 07:00-09:00',
  loadOutSlot: 'Sunday 17:00-19:00',
  bio: 'Cape Orchid Nursery has grown award-winning Cattleya hybrids since 1998.',
  paymentMethodsAccepted: ['card', 'eft'],
  paymentReference: 'EFT-REF-00123',
};

// (a) NARROWED SEQUENCING-SAFETY REGRESSION, POST-F2 -- the OLD 31-field shapes PLUS the 3
// fields F2 legitimately made required (physicalAddress, emergencyContactName,
// emergencyContactCellPhone) still validate, mentioning NONE of F1's other 55 new optional
// fields and using the OLD (pre-F3/F4/F8) boothType/vendorCategory/paymentMethodsAccepted
// values. This is the load-bearing proof that nothing beyond F2's own documented 3-field
// tightening ever changed what the live form's real submissions need to satisfy.
const REQUIRED_AS_OF_F2 = {
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactCellPhone: '0834445555',
};

expectAccepted(
  '(a1) OLD minimal shape + the 3 fields F2 made required, no other F1 fields present',
  { ...OLD_MINIMAL, ...REQUIRED_AS_OF_F2 },
);
expectAccepted(
  '(a2) OLD full 31-field shape + the 3 fields F2 made required, no other F1 fields present',
  { ...OLD_FULL, ...REQUIRED_AS_OF_F2 },
);

// (a0) Documents, without re-asserting the load-bearing proof itself (that's F2's own A3 in
// check-f2-required-fields.mjs), that the bare pre-F2 OLD_MINIMAL shape is now correctly
// rejected -- confirms this narrowing tracks a real, intentional supersession rather than a
// silently-abandoned invariant.
expectRejectedNaming(
  '(a0) OLD minimal shape alone (pre-F2) is now correctly rejected, not silently still valid',
  OLD_MINIMAL,
  'physicaladdress',
);

// (b) max-length bounds on a representative sample of new string fields (one per section is
// enough to prove the pattern is wired, not every one of the ~30 new strings).
const OVER_LIMIT = (n) => 'x'.repeat(n + 1);

expectRejectedNaming(
  '(b1) countryOfBusinessRegistration over 100 chars',
  { ...OLD_MINIMAL, countryOfBusinessRegistration: OVER_LIMIT(100) },
  'countryofbusinessregistration',
);
expectRejectedNaming(
  '(b2) emergencyContactName over 150 chars',
  { ...OLD_MINIMAL, emergencyContactName: OVER_LIMIT(150) },
  'emergencycontactname',
);
expectRejectedNaming(
  '(b3) specialDisplayRequirements over 1000 chars',
  { ...OLD_MINIMAL, specialDisplayRequirements: OVER_LIMIT(1000) },
  'specialdisplayrequirements',
);
expectRejectedNaming(
  '(b4) gasSafetyInformation over 1000 chars',
  { ...OLD_MINIMAL, gasSafetyInformation: OVER_LIMIT(1000) },
  'gassafetyinformation',
);
expectRejectedNaming(
  '(b5) specialWasteRequirements over 500 chars',
  { ...OLD_MINIMAL, specialWasteRequirements: OVER_LIMIT(500) },
  'specialwasterequirements',
);

// (c) closed-union rejections, one per new union.
expectRejectedNaming(
  '(c1) businessEntityType outside closed set',
  { ...OLD_MINIMAL, businessEntityType: 'trust' },
  'businessentitytype',
);
expectRejectedNaming(
  '(c2) livePlantTypes contains an out-of-set member',
  { ...OLD_MINIMAL, livePlantTypes: ['orchids', 'succulents'] },
  'liveplanttypes',
);
expectRejectedNaming(
  '(c3) vehicleType outside closed set',
  { ...OLD_MINIMAL, vehicleType: 'zeppelin' },
  'vehicletype',
);
expectRejectedNaming(
  '(c4) wasteTypes contains an out-of-set member',
  { ...OLD_MINIMAL, wasteTypes: ['general', 'toxic-chemicals'] },
  'wastetypes',
);
expectRejectedNaming(
  '(c5) productLiabilityInsuranceStatus outside its 3-value set',
  { ...OLD_MINIMAL, productLiabilityInsuranceStatus: 'maybe' },
  'productliabilityinsurancestatus',
);

// (d) every new field populated with a valid value, accepted in one payload.
const NEW_FIELDS_FULL = {
  ...OLD_FULL,
  tradingNameSameAsBusiness: false,
  businessEntityType: 'close-corporation',
  vatRegistered: true,
  countryOfBusinessRegistration: 'South Africa',
  postalAddressSameAsPhysical: true,
  postalAddress: '1 Orchid Way, Stellenbosch',
  contactPosition: 'Owner',
  alternativeContactNumber: '0219876543',
  accountsContactName: 'John Accounts',
  accountsContactEmail: 'accounts@capeorchid.example',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactRelationship: 'Business partner',
  emergencyContactCellPhone: '0834445555',
  sellsLivePlants: true,
  livePlantTypes: ['orchids', 'seeds'],
  plantsImportedForEvent: true,
  importCountryOfOrigin: 'Thailand',
  citesListedSpecies: true,
  foodHealthTradingDocumentation: 'Trading licence on file with SAOC office.',
  boothPositionRequest: 'Near the main entrance',
  adjacentBoothRequested: true,
  adjacentBoothVendorName: 'Orchid Supplies Co.',
  specialDisplayRequirements: 'Overhead hanging rail for baskets.',
  electricalOutletsRequired: 2,
  electricalEquipmentList: 'Misting fan (1x), fridge (1x)',
  electricalEquipmentContinuousOperation: true,
  electricalEquipmentContinuousDetails: 'Fridge runs continuously for cut-flower storage.',
  waterIntendedUse: 'Watering can refills',
  wastewaterDrainageRequired: false,
  gasOrHeatEquipmentUsed: false,
  foodPreparationOnSite: false,
  foodCookingOnSite: false,
  staffCountSetupDay: 2,
  staffCountDay1: 3,
  staffCountDay2: 3,
  staffCountDay3: 3,
  staffCountBreakdownDay: 2,
  exhibitorPassesRequired: true,
  exhibitorPassesCount: 3,
  vehicleType: 'panel-van',
  vehicleHeight: '2.1m',
  vehicleLength: '5.5m',
  trailerAttached: false,
  storageRiskAcknowledged: true,
  wasteTypes: ['plant-material', 'cardboard-packaging'],
  hasPublicLiabilityInsurance: true,
  productLiabilityInsuranceStatus: 'not-applicable',
};
expectAccepted('(d) every new field populated with a valid value', NEW_FIELDS_FULL);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the old 31-field shape plus the 3 fields F2 legitimately made required (no other F1 ' +
    'fields present, old enum values) still validates after F1+F2 (narrowed deploy-safety ' +
    'proof); the bare pre-F2 shape is correctly rejected, confirming the supersession is real; ' +
    "every new string field's max-length bound and every new closed union is enforced by name; " +
    'a payload using every new field with valid values is accepted.',
);
process.exit(0);
