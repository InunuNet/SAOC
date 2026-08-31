// F3 (vendor-registration-form-rebuild) — compiler-driven (not source-grep) proof that
// types/index.ts's WIDENED (not renamed) 11-member VendorCategory union and the new
// vendorCategoryOther field exist with the right shape, that all 8 PRE-EXISTING VendorCategory
// literals ('plant-sales' | 'product-sales' | 'rare-exotic-plants' | 'food-retailer' |
// 'hardware' | 'books' | 'art' | 'other') still compile completely unmodified (the ripple-sweep
// property for this specific change), and that the 3 NEW members ('other-plant-sales' |
// 'fertilisers-growing-media' | 'pottery-ceramics') are now valid. Run via its own scoped
// tsconfig (the root tsconfig.json excludes non-source directories from `pnpm type-check`).
//
// Run as:
//   npx tsc --noEmit -p .agent/memory/project/specs/vendor-registration-form-rebuild/checks/tsconfig.f3.typecheck.json

import type { VendorSubmission, VendorCategory } from '../../../../../../../types/index';
import {
  buildVendorSubmission,
  validateVendorSubmissionInput,
  type VendorSubmissionDraft,
} from '../../../../../../../lib/vendor-submissions';

// --- Positive case 1: the exact OLD 8-member set, as a single array literal, must still
// compile without any cast trickery. This is the compile-time twin of
// check-f3-category-enum-widened-and-validated.mjs's old-value-preservation proof: if any of
// these 8 literals stopped compiling, the "correction" silently renamed or dropped a live value
// and the live public API would start rejecting real in-flight submissions the moment this
// feature deploys. ---
const allEightOldValues: VendorCategory[] = [
  'plant-sales',
  'product-sales',
  'rare-exotic-plants',
  'food-retailer',
  'hardware',
  'books',
  'art',
  'other',
];

// --- Positive case 2: the exact 3 NEW members must now compile. ---
const allThreeNewValues: VendorCategory[] = [
  'other-plant-sales',
  'fertilisers-growing-media',
  'pottery-ceramics',
];

// --- Negative case: the union must still be closed -- an 12th, invented member must be
// rejected, proving this is a genuine 11-member closed set, not a widened-to-string escape
// hatch. ---
// @ts-expect-error 'flowers' is not a member of the 11-member VendorCategory union
const badCategory: VendorCategory[] = ['flowers'];

// --- Positive case 3: the OLD 31-field minimal shape (F4's own golden minimal case, F1/F2's
// own narrowed positive case) plus F2's 3 now-required fields, still compiles completely
// unmodified by this feature -- vendorCategoryOther is a NEW optional field, never required. ---
const oldMinimal: VendorSubmissionDraft = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactCellPhone: '0834445555',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

// --- Positive case 4: a submission using ONLY the 3 new category members plus the new
// vendorCategoryOther field must compile. ---
const fullWithNewCategoryFields: VendorSubmissionDraft = {
  ...oldMinimal,
  vendorCategory: ['other-plant-sales', 'fertilisers-growing-media', 'pottery-ceramics', 'other'],
  vendorCategoryOther: 'Orchid-themed jewellery',
  foodHealthTradingDocumentation: 'Municipal food handling certificate #FH-2027-004',
};

const builtOld: Omit<VendorSubmission, 'id'> = buildVendorSubmission(oldMinimal, new Date());
const builtFull: Omit<VendorSubmission, 'id'> = buildVendorSubmission(
  fullWithNewCategoryFields,
  new Date(),
);

void collectionUsageGuard(allEightOldValues, allThreeNewValues, badCategory, builtOld, builtFull);
void validateVendorSubmissionInput({});

function collectionUsageGuard(...args: unknown[]): void {
  void args;
}
