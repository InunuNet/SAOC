// F1 (vendor-registration-form-rebuild) — compiler-driven (not source-grep) proof that
// types/index.ts's forty-five new optional VendorSubmission fields and five new closed unions
// (VendorBusinessEntityType, VendorLivePlantType, VendorVehicleType, VendorWasteType, plus
// productLiabilityInsuranceStatus's inline 3-member union) exist with the right shape, and
// that lib/vendor-submissions.ts's buildVendorSubmission()/validateVendorSubmissionInput()
// still compile against the widened VendorSubmissionDraft. Run via its own scoped tsconfig
// (the root tsconfig.json excludes non-source directories from `pnpm type-check`).
//
// Run as:
//   npx tsc --noEmit -p .agent/memory/project/specs/vendor-registration-form-rebuild/checks/tsconfig.typecheck.json

import type {
  VendorSubmission,
  VendorBusinessEntityType,
  VendorCategory,
  VendorLivePlantType,
  VendorVehicleType,
  VendorWasteType,
} from '../../../../../../../types/index';
import {
  buildVendorSubmission,
  validateVendorSubmissionInput,
  type VendorSubmissionDraft,
} from '../../../../../../../lib/vendor-submissions';

// --- Positive case 1, NARROWED POST-F2: the OLD 31-field minimal shape (F4's own golden
// minimal case) PLUS the 3 fields F2 (per its own contract-f2.yaml + golden) deliberately
// tightened from optional to required -- physicalAddress, emergencyContactName,
// emergencyContactCellPhone -- must still compile. This is the compile-time twin of
// check-new-fields-additive-and-validated.mjs's (a1)/(a2): F1's own documented "sequencing
// rule" (goldens/f1-data-model-foundation.md) means the bare pre-F2 shape no longer compiles
// (see the @ts-expect-error negative case below, the compile-time twin of that check's (a0));
// this positive case now proves nothing BEYOND F2's own 3-field tightening was ever made
// required. If this fails, some other field was mistakenly made newly required. ---
const oldMinimalBase = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  vendorCategory: ['plant-sales'] as VendorCategory[],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

const oldMinimal: VendorSubmissionDraft = {
  ...oldMinimalBase,
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactCellPhone: '0834445555',
};

// --- Negative case, NARROWED POST-F2 (compile-time twin of that check's (a0)): the bare
// pre-F2 shape (without the 3 fields F2 made required) must now be correctly REJECTED at
// compile time, not silently still valid. ---
// @ts-expect-error missing physicalAddress, emergencyContactName, emergencyContactCellPhone
// (F2 made these required)
const oldMinimalBareRejected: VendorSubmissionDraft = oldMinimalBase;
void oldMinimalBareRejected;

// --- Positive case 2: every new F1 field populated alongside the full existing 31-field
// shape. If this fails to compile, a field was mistakenly dropped, mistyped, or the source
// section's union member list doesn't match this contract's golden README. ---
const businessEntityType: VendorBusinessEntityType = 'close-corporation';
const livePlantType: VendorLivePlantType = 'orchids';
const vehicleType: VendorVehicleType = 'panel-van';
const wasteType: VendorWasteType = 'plant-material';

