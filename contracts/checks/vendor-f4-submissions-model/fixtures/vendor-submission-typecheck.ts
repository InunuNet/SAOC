// F4 (vendor-registration) — compiler-driven (not source-grep) proof of the exported type
// shapes types/index.ts and lib/vendor-submissions.ts must add: VendorSubmission's nine
// required fields are genuinely non-optional, and its four closed unions
// (VendorCategory, VendorBoothType, VendorPaymentMethod, VendorSubmissionStatus) are
// genuinely closed, not widened to `string`. Run via its own scoped tsconfig (see that
// file's header) because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Run as: npx tsc --noEmit -p contracts/checks/vendor-f4-submissions-model/tsconfig.typecheck.json

import type {
  VendorSubmission,
  VendorCategory,
  VendorBoothType,
  VendorPaymentMethod,
  VendorSubmissionStatus,
} from '../../../../types/index';
import {
  VENDOR_SUBMISSIONS_COLLECTION,
  buildVendorSubmission,
  validateVendorSubmissionInput,
  type VendorSubmissionDraft,
} from '../../../../lib/vendor-submissions';

const collectionName: 'vendorSubmissions' = VENDOR_SUBMISSIONS_COLLECTION;

// --- Positive case 1: a minimal submission carrying only the required fields. ---
// If this fails to compile, a required field was mistakenly typed as required when the
// source form marks it optional (over-strict). physicalAddress/emergencyContactName/
// emergencyContactCellPhone joined the required set in F2 (vendor-registration-form-rebuild);
// see contract-f2.yaml's deploy-safety sequencing rule.
const minimal: VendorSubmissionDraft = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
  emergencyContactName: 'John Vendor',
  emergencyContactCellPhone: '0827654321',
};

// --- Positive case 2: every one of the 31 fields populated, plus all four closed unions
// exercised with a real value each. If this fails to compile, a field was mistakenly
// dropped or mistyped when it should be present and optional. ---
const full: VendorSubmissionDraft = {
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
  foodHandlingCertificateNumber: undefined,
  foodItemList: undefined,
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
  emergencyContactName: 'John Vendor',
  emergencyContactRelationship: 'Spouse',
  emergencyContactCellPhone: '0827654321',
};

const builtMinimal: Omit<VendorSubmission, 'id'> = buildVendorSubmission(minimal, new Date());
const builtFull: Omit<VendorSubmission, 'id'> = buildVendorSubmission(full, new Date());

const validation: { valid: boolean; errors: string[] } = validateVendorSubmissionInput(minimal);

// --- Negative cases: each MUST fail to compile, or this file fails the tsc run. ---

// (a) Omitting a required field (businessName) must not compile.
// @ts-expect-error — businessName is required; omitting it must not type-check.
const missingBusinessName: VendorSubmissionDraft = {
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

// (b) Omitting termsAccepted must not compile.
// @ts-expect-error — termsAccepted is required; omitting it must not type-check.
const missingTermsAccepted: VendorSubmissionDraft = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
};

// (c) A vendorCategory value outside the closed union must not compile.
// @ts-expect-error — 'flowers' is not a member of VendorCategory.
const badCategory: VendorCategory[] = ['flowers'];

// (d) A boothType value outside the closed union must not compile.
// @ts-expect-error — 'vip' is not a member of VendorBoothType.
const badBoothType: VendorBoothType = 'vip';

// (e) A paymentMethodsAccepted value outside the closed union must not compile.
// @ts-expect-error — 'crypto' is not a member of VendorPaymentMethod.
const badPaymentMethod: VendorPaymentMethod[] = ['crypto'];

// (f) A VendorSubmissionStatus value outside the closed union must not compile.
// @ts-expect-error — 'draft' is not a member of VendorSubmissionStatus.
const badStatus: VendorSubmissionStatus = 'draft';

// (g) A caller must not be able to smuggle status/submittedAt/id through VendorSubmissionDraft
// — they are structurally absent from the type, not merely optional.
// @ts-expect-error — status is not a key of VendorSubmissionDraft.
const draftWithStatus: VendorSubmissionDraft = { ...minimal, status: 'approved' };

export {
  collectionName,
  minimal,
  full,
  builtMinimal,
  builtFull,
  validation,
  missingBusinessName,
  missingTermsAccepted,
  badCategory,
  badBoothType,
  badPaymentMethod,
  badStatus,
  draftWithStatus,
};
