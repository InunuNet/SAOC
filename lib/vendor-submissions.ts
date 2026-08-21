/**
 * `vendorSubmissions/{id}` document shape — 2027 SAOC National Show vendor registration.
 * See contracts/golden/vendor-f4-submissions-model/README.md for the field-by-field
 * verification against the source form and every judgement call recorded here.
 *
 * Pure, side-effect-free construction module — no Firebase Admin SDK, no Firestore read or
 * write, no network. Mirrors the pattern established by lib/buyers.ts (ticketing-f5-buyers).
 * Time is always injected via a `now` argument, never read from Date.now() inside these
 * builders.
 *
 * ZERO authorization meaning: nothing in this module grants a capability, admin surface
 * access, or role based on a vendorSubmissions document or its status. Do not import
 * lib/admin-auth.ts or lib/admin-roles.ts here.
 */

import type {
  VendorBoothType,
  VendorCategory,
  VendorPaymentMethod,
  VendorSubmission,
} from '@/types/index';

export const VENDOR_SUBMISSIONS_COLLECTION = 'vendorSubmissions';

const VENDOR_CATEGORIES: readonly VendorCategory[] = [
  'plant-sales',
  'product-sales',
  'rare-exotic-plants',
  'food-retailer',
  'hardware',
  'books',
  'art',
  'other',
];

const VENDOR_BOOTH_TYPES: readonly VendorBoothType[] = ['standard', 'corner', 'end-of-row'];

const VENDOR_PAYMENT_METHODS: readonly VendorPaymentMethod[] = [
  'cash',
  'card',
  'eft',
  'not-applicable',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Caller-supplied subset of VendorSubmission — id/status/submittedAt are structurally
// absent, not merely optional, so a caller cannot smuggle a self-approved status or a
// backdated submittedAt through the type system (see A5/the golden README).
export type VendorSubmissionDraft = Omit<VendorSubmission, 'id' | 'status' | 'submittedAt'>;

/**
 * Fail-fast validation of a raw, untyped payload (an HTTP request body arrives as
 * `unknown` regardless of what a TypeScript signature elsewhere claims). Collects every
 * violation instead of returning on the first — never sanitizes or reformats a value, only
 * accepts or rejects it as-is.
 */
export function validateVendorSubmissionInput(input: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['input must be an object'] };
  }
  const record = input as Record<string, unknown>;

  requireNonEmptyString(record, 'businessName', errors);
  requireNonEmptyString(record, 'contactPersonName', errors);
  requireNonEmptyString(record, 'contactCellPhone', errors);
  requireNonEmptyString(record, 'contactEmail', errors);
  requireNonEmptyString(record, 'productDescription', errors);

  if (
    typeof record.contactEmail === 'string' &&
    record.contactEmail.length > 0 &&
    !EMAIL_PATTERN.test(record.contactEmail)
  ) {
    errors.push('contactEmail must be a valid email address');
  }

  validateVendorCategory(record.vendorCategory, errors);
  validateBoothType(record.boothType, errors);
  validatePaymentMethodsAccepted(record.paymentMethodsAccepted, errors);

  validatePositiveInteger(record.boothCount, 'boothCount', errors);
  validateOptionalNonNegativeInteger(record.tableCount, 'tableCount', errors);
  validateOptionalNonNegativeInteger(record.chairCount, 'chairCount', errors);
  validateOptionalNonNegativeInteger(record.staffPerDay, 'staffPerDay', errors);

  if (typeof record.powerRequired !== 'boolean') {
    errors.push('powerRequired is required and must be a boolean');
  }

  if (record.termsAccepted !== true) {
    errors.push('termsAccepted must be true');
  }

  return { valid: errors.length === 0, errors };
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
): void {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${field} is required and must be a non-empty string`);
  }
}

function validateVendorCategory(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('vendorCategory is required and must be a non-empty array');
    return;
  }
  const invalid = value.filter((entry) => !VENDOR_CATEGORIES.includes(entry as VendorCategory));
  if (invalid.length > 0) {
    errors.push(`vendorCategory contains invalid value(s): ${invalid.join(', ')}`);
  }
}

function validateBoothType(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!VENDOR_BOOTH_TYPES.includes(value as VendorBoothType)) {
    errors.push(`boothType is invalid: ${String(value)}`);
  }
}

function validatePaymentMethodsAccepted(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push('paymentMethodsAccepted must be an array');
    return;
  }
  const invalid = value.filter(
    (entry) => !VENDOR_PAYMENT_METHODS.includes(entry as VendorPaymentMethod),
  );
  if (invalid.length > 0) {
    errors.push(`paymentMethodsAccepted contains invalid value(s): ${invalid.join(', ')}`);
  }
}

function validatePositiveInteger(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    errors.push(`${field} is required and must be a positive integer`);
  }
}

function validateOptionalNonNegativeInteger(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    errors.push(`${field} must be a non-negative integer`);
  }
}

/**
 * Builds a `vendorSubmissions/{id}` document (minus the Firestore-assigned `id`). Copies
 * each of the 31 form fields explicitly, field by field — never a `{ ...input }` spread —
 * so that status/submittedAt/id can never survive from a raw, type-system-bypassing input
 * (e.g. a POST body cast through `as any`). `status` is always forced to 'submitted' and
 * `submittedAt` to the injected `now`, regardless of anything present on `input`: a public,
 * unauthenticated submitter must never be able to self-approve or backdate a submission.
 */
export function buildVendorSubmission(
  input: VendorSubmissionDraft,
  now: Date,
): Omit<VendorSubmission, 'id'> {
  return {
    businessName: input.businessName,
    tradingName: input.tradingName,
    contactPersonName: input.contactPersonName,
    contactCellPhone: input.contactCellPhone,
    contactEmail: input.contactEmail,
    physicalAddress: input.physicalAddress,
    cipcNumber: input.cipcNumber,
    vatNumber: input.vatNumber,
    website: input.website,
    socialMediaHandle: input.socialMediaHandle,
    vendorCategory: input.vendorCategory,
    productDescription: input.productDescription,
    phytosanitaryPermitNumber: input.phytosanitaryPermitNumber,
    citesPermitNumber: input.citesPermitNumber,
    foodHandlingCertificateNumber: input.foodHandlingCertificateNumber,
    foodItemList: input.foodItemList,
    boothCount: input.boothCount,
    boothType: input.boothType,
    tableCount: input.tableCount,
    chairCount: input.chairCount,
    powerRequired: input.powerRequired,
    electricalLoad: input.electricalLoad,
    waterRequired: input.waterRequired,
    staffPerDay: input.staffPerDay,
    vehicleRegistrations: input.vehicleRegistrations,
    loadInSlot: input.loadInSlot,
    loadOutSlot: input.loadOutSlot,
    bio: input.bio,
    paymentMethodsAccepted: input.paymentMethodsAccepted,
    paymentReference: input.paymentReference,
    termsAccepted: input.termsAccepted,
    // Always system-set — never read from `input`, see the function doc comment above.
    status: 'submitted',
    submittedAt: now,
  };
}
