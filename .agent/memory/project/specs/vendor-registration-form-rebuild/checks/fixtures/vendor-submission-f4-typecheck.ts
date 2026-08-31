// F4 (vendor-registration-form-rebuild) — compiler-driven (not source-grep) proof that
// types/index.ts's RENAMED (not widened) 4-member VendorBoothType union
// ('standard-in-row' | 'corner' | 'end-of-row' | 'no-preference') exists with the right shape,
// that the 2 UNRENAMED literals ('corner', 'end-of-row') still compile completely unmodified,
// that the 2 NEW/renamed-target literals ('standard-in-row', 'no-preference') are now valid,
// and that the OLD literal ('standard') is REJECTED (the compile-time twin of
// check-f4-boothtype-renamed-and-validated.mjs's runtime proof (c) -- this is what makes this a
// rename, not F3-style widening). Run via its own scoped tsconfig (the root tsconfig.json
// excludes non-source directories from `pnpm type-check`).
//
// Run as:
//   npx tsc --noEmit -p .agent/memory/project/specs/vendor-registration-form-rebuild/checks/tsconfig.f4.typecheck.json

import type { VendorSubmission, VendorBoothType, VendorCategory } from '../../../../../../../types/index';
import {
  buildVendorSubmission,
  validateVendorSubmissionInput,
  type VendorSubmissionDraft,
} from '../../../../../../../lib/vendor-submissions';

// --- Positive case 1: the 2 UNRENAMED literals, as a single array literal, must still compile
// without any cast trickery. If either failed to compile, this feature accidentally touched a
// value it wasn't supposed to. ---
const twoUnrenamedValues: VendorBoothType[] = ['corner', 'end-of-row'];

// --- Positive case 2: the 2 NEW/renamed-target literals must now compile. ---
const twoNewValues: VendorBoothType[] = ['standard-in-row', 'no-preference'];

// --- Negative case: the OLD literal 'standard' must be REJECTED at compile time -- the
// deliberate breaking-change proof. If this stops erroring, the rename regressed into a
// non-breaking widening that kept 'standard' alive alongside the new values. ---
// @ts-expect-error 'standard' is no longer a member of VendorBoothType -- it was renamed to
// 'standard-in-row' by this feature, not kept alongside it.
const oldValueRejected: VendorBoothType = 'standard';

// --- Negative case: a genuinely invented member must still be rejected (defeats widening the
// union to `string`). ---
// @ts-expect-error 'vip' is not a member of VendorBoothType
const invalidValueRejected: VendorBoothType = 'vip';

const minimal: VendorSubmissionDraft = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactCellPhone: '0834445555',
  vendorCategory: ['plant-sales'] as VendorCategory[],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

// --- Positive case 3: a full Section 4/6 payload using the renamed 'standard-in-row' value
// plus every one of F1's ten already-staged Section 4/6 fields must compile. ---
const fullSection4And6: VendorSubmissionDraft = {
  ...minimal,
  boothType: 'standard-in-row',
  boothPositionRequest: 'Near the main entrance',
  adjacentBoothRequested: true,
  adjacentBoothVendorName: 'Orchid Supplies Co.',
  specialDisplayRequirements: 'Overhead hanging rail for baskets.',
  electricalOutletsRequired: 2,
  electricalEquipmentList: 'Misting fan (1x), fridge (1x)',
  electricalEquipmentContinuousOperation: true,
  electricalEquipmentContinuousDetails: 'Fridge runs continuously for cut-flower storage.',
  waterIntendedUse: 'Watering can refills',
  wastewaterDrainageRequired: true,
  wastewaterDrainageDetails: 'Small basin, emptied manually into venue drain point.',
};

// --- Positive case 4: 'no-preference' also compiles on its own, distinct payload. ---
const noPreferenceSubmission: VendorSubmissionDraft = {
  ...minimal,
  boothType: 'no-preference',
};

const builtMinimal: Omit<VendorSubmission, 'id'> = buildVendorSubmission(minimal, new Date());
const builtFull: Omit<VendorSubmission, 'id'> = buildVendorSubmission(fullSection4And6, new Date());
const builtNoPreference: Omit<VendorSubmission, 'id'> = buildVendorSubmission(
  noPreferenceSubmission,
  new Date(),
);

function collectionUsageGuard(
  ...values: Array<
    | VendorBoothType[]
    | VendorBoothType
    | Omit<VendorSubmission, 'id'>
    | VendorSubmissionDraft
  >
): void {
  void values;
}

void collectionUsageGuard(
  twoUnrenamedValues,
  twoNewValues,
  oldValueRejected,
  invalidValueRejected,
  builtMinimal,
  builtFull,
  builtNoPreference,
  fullSection4And6,
);
void validateVendorSubmissionInput({});
