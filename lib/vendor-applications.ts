/**
 * `vendorApplications/{id}` document shape -- the SHORT public application stage of the gated
 * vendor registration flow (mission vendor-gated-registration-flow, F1). See
 * contracts/golden/vendor-gated-registration-flow-f1/README.md for the full decision record,
 * including why this is a NEW, separate Firestore collection rather than a status spliced
 * into the existing vendorSubmissions/VendorSubmission model.
 *
 * Pure, side-effect-free construction module -- no Firebase Admin SDK, no Firestore read or
 * write, no network. Mirrors lib/vendor-submissions.ts's pattern exactly: time is always
 * injected via a `now` argument, never read from Date.now() inside these builders.
 *
 * ZERO authorization meaning: nothing in this module grants a capability, admin surface
 * access, or role based on a vendorApplications document or its status. Do not import
 * lib/admin-auth.ts or lib/admin-roles.ts here.
 */

import { stripUndefinedProperties } from './firestore-write-safety.ts';
import { EMAIL_PATTERN, PHONE_PATTERN } from '@/lib/vendor-submissions';
import type {
  VendorApplication,
  VendorApplicationCategory,
  VendorApplicationDraft,
} from '@/types/index';

export const VENDOR_APPLICATIONS_COLLECTION = 'vendorApplications';

// Golden-exact literal list -- see contracts/golden/vendor-gated-registration-flow-f1/
// vendor-application-categories.expected.ts.txt. Order matches the 26 Aug source doc's
// "VENDOR CATEGORY & PRODUCTS" section exactly. No 'other' member -- the source doc has none
// for this list.
const VENDOR_APPLICATION_CATEGORIES: readonly VendorApplicationCategory[] = [
  'orchids',
  'cites-listed-plants',
  'indoor-plants',
  'succulents',
  'rare-plants',
  'exotic-plants',
  'indigenous-plants',
  'orchid-growing-supplies',
  'greenhouse-hardware-infrastructure',
  'fertilisers-growing-media',
  'books-publications',
  'art',
  'ceramics',
  'food-beverage-retailer',
];

export { VENDOR_APPLICATION_CATEGORIES };

// Mirrors lib/vendor-submissions.ts's FIELD_MAX_LENGTHS table -- same maxLength values the
// golden README specifies for businessName/tradingName/contactPersonName, and the same
// EMAIL_PATTERN/PHONE_PATTERN-scoped lengths (254/30) for contactEmail/contactCellPhone.
const FIELD_MAX_LENGTHS = {
  businessName: 200,
  tradingName: 200,
  contactPersonName: 150,
  contactEmail: 254,
  contactCellPhone: 30,
} as const;

/**
 * Fail-fast validation of a raw, untyped payload (an HTTP request body arrives as `unknown`
 * regardless of what a TypeScript signature elsewhere claims). Collects every violation
 * instead of returning on the first -- never sanitizes or reformats a value, only accepts or
 * rejects it as-is. Mirrors validateVendorSubmissionInput's shape exactly.
 */
export function validateVendorApplicationInput(input: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['input must be an object'] };
  }
  const record = input as Record<string, unknown>;

  requireNonEmptyString(record, 'businessName', errors, FIELD_MAX_LENGTHS.businessName);
  requireNonEmptyString(record, 'contactPersonName', errors, FIELD_MAX_LENGTHS.contactPersonName);
  requireNonEmptyString(record, 'contactEmail', errors, FIELD_MAX_LENGTHS.contactEmail);
  requireNonEmptyString(record, 'contactCellPhone', errors, FIELD_MAX_LENGTHS.contactCellPhone);

  if (
    typeof record.contactEmail === 'string' &&
    record.contactEmail.length > 0 &&
    !EMAIL_PATTERN.test(record.contactEmail)
  ) {
    errors.push('contactEmail must be a valid email address');
  }

  if (
    typeof record.contactCellPhone === 'string' &&
    record.contactCellPhone.length > 0 &&
    !PHONE_PATTERN.test(record.contactCellPhone)
  ) {
    errors.push('contactCellPhone must be a valid phone number');
  }

  validateOptionalStringMaxLength(record, 'tradingName', errors, FIELD_MAX_LENGTHS.tradingName);
  validateVendorApplicationCategory(record.vendorCategory, errors);
  validatePositiveInteger(record.indicativeBoothCount, 'indicativeBoothCount', errors);

  return { valid: errors.length === 0, errors };
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
  maxLength: number,
): void {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${field} is required and must be a non-empty string`);
    return;
  }
  if (value.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters`);
  }
}

function validateOptionalStringMaxLength(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
  maxLength: number,
): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`);
    return;
  }
  if (value.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters`);
  }
}

function validateVendorApplicationCategory(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('vendorCategory is required and must be a non-empty array');
    return;
  }
  const invalid = value.filter(
    (entry) => !VENDOR_APPLICATION_CATEGORIES.includes(entry as VendorApplicationCategory),
  );
  if (invalid.length > 0) {
    errors.push(`vendorCategory contains invalid value(s): ${invalid.join(', ')}`);
  }
}

function validatePositiveInteger(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    errors.push(`${field} is required and must be a positive integer`);
  }
}

/**
 * Builds a `vendorApplications/{id}` document (minus the Firestore-assigned `id`). Copies each
 * field explicitly, field by field -- never a `{ ...input }` spread -- so that status/
 * submittedAt/id can never survive from a raw, type-system-bypassing input. `status` is always
 * forced to 'pending' and `submittedAt` to the injected `now`, regardless of anything present
 * on `input`: a public, unauthenticated submitter must never be able to self-approve or
 * backdate a submission.
 */
export function buildVendorApplication(
  input: VendorApplicationDraft,
  now: Date,
): Omit<VendorApplication, 'id'> {
  // Optional fields genuinely absent from `input` are copied above as own properties with
  // value `undefined` (by design -- see the field-by-field-copy rationale above). Stripped
  // here, at the builder boundary, before the object can reach a Firestore write call: the
  // Admin SDK throws synchronously on an `undefined` own-property value. See
  // lib/firestore-write-safety.ts and contracts/golden/firestore-undefined-write-safety/
  // README.md.
  return stripUndefinedProperties({
    businessName: input.businessName,
    tradingName: input.tradingName,
    contactPersonName: input.contactPersonName,
    contactEmail: input.contactEmail,
    contactCellPhone: input.contactCellPhone,
    vendorCategory: input.vendorCategory,
    indicativeBoothCount: input.indicativeBoothCount,

    // Always system-set -- never read from `input`, see the function doc comment above.
    status: 'pending',
    submittedAt: now,
  });
}
