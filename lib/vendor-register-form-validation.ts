import type { VendorRegisterFormState } from '@/lib/vendor-register-form-payload';

const STRICT_INTEGER_PATTERN = /^\d+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?=.*[0-9])[0-9+\-() ]{7,20}$/;

/**
 * Pure client-side pre-submit validator. Mirrors validateVendorSubmissionInput()'s error
 * vocabulary (lib/vendor-submissions.ts) byte-for-byte, so the existing humaniseFieldError()
 * mapping (lib/vendor-register-response.ts) keeps working unmodified against these messages
 * too. Returns an empty array when the form is submittable.
 *
 * Never uses Number.parseInt to decide validity -- Number.parseInt('1.5', 10) and
 * Number.parseInt('1e3', 10) both resolve to 1, which is the root cause of Brad's "submit did
 * nothing" live-testing report (2026-08-18): malformed booth counts were silently accepted.
 * A strict whole-number regex against the raw string is used instead.
 */
export function validateVendorRegisterFormClientSide(state: VendorRegisterFormState): string[] {
  const errors: string[] = [];

  if (state.businessName.trim() === '') {
    errors.push('businessName is required and must be a non-empty string');
  }
  if (state.contactPersonName.trim() === '') {
    errors.push('contactPersonName is required and must be a non-empty string');
  }
  if (state.physicalAddress.trim() === '') {
    errors.push('physicalAddress is required and must be a non-empty string');
  }
  const contactCellPhone = state.contactCellPhone.trim();
  if (contactCellPhone === '') {
    errors.push('contactCellPhone is required and must be a non-empty string');
  } else if (!PHONE_PATTERN.test(contactCellPhone)) {
    errors.push('contactCellPhone must be a valid phone number');
  }
  const contactEmail = state.contactEmail.trim();
  if (contactEmail === '') {
    errors.push('contactEmail is required and must be a non-empty string');
  } else if (!EMAIL_PATTERN.test(contactEmail)) {
    errors.push('contactEmail must be a valid email address');
  }
  const alternativeContactNumber = state.alternativeContactNumber.trim();
  if (alternativeContactNumber !== '' && !PHONE_PATTERN.test(alternativeContactNumber)) {
    errors.push('alternativeContactNumber must be a valid phone number');
  }
  const accountsContactEmail = state.accountsContactEmail.trim();
  if (accountsContactEmail !== '' && !EMAIL_PATTERN.test(accountsContactEmail)) {
    errors.push('accountsContactEmail must be a valid email address');
  }
  const emergencyContactName = state.emergencyContactName.trim();
  if (emergencyContactName === '') {
    errors.push('emergencyContactName is required and must be a non-empty string');
  }
  const emergencyContactCellPhone = state.emergencyContactCellPhone.trim();
  if (emergencyContactCellPhone === '') {
    errors.push('emergencyContactCellPhone is required and must be a non-empty string');
  } else if (!PHONE_PATTERN.test(emergencyContactCellPhone)) {
    errors.push('emergencyContactCellPhone must be a valid phone number');
  }
  if (state.productDescription.trim() === '') {
    errors.push('productDescription is required and must be a non-empty string');
  }
  if (state.vendorCategory.length === 0) {
    errors.push('vendorCategory is required and must be a non-empty array');
  }

  // M2 F14/F17 (vendor-gated-registration-flow) -- boothSize replaces the deprecated-in-place
  // free-numeric boothCount above; it is a fixed 3-value radio (single/double/triple), not an
  // integer, so no STRICT_INTEGER_PATTERN check applies here any more.
  if (state.boothSize.trim() === '') {
    errors.push('boothSize is required and must be a non-empty string');
  }

  const tableCount = state.tableCount.trim();
  if (tableCount !== '' && !STRICT_INTEGER_PATTERN.test(tableCount)) {
    errors.push('tableCount must be a non-negative integer');
  }

  const chairCount = state.chairCount.trim();
  if (chairCount !== '' && !STRICT_INTEGER_PATTERN.test(chairCount)) {
    errors.push('chairCount must be a non-negative integer');
  }

  const staffPerDay = state.staffPerDay.trim();
  if (staffPerDay !== '' && !STRICT_INTEGER_PATTERN.test(staffPerDay)) {
    errors.push('staffPerDay must be a non-negative integer');
  }

  if (state.powerRequired === '') {
    errors.push('powerRequired is required and must be a boolean');
  }

  if (state.termsAccepted !== true) {
    errors.push('termsAccepted must be true');
  }

  return errors;
}
