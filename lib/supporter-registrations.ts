/**
 * `supporterRegistrations/{id}` document shape — public supporter registration (mission
 * public-supporter-registration, F1). See
 * .agent/memory/project/specs/public-supporter-registration/goldens/README.md for the full
 * decision record and every judgement call.
 *
 * Pure, side-effect-free construction module — no Firebase Admin SDK, no Firestore read or
 * write, no network. Time is always injected via a `now` argument, never read from Date.now()
 * inside these builders.
 *
 * ZERO authorization meaning: this is a plain, unauthenticated public mailing-list record —
 * not SAOC/society membership, not a vendor, not an admin. Do not import lib/admin-auth.ts or
 * lib/admin-roles.ts here.
 */

export const SUPPORTER_REGISTRATIONS_COLLECTION = 'supporterRegistrations';

export type SupporterRegistrationStatus = 'pending' | 'confirmed' | 'unsubscribed';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_MAX_LENGTH = 254;
const FIRST_NAME_MAX_LENGTH = 60;

/** What a caller submits. */
export interface SupporterRegistrationRawInput {
  email?: unknown;
  firstName?: unknown;
  consentMarketing?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates raw, untyped input.
 *
 * `consentMarketing` must be the LITERAL boolean `true` — never coerced from a truthy value
 * ("true", 1, "on") and never defaulted when omitted. This is the data-model half of "no
 * pre-ticked box" — see the golden README's "Consent design."
 */
export function validateSupporterRegistrationInput(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['input must be an object'] };
  }
  const record = raw as Record<string, unknown>;

  if (typeof record.email !== 'string' || record.email.trim().length === 0) {
    errors.push('email is required');
  } else {
    const trimmed = record.email.trim();
    if (trimmed.length > EMAIL_MAX_LENGTH) {
      errors.push(`email must be ${EMAIL_MAX_LENGTH} characters or fewer`);
    } else if (!EMAIL_PATTERN.test(trimmed)) {
      errors.push('email must be a valid email address');
    }
  }

  if (record.firstName !== undefined && record.firstName !== null) {
    if (typeof record.firstName !== 'string') {
      errors.push('firstName must be a string');
    } else if (record.firstName.trim().length > FIRST_NAME_MAX_LENGTH) {
      errors.push(`firstName must be ${FIRST_NAME_MAX_LENGTH} characters or fewer`);
    }
  }

  // Literal `true` only. No coercion (Boolean(x)), no default (?? true) — any other value,
  // including total omission, is a rejection naming this field.
  if (record.consentMarketing !== true) {
    errors.push('consentMarketing must be true');
  }

  return { valid: errors.length === 0, errors };
}

/** The normalized, ready-to-persist shape (no `id` -- assigned by Firestore on write). */
export interface SupporterRegistration {
  email: string;
  firstName: string | null;
  consentMarketing: true;
  consentTimestamp: Date;
  status: SupporterRegistrationStatus;
  source: string;
  createdAt: Date;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}

/**
 * Only called after `validateSupporterRegistrationInput` has returned `valid: true` on the
 * SAME raw input -- callers must not call this on unvalidated input. Normalizes email/firstName
 * exactly as validation checked them. `source` is a handler-supplied constant, not part of raw
 * input.
 */
export function buildSupporterRegistration(
  input: { email: string; firstName: string | null; consentMarketing: true },
  now: Date,
  source: string,
): Omit<SupporterRegistration, 'status' | 'confirmedAt' | 'unsubscribedAt'> & {
  status: 'pending';
  confirmedAt: null;
  unsubscribedAt: null;
} {
  // A whitespace-only firstName ("   ") trims to "" -- treated as equivalent to omitted
  // (null), not stored as a distinct empty string. Both mean "no name given"; storing two
  // different values for the same fact would silently split future filtering/export/
  // segmentation on this field.
  const trimmedFirstName = input.firstName === null ? null : input.firstName.trim();

  return {
    email: input.email.trim().toLowerCase(),
    firstName: trimmedFirstName === '' ? null : trimmedFirstName,
    consentMarketing: true,
    consentTimestamp: now,
    status: 'pending',
    source,
    createdAt: now,
    confirmedAt: null,
    unsubscribedAt: null,
  };
}