const fullWithNewFields: VendorSubmissionDraft = {
  businessName: 'Cape Orchid Nursery',
  tradingName: 'Cape Orchids',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  cipcNumber: '2020/123456/07',
  vatNumber: '4123456789',
  website: 'https://capeorchid.example',
  socialMediaHandle: '@capeorchidnursery',
  vendorCategory: ['plant-sales', 'rare-exotic-plants', 'other'],
  productDescription: 'Cattleya and Cymbidium hybrids, plus rare Asian species.',
  phytosanitaryPermitNumber: 'PHYTO-2027-001',
  citesPermitNumber: 'CITES-2027-002',
  boothCount: 2,
  boothType: 'corner',
  tableCount: 2,
  chairCount: 4,
  powerRequired: true,
  electricalLoad: '15A single phase',
  waterRequired: false,
  staffPerDay: 3,
  vehicleRegistrations: 'CA 123-456',
  loadInSlot: 'Friday 07:00-09:00',
  loadOutSlot: 'Sunday 17:00-19:00',
  bio: 'Cape Orchid Nursery has grown award-winning Cattleya hybrids since 1998.',
  paymentMethodsAccepted: ['card', 'eft'],
  paymentReference: 'EFT-REF-00123',
  termsAccepted: true,

  // --- Section 1 additions ---
  tradingNameSameAsBusiness: false,
  businessEntityType,
  businessEntityTypeOther: undefined,
  vatRegistered: true,
  countryOfBusinessRegistration: 'South Africa',
  postalAddressSameAsPhysical: true,
  postalAddress: '1 Orchid Way, Stellenbosch',
  contactPosition: 'Owner',
  alternativeContactNumber: '0219876543',
  accountsContactName: 'John Accounts',
  accountsContactEmail: 'accounts@capeorchid.example',

  // --- Section 2 (Emergency Contact) ---
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactRelationship: 'Business partner',
  emergencyContactCellPhone: '0834445555',

  // --- Section 3 additions ---
  sellsLivePlants: true,
  livePlantTypes: [livePlantType, 'seeds'],
  livePlantTypesOther: undefined,
  plantsImportedForEvent: true,
  importCountryOfOrigin: 'Thailand',
  citesListedSpecies: true,
  foodHealthTradingDocumentation: undefined,

  // --- Section 4 additions ---
  boothPositionRequest: 'Near the main entrance',
  adjacentBoothRequested: true,
  adjacentBoothVendorName: 'Orchid Supplies Co.',
  specialDisplayRequirements: 'Overhead hanging rail for baskets.',

  // --- Section 6 additions ---
  electricalOutletsRequired: 2,
  electricalEquipmentList: 'Misting fan (1x), fridge (1x)',
  electricalEquipmentContinuousOperation: true,
  electricalEquipmentContinuousDetails: 'Fridge runs continuously for cut-flower storage.',
  waterIntendedUse: 'Watering can refills',
  wastewaterDrainageRequired: false,
  wastewaterDrainageDetails: undefined,

  // --- Section 7 (Gas/Cooking/Heat) ---
  gasOrHeatEquipmentUsed: false,
  gasEquipmentType: undefined,
  gasFuelType: undefined,
  gasCylinderSize: undefined,
  gasCylinderCount: undefined,
  gasSafetyInformation: undefined,

  // --- Section 8 additions ---
  foodPreparationOnSite: false,
  foodCookingOnSite: false,

  // --- Section 9 additions ---
  staffCountSetupDay: 2,
  staffCountDay1: 3,
  staffCountDay2: 3,
  staffCountDay3: 3,
  staffCountBreakdownDay: 2,
  exhibitorPassesRequired: true,
  exhibitorPassesCount: 3,

  // --- Section 10 additions ---
  vehicleType,
  vehicleTypeOther: undefined,
  vehicleHeight: '2.1m',
  vehicleLength: '5.5m',
  trailerAttached: false,

  // --- Section 11 (Storage & Security) ---
  storageRiskAcknowledged: true,

  // --- Section 12 (Waste & Cleaning) ---
  wasteTypes: [wasteType, 'cardboard-packaging'],
  wasteTypesOther: undefined,
  specialWasteRequirements: undefined,

  // --- Section 15 (Insurance) ---
  hasPublicLiabilityInsurance: true,
  productLiabilityInsuranceStatus: 'not-applicable',
};

const builtOld: Omit<VendorSubmission, 'id'> = buildVendorSubmission(oldMinimal, new Date());
const builtFull: Omit<VendorSubmission, 'id'> = buildVendorSubmission(fullWithNewFields, new Date());

// --- Negative case: an invalid closed-union member must be rejected at compile time. ---
// @ts-expect-error 'zeppelin' is not a member of VendorVehicleType
const invalidVehicleType: VendorVehicleType = 'zeppelin';

// --- Negative case: productLiabilityInsuranceStatus must reject a value outside its 3-member
// union. ---
const badSubmission: VendorSubmissionDraft = {
  ...oldMinimal,
  // @ts-expect-error 'maybe' is not a member of the 3-value union
  productLiabilityInsuranceStatus: 'maybe',
};

void collectionUsageGuard(builtOld, builtFull, invalidVehicleType, badSubmission, businessEntityType);
void validateVendorSubmissionInput({});

function collectionUsageGuard(...args: unknown[]): void {
  void args;
}
