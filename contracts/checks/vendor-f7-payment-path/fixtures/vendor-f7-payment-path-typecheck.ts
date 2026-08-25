// F7 (vendor-registration) — compiler-driven (not source-grep) proof of the exported shapes
// lib/vendor-payment.ts must add, plus types/index.ts's new VendorSubmission payment fields.
// Run via its own scoped tsconfig (see that file's header) because the root tsconfig.json
// excludes `contracts/` from `pnpm type-check`.
//
// Run as: npx tsc --noEmit -p contracts/checks/vendor-f7-payment-path/tsconfig.typecheck.json

import {
  planProofOfPaymentUpload,
  decideVendorPaymentUpdate,
  PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES,
  PROOF_OF_PAYMENT_MAX_BYTES,
  type ProofOfPaymentUploadInput,
  type ProofOfPaymentUploadResult,
  type VendorPaymentUpdateInput,
  type VendorPaymentDecision,
  type VendorPaymentPatch,
} from '../../../../lib/vendor-payment';
import {
  decideProofOfPaymentRateLimit,
  PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS,
  PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS,
} from '../../../../lib/vendor-payment-rate-limit';
import {
  handleProofOfPaymentUpload,
  type ProofOfPaymentHandlerInput,
  type ProofOfPaymentHandlerDeps,
  type ProofOfPaymentHandlerResult,
} from '../../../../lib/vendor-proof-of-payment-handler';
import type { VendorSubmission } from '../../../../types/index';

// (1) The allowed-mime-types constant and byte-limit constant type-check as real values.
const allowedMimeTypes: readonly string[] = PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES;
const maxBytes: number = PROOF_OF_PAYMENT_MAX_BYTES;
void allowedMimeTypes;
void maxBytes;

// (2) A fully-typed upload input, no `any`; both narrowed arms of the discriminated-union
// result compile.
const uploadInput: ProofOfPaymentUploadInput = {
  submissionId: 'sub-1',
  fileName: 'proof.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
};
const uploadResult: ProofOfPaymentUploadResult = planProofOfPaymentUpload(uploadInput);
if (uploadResult.ok) {
  const storagePath: string = uploadResult.plan.storagePath;
  void storagePath;
} else {
  const error: string = uploadResult.error;
  void error;
}

// (3) A fully-typed payment-update input, no `any`; both narrowed arms compile.
const paymentInput: VendorPaymentUpdateInput = {
  currentStatus: 'approved',
  boothNumber: 'A12',
  paymentReceived: true,
  confirmedBy: 'manager@example.com',
  now: new Date('2027-01-01T00:00:00Z'),
  allocatedBoothNumbers: ['B03'],
};
const paymentDecision: VendorPaymentDecision = decideVendorPaymentUpdate(paymentInput);
if (paymentDecision.ok) {
  const patch: VendorPaymentPatch = paymentDecision.patch;
  const boothNumber: string | null = patch.boothNumber;
  const paymentReceived: boolean = patch.paymentReceived;
  const paymentConfirmedBy: string = patch.paymentConfirmedBy;
  const paymentConfirmedAt: Date = patch.paymentConfirmedAt;
  void boothNumber;
  void paymentReceived;
  void paymentConfirmedBy;
  void paymentConfirmedAt;
} else {
  const error: string = paymentDecision.error;
  void error;
}

// (4) types/index.ts's new, additive-only VendorSubmission payment fields — optional,
// nullable, never replacing an existing field.
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
  proofOfPaymentPath: 'vendor-proofs/sub-1/proof-of-payment.pdf',
  proofOfPaymentUploadedAt: new Date('2027-01-05T00:00:00Z'),
  boothNumber: 'A12',
  paymentReceived: true,
  paymentConfirmedBy: 'manager@example.com',
  paymentConfirmedAt: new Date('2027-01-06T00:00:00Z'),
};
void submission;

// (5) The rate-limit wrapper's constants and function type-check as real values.
const maxRateAttempts: number = PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS;
const rateWindowMs: number = PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS;
const rateDecision = decideProofOfPaymentRateLimit('vendor-proof-of-payment-ip:203.0.113.1', new Date(), []);
const rateAllowed: boolean = rateDecision.allowed;
void maxRateAttempts;
void rateWindowMs;
void rateAllowed;

// (6) The handler's fully-injectable deps shape and discriminated-union result compile.
const handlerDeps: ProofOfPaymentHandlerDeps = {
  now: new Date('2027-01-01T00:00:00Z'),
  rateLimitKey: 'vendor-proof-of-payment-ip:203.0.113.1',
  getPriorAttempts: () => [],
  recordAttempt: () => {},
  submissionExists: async () => true,
  uploadFile: async () => {},
  updateSubmission: async () => {},
};
const handlerInput: ProofOfPaymentHandlerInput = {
  submissionId: 'sub-1',
  fileName: 'proof.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  fileBase64: 'ZmFrZQ==',
};
const handlerResult: ProofOfPaymentHandlerResult = await handleProofOfPaymentUpload(handlerInput, handlerDeps);
const handlerStatus: number = handlerResult.status;
void handlerStatus;
