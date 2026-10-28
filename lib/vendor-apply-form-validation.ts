import { humaniseFieldError } from '@/lib/vendor-register-response';

const STRICT_INTEGER_PATTERN = /^\d+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?=.*[0-9])[0-9+\-() ]{7,20}$/;

// Mirrors FIELD_MAX_LENGTHS in lib/vendor-applications.ts (the server is the authority).
const MAX_LENGTHS = {
  businessName: 200,
  tradingName: 200,
  contactPersonName: 150,
  contactEmail: 254,
  contactCellPhone: 30,
} as const;

export interface VendorApplyFormValues {
  businessName: string;
  tradingName: string;
  contactPersonName: string;
  contactEmail: string;
  contactCellPhone: string;
  vendorCategory: string[];
  indicativeBoothCount: string;
}

/** Field keys in on-screen order, so the error summary lists problems top to bottom. */
export const VENDOR_APPLY_FIELD_ORDER = [
  'businessName',
  'tradingName',
  'contactPersonName',
  'contactEmail',
  'contactCellPhone',
  'vendorCategory',
  'indicativeBoothCount',
] as const;

export type VendorApplyFieldKey = (typeof VENDOR_APPLY_FIELD_ORDER)[number];

/**
 * Pure client-side pre-submit validator. Mirrors validateVendorApplicationInput()
 * (lib/vendor-applications.ts) rule for rule and in its error vocabulary, so
 * humaniseFieldError() keeps working unmodified against these messages. Returns an empty array
 * when the form is submittable.
 *
 * The stand count is validated against the raw string with a strict whole-number regex, never
 * Number.parseInt: parseInt('1.5', 10) and parseInt('1e3', 10) both resolve to 1, which would
 * silently accept a malformed count (see lib/vendor-register-form-validation.ts).
 */
export function validateVendorApplyFormClientSide(state: VendorApplyFormValues): string[] {
  const errors: string[] = [];

  requireText(state.businessName, 'businessName', MAX_LENGTHS.businessName, errors);
  requireText(state.contactPersonName, 'contactPersonName', MAX_LENGTHS.contactPersonName, errors);

  const contactEmail = state.contactEmail.trim();
  if (requireText(contactEmail, 'contactEmail', MAX_LENGTHS.contactEmail, errors)) {
    if (!EMAIL_PATTERN.test(contactEmail)) {
      errors.push('contactEmail must be a valid email address');
    }
  }

  const contactCellPhone = state.contactCellPhone.trim();
  if (requireText(contactCellPhone, 'contactCellPhone', MAX_LENGTHS.contactCellPhone, errors)) {
    if (!PHONE_PATTERN.test(contactCellPhone)) {
      errors.push('contactCellPhone must be a valid phone number');
    }
  }

  if (state.tradingName.length > MAX_LENGTHS.tradingName) {
    errors.push(`tradingName must be at most ${MAX_LENGTHS.tradingName} characters`);
  }

  if (state.vendorCategory.length === 0) {
    errors.push('vendorCategory is required and must be a non-empty array');
  }

  const stands = state.indicativeBoothCount.trim();
  if (!STRICT_INTEGER_PATTERN.test(stands) || !Number.isSafeInteger(Number(stands)) || Number(stands) <= 0) {
    errors.push('indicativeBoothCount is required and must be a positive integer');
  }

  return errors;
}

/** Returns true when the value is present and within the length limit (no error pushed). */
function requireText(value: string, field: string, maxLength: number, errors: string[]): boolean {
  if (value.trim() === '') {
    errors.push(`${field} is required and must be a non-empty string`);
    return false;
  }
  if (value.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters`);
    return false;
  }
  return true;
}

// Labels as shown on the /apply form (components/vendors/VendorApplyForm.tsx).
const VENDOR_APPLY_FIELD_LABELS: Record<VendorApplyFieldKey, string> = {
  businessName: 'Business name',
  tradingName: 'Trading name',
  contactPersonName: 'Contact person name',
  contactEmail: 'Contact email',
  contactCellPhone: 'Contact cell phone',
  vendorCategory: 'Vendor category & products',
  indicativeBoothCount: 'Indicative number of stands',
};

const VENDOR_APPLY_GENERIC_ERROR = 'Please check the highlighted fields.';

/**
 * Turns one raw server-side validation message (e.g. "businessName is required and must be a
 * non-empty string") into a label sentence for the apply form. An unknown leading key falls
 * back to the generic instruction, so a camelCase key or schema wording never reaches a vendor.
 */
export function humaniseVendorApplyError(raw: string): string {
  const key = VENDOR_APPLY_FIELD_ORDER.find((candidate) => raw.startsWith(`${candidate} `));
  if (!key) {
    return VENDOR_APPLY_GENERIC_ERROR;
  }
  const label = VENDOR_APPLY_FIELD_LABELS[key];
  return raw.includes('is required') ? `${label} is required.` : `${label} is invalid.`;
}

/**
 * Groups raw validator messages into one humanised sentence per field (first message wins),
 * ordered as the fields appear on screen. Reuses humaniseFieldError() for every sentence.
 */
export function vendorApplyErrorsByField(
  rawErrors: readonly string[],
): Array<{ key: VendorApplyFieldKey; message: string }> {
  const grouped: Array<{ key: VendorApplyFieldKey; message: string }> = [];
  for (const key of VENDOR_APPLY_FIELD_ORDER) {
    const raw = rawErrors.find((candidate) => candidate.startsWith(`${key} `));
    if (raw) {
      grouped.push({ key, message: humaniseFieldError(raw) });
    }
  }
  return grouped;
}
