// F6 (vendor-registration) — compiler-driven (not source-grep) proof of the exported shapes
// lib/vendor-review.ts must add, plus types/index.ts's new VendorSubmission fields. Run via
// its own scoped tsconfig (see that file's header) because the root tsconfig.json excludes
// `contracts/` from `pnpm type-check`.
//
// Run as: npx tsc --noEmit -p contracts/checks/vendor-f6-review-workflow/tsconfig.typecheck.json

import {
  decideVendorStatusTransition,
  type VendorReviewAction,
  type VendorReviewDecision,
  type VendorReviewDecisionInput,
  type VendorReviewPatch,
} from '../../../../lib/vendor-review';
import { CAPABILITIES, type Capability } from '../../../../lib/admin-roles';
import type { VendorSubmission, VendorSubmissionStatus } from '../../../../types/index';

// (1) The new capability type-checks as a real member of the fixed union.
const newCapability: Capability = 'review-vendor-applications';
const capabilityList: readonly string[] = CAPABILITIES;
if (!capabilityList.includes(newCapability)) {
  throw new Error('unreachable — type-level check only');
}

// (2) VendorReviewAction is the closed 3-member action union.
const actions: VendorReviewAction[] = ['start-review', 'approve', 'reject'];
void actions;

// (3) A fully-typed decision input, no `any`.
const input: VendorReviewDecisionInput = {
  currentStatus: 'submitted',
  action: 'start-review',
  reviewerEmail: 'manager@example.com',
  now: new Date('2027-01-01T00:00:00Z'),
};

// (4) The real function, both narrowed arms of its discriminated-union result compile.
const decision: VendorReviewDecision = decideVendorStatusTransition(input);
if (decision.ok) {
  const patch: VendorReviewPatch = decision.patch;
  const nextStatus: VendorSubmissionStatus = patch.status;
  const reviewedBy: string = patch.reviewedBy;
  const reviewedAt: Date = patch.reviewedAt;
  void nextStatus;
  void reviewedBy;
  void reviewedAt;
} else {
  const error: string = decision.error;
  void error;
}

// (5) types/index.ts's new, additive-only VendorSubmission fields — optional, nullable,
// never replacing an existing field.
const submission: VendorSubmission = {
  id: 'sub-1',
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '4 Kloof Street, Cape Town, 8001',
  emergencyContactName: 'Peter Vendor',
  emergencyContactCellPhone: '0837654321',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
  status: 'approved',
  submittedAt: new Date('2027-01-01T00:00:00Z'),
  reviewedBy: 'manager@example.com',
  reviewedAt: new Date('2027-01-02T00:00:00Z'),
};
void submission;
