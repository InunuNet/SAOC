// F21 (vendor-gated-registration-flow, M2) — A38: the two fixture VendorSubmission-shaped
// documents backing the additive-only/deprecate-in-place regression proof described in the M2
// golden README's "F21: the regression proof, not just the promise". One fixture simulates a
// document written before M2 shipped (every F15-deprecated field populated, every F14 field
// absent); the other simulates a fresh post-M2 submission (every F14 field populated, every
// deprecated field absent). Both must satisfy the real `VendorSubmission` type AND render
// through the real admin review UI without throwing — see check-admin-page-renders-both-
// fixtures.mjs, which imports these two exports at runtime via tsx.
//
// Shared by two consumers: (1) tsc, via ../tsconfig.typecheck.json, as a second compiler-driven
// proof alongside f14-new-fields-typecheck.ts; (2) the runtime render check, which imports the
// exported consts directly (tsx strips types at runtime, so this file's own type errors do not
// block that import — the tsc step is what enforces the shape; the compound A38 command runs
// tsc first specifically so a shape drift is always caught before the render step could pass
// vacuously against a malformed fixture).
//
// Run standalone (type-check only) as:
//   npx tsc --noEmit -p contracts/checks/vendor-gated-registration-flow-m2/tsconfig.typecheck.json

import type { VendorSubmission } from '../../../../types/index';

// Every field required by VendorSubmission, common to both fixtures — kept identical between
// the two so the ONLY variable under test is the deprecated-vs-new field set, not incidental
// differences in the required fields.
const REQUIRED_BASE = {
  id: 'admin-fixture-shared',
  businessName: 'Cape Orchid Traders',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@example.com',
  physicalAddress: '123 Orchid Lane, Cape Town',
  emergencyContactName: 'John Vendor',
  emergencyContactCellPhone: '0837654321',
  vendorCategory: ['orchids'] as VendorSubmission['vendorCategory'],
  productDescription: 'Assorted cymbidium and cattleya orchids.',
  boothCount: 1,
  powerRequired: false,
  termsAccepted: true,
  status: 'submitted' as VendorSubmission['status'],
  submittedAt: new Date('2027-01-05T12:00:00Z'),
};

// (1) Pre-M2 fixture: simulates a document written before M2 shipped. Every field in
// contracts/golden/vendor-gated-registration-flow-m2/removed-field-ledger.expected.md is
// populated; every F14 field this mission adds is absent (never set — not even `undefined`,
// matching how a real pre-M2 Firestore document would arrive, with the key missing entirely).
export const preM2Fixture: VendorSubmission = {
  ...REQUIRED_BASE,
  id: 'admin-fixture-pre-m2',
  boothCount: 2,
  electricalLoad: '15A / 3.5kW',
  electricalEquipmentList: 'Fridge, urn',
  electricalEquipmentContinuousOperation: true,
  electricalEquipmentContinuousDetails: 'Fridge runs 24/7',
  gasEquipmentType: 'Gas burner',
  gasFuelType: 'LPG',
  gasCylinderSize: '9kg',
  gasCylinderCount: 2,
  vehicleType: 'suv-bakkie',
  vehicleTypeOther: '',
  vehicleRegistrations: 'CA123456',
  vehicleHeight: '2.1m',
  vehicleLength: '5.5m',
  trailerAttached: false,
  socialMediaHandle: '@capeorchidtraders',
  sellsLivePlants: true,
  livePlantTypes: ['orchids'],
  livePlantTypesOther: '',
  plantsImportedForEvent: false,
  importCountryOfOrigin: '',
  foodPreparationOnSite: false,
  foodCookingOnSite: false,
  vendorCategoryOther: '',
};

// (2) Post-M2 fixture: simulates a fresh submission after M2 ships. Every F14 field is
// populated; every deprecated-in-place field is absent (never set — proves a brand-new
// submission genuinely never touches the deprecated fields, not just that it is allowed not
// to).
export const postM2Fixture: VendorSubmission = {
  ...REQUIRED_BASE,
  id: 'admin-fixture-post-m2',
  facebookHandle: 'capeorchidtraders',
  instagramHandle: '@capeorchidtraders',
  tiktokHandle: '@capeorchidtraders',
  youtubeHandle: 'CapeOrchidTraders',
  otherSocialMediaHandle: '',
  boothSize: 'double',
  carRegistrationNumber: '',
  suvBakkieRegistrationNumber: 'CA234567',
  panelVanRegistrationNumber: '',
  deliveryVanRegistrationNumber: '',
  truckRegistrationNumber: '',
  trailerRegistrationNumber: '',
  otherVehicleRegistrationNumber: '',
  electricalEquipmentEntries: [
    { equipment: 'Fridge', quantity: 1, wattage: '150W', runningTimePerDay: 'All day' },
  ],
  gasEquipmentEntries: [
    { equipmentType: 'Gas burner', gasType: 'LPG', cylinderSize: '9kg', cylinderCount: 2 },
  ],
  logoPath: 'vendor-marketing/admin-fixture-post-m2/logo.png',
  productPhoto1Path: 'vendor-marketing/admin-fixture-post-m2/product-1.jpg',
  productPhoto2Path: 'vendor-marketing/admin-fixture-post-m2/product-2.jpg',
  productPhoto3Path: 'vendor-marketing/admin-fixture-post-m2/product-3.jpg',
  marketingPermission: 'full',
  publicLiabilityInsurancePolicyNumber: 'PL-2027-001',
  productLiabilityInsurancePolicyNumber: 'PRL-2027-001',
  foodVendorCertifications: [],
  signatureFullName: 'Jane Vendor',
};
