// F14 (vendor-gated-registration-flow, M2) — A27: compiler-driven proof that every new field/
// type F14 introduces on VendorSubmission actually exists with the expected shape, mirroring
// vendor-f8-approval-email's fixture pattern (a real literal assigned to the real exported
// type, not a source-grep). Run via contracts/checks/vendor-gated-registration-flow-m2/
// tsconfig.typecheck.json because the root tsconfig.json excludes `contracts/` from
// `pnpm type-check`.
//
// This file is also the CANONICAL FIELD-NAME SPEC for F14 — @dev implements types/index.ts to
// match it, not the other way around (per the mission's "@dev implements against golden files
// only" rule; this fixture plus the M2 golden README are what @dev implements against for the
// exact shape of every new field). See the architect's dispatch report for which names are
// directly grounded in the M2 golden README/contract text (online-presence handles, the 7
// vehicle fields, the 3 product-photo fields + logoPath, the 2 insurance policy-number fields,
// foodVendorCertifications, signatureFullName) versus which are the architect's own naming
// derivation not spelled out anywhere else (electricalEquipmentEntries, gasEquipmentEntries,
// marketingPermission, and the VendorRegistrationBoothSize/VendorFoodCertification member
// literals) — flagged there for confirmation, not guessed silently.
//
// FAILS ON: any TypeScript error in this file (a missing field, wrong type, a deprecated
// field's type having actually changed, or a supporting type not exported).
//
// Run as: npx tsc --noEmit -p contracts/checks/vendor-gated-registration-flow-m2/tsconfig.typecheck.json

import type {
  VendorSubmission,
  VendorElectricalEquipmentEntry,
  VendorGasEquipmentEntry,
  VendorFoodCertification,
  VendorMarketingPermission,
  VendorRegistrationBoothSize,
} from '../../../../types/index';

// Every field F14-F20 add to VendorSubmission, isolated via Pick so this fixture does not need
// to also satisfy every pre-existing required field on the interface (A28's own check already
// proves the deprecated fields are untouched; this file exists only to prove the NEW surface).
type F14NewFields = Pick<
  VendorSubmission,
  | 'facebookHandle'
  | 'instagramHandle'
  | 'tiktokHandle'
  | 'youtubeHandle'
  | 'otherSocialMediaHandle'
  | 'boothSize'
  | 'carRegistrationNumber'
  | 'suvBakkieRegistrationNumber'
  | 'panelVanRegistrationNumber'
  | 'deliveryVanRegistrationNumber'
  | 'truckRegistrationNumber'
  | 'trailerRegistrationNumber'
  | 'otherVehicleRegistrationNumber'
  | 'electricalEquipmentEntries'
  | 'gasEquipmentEntries'
  | 'logoPath'
  | 'productPhoto1Path'
  | 'productPhoto2Path'
  | 'productPhoto3Path'
  | 'marketingPermission'
  | 'publicLiabilityInsurancePolicyNumber'
  | 'productLiabilityInsurancePolicyNumber'
  | 'foodVendorCertifications'
  | 'signatureFullName'
>;

// (1) Every field present, every value the real form can send.
const fullyPopulated: F14NewFields = {
  facebookHandle: 'saocnationalshow',
  instagramHandle: '@saocnationalshow',
  tiktokHandle: '@saocnationalshow',
  youtubeHandle: 'SAOCNationalShow',
  otherSocialMediaHandle: 'linkedin.com/company/saoc',
  boothSize: 'double',
  carRegistrationNumber: 'CA123456',
  suvBakkieRegistrationNumber: 'CA234567',
  panelVanRegistrationNumber: 'CA345678',
  deliveryVanRegistrationNumber: 'CA456789',
  truckRegistrationNumber: 'CA567890',
  trailerRegistrationNumber: 'CA678901',
  otherVehicleRegistrationNumber: 'CA789012',
  electricalEquipmentEntries: [
    { equipment: 'Fridge', quantity: 1, wattage: '150W', runningTimePerDay: 'All day' },
  ],
  gasEquipmentEntries: [
    { equipmentType: 'Gas burner', gasType: 'LPG', cylinderSize: '9kg', cylinderCount: 2 },
  ],
  logoPath: 'vendor-marketing/sub-1/logo.png',
  productPhoto1Path: 'vendor-marketing/sub-1/product-1.jpg',
  productPhoto2Path: 'vendor-marketing/sub-1/product-2.jpg',
  productPhoto3Path: 'vendor-marketing/sub-1/product-3.jpg',
  marketingPermission: 'full',
  publicLiabilityInsurancePolicyNumber: 'PL-2027-001',
  productLiabilityInsurancePolicyNumber: 'PRL-2027-001',
  foodVendorCertifications: ['mobile-coa', 'fire-safety-compliance'],
  signatureFullName: 'Jane Vendor',
};
void fullyPopulated;

// (2) Every field omitted — every one of these is optional, matching the source form (none of
// this section is asterisked as required in the 26 Aug doc).
const allOmitted: F14NewFields = {};
void allOmitted;

// (3) The two enum-shaped types' member sets — a real assignment, not a grep for the string.
const boothSizes: VendorRegistrationBoothSize[] = ['single', 'double', 'triple'];
void boothSizes;

const foodCertifications: VendorFoodCertification[] = [
  'mobile-coa',
  'perishable-foodstuff-licence',
  'hawker-informal-trading-permit',
  'mobile-gas-compliance-certificate',
  'fire-safety-compliance',
  'vehicle-fitness-certificate',
];
void foodCertifications;

const marketingPermissions: VendorMarketingPermission[] = ['full', 'listing-only'];
void marketingPermissions;

// (4) The two repeating-table entry types' shapes, referenced directly (not just through the
// Pick above) so a shape drift in either interface is caught even if the array field itself
// were accidentally typed as `unknown[]`.
const electricalEntry: VendorElectricalEquipmentEntry = {
  equipment: 'Fridge',
  quantity: 1,
  wattage: '150W',
  runningTimePerDay: 'All day',
};
void electricalEntry;

const gasEntry: VendorGasEquipmentEntry = {
  equipmentType: 'Gas burner',
  gasType: 'LPG',
  cylinderSize: '9kg',
  cylinderCount: 2,
};
void gasEntry;
