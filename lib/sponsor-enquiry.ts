/**
 * Sponsor enquiry (mission sponsor-enquiry-form, M1/F1): the field rules shared by the client form
 * and the API handler. Pure: no firebase, no `@/` imports, so the unit check can run it directly.
 * The levels are Lee-Ann's Website Development Specification V3, line 484; the level is optional.
 */

export const SPONSOR_LEVELS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'conservation-partner', label: 'Conservation Partner' },
  { value: 'donor', label: 'Donor' },
] as const;

export type SponsorLevel = (typeof SPONSOR_LEVELS)[number]['value'];
export type SponsorEnquirySite = 'saoc' | 'nos';

export const SPONSOR_ENQUIRY_COLLECTION = 'sponsorEnquiries';

export const NAME_MAX_LENGTH = 120;
export const ORGANISATION_MAX_LENGTH = 160;
export const EMAIL_MAX_LENGTH = 254;
export const PHONE_MIN_LENGTH = 6;
export const PHONE_MAX_LENGTH = 40;
export const WEBSITE_MAX_LENGTH = 200;
export const MESSAGE_MIN_LENGTH = 10;
export const MESSAGE_MAX_LENGTH = 5000;

// The contact API's own email test (app/api/contact/route.ts).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-. ]+$/;
const WEB_PROTOCOLS = new Set(['http:', 'https:']);

// Sourced from ContactForm and the newsletter copy; INVALID_FIELD is functional text, not prose.
export const FIELD_REQUIRED = 'Required';
export const FIELD_INVALID_EMAIL = 'Enter a valid email';
export const FIELD_MESSAGE_TOO_SHORT = 'Please write a message of at least 10 characters.';
export const FIELD_INVALID = 'Please check this field.';

export type SponsorEnquiryField =
  | 'contactName'
  | 'organisation'
  | 'email'
  | 'phone'
  | 'website'
  | 'level'
  | 'message'
  | 'consent';

/** Form order: the first invalid field takes focus. */
export const SPONSOR_ENQUIRY_FIELD_ORDER: SponsorEnquiryField[] = [
  'contactName',
  'organisation',
  'email',
  'phone',
  'website',
  'level',
  'message',
  'consent',
];

export type SponsorEnquiryFieldErrors = Partial<Record<SponsorEnquiryField, string>>;

export interface ValidSponsorEnquiry {
  contactName: string;
  organisation: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  level: SponsorLevel | null;
  message: string;
  consent: true;
}

export type SponsorEnquiryValidation =
  | { ok: true; value: ValidSponsorEnquiry }
  | { ok: false; fieldErrors: SponsorEnquiryFieldErrors };

export interface SponsorEnquiryDoc extends ValidSponsorEnquiry {
  source: SponsorEnquirySite | null;
  status: 'new';
  submittedAt: Date;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function requiredText(raw: unknown, maxLength: number): Parsed<string> {
  if (typeof raw !== 'string') return { ok: false, error: raw === undefined || raw === null ? FIELD_REQUIRED : FIELD_INVALID };
  const text = raw.trim();
  if (text === '') return { ok: false, error: FIELD_REQUIRED };
  if (text.length > maxLength) return { ok: false, error: FIELD_INVALID };
  return { ok: true, value: text };
}

/** Optional text: absent, null, empty and whitespace all become null; any other non-string is an error. */
function optionalText(raw: unknown, maxLength: number): Parsed<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: FIELD_INVALID };
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  if (text.length > maxLength) return { ok: false, error: FIELD_INVALID };
  return { ok: true, value: text };
}

function parseEmail(raw: unknown): Parsed<string> {
  const text = requiredText(raw, EMAIL_MAX_LENGTH);
  if (!text.ok) return text.error === FIELD_REQUIRED ? text : { ok: false, error: FIELD_INVALID_EMAIL };
  if (!EMAIL_PATTERN.test(text.value)) return { ok: false, error: FIELD_INVALID_EMAIL };
  return { ok: true, value: text.value.toLowerCase() };
}

function parsePhone(raw: unknown): Parsed<string | null> {
  const text = optionalText(raw, PHONE_MAX_LENGTH);
  if (!text.ok || text.value === null) return text;
  if (!PHONE_PATTERN.test(text.value) || text.value.length < PHONE_MIN_LENGTH) {
    return { ok: false, error: FIELD_INVALID };
  }
  return text;
}

function parseWebsite(raw: unknown): Parsed<string | null> {
  const text = optionalText(raw, WEBSITE_MAX_LENGTH);
  if (!text.ok || text.value === null) return text;
  try {
    return WEB_PROTOCOLS.has(new URL(text.value).protocol) ? text : { ok: false, error: FIELD_INVALID };
  } catch {
    return { ok: false, error: FIELD_INVALID };
  }
}

/** Level is optional: absent, null and '' (the select's empty option) all store null. */
function parseLevel(raw: unknown): Parsed<SponsorLevel | null> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  const match = SPONSOR_LEVELS.find((level) => level.value === raw);
  return match ? { ok: true, value: match.value } : { ok: false, error: FIELD_INVALID };
}

function parseMessage(raw: unknown): Parsed<string> {
  const text = requiredText(raw, MESSAGE_MAX_LENGTH);
  if (!text.ok) return text;
  if (text.value.length < MESSAGE_MIN_LENGTH) return { ok: false, error: FIELD_MESSAGE_TOO_SHORT };
  return text;
}

/** Validates a raw body. Never throws: a wrong type is a field error. Unknown keys are ignored. */
export function validateSponsorEnquiry(body: unknown): SponsorEnquiryValidation {
  const input = asRecord(body);
  const fieldErrors: SponsorEnquiryFieldErrors = {};

  const contactName = requiredText(input['contactName'], NAME_MAX_LENGTH);
  const organisation = optionalText(input['organisation'], ORGANISATION_MAX_LENGTH);
  const email = parseEmail(input['email']);
  const phone = parsePhone(input['phone']);
  const website = parseWebsite(input['website']);
  const level = parseLevel(input['level']);
  const message = parseMessage(input['message']);
  const { consent } = input;

  if (!contactName.ok) fieldErrors.contactName = contactName.error;
  if (!organisation.ok) fieldErrors.organisation = organisation.error;
  if (!email.ok) fieldErrors.email = email.error;
  if (!phone.ok) fieldErrors.phone = phone.error;
  if (!website.ok) fieldErrors.website = website.error;
  if (!level.ok) fieldErrors.level = level.error;
  if (!message.ok) fieldErrors.message = message.error;
  if (consent !== true) fieldErrors.consent = FIELD_REQUIRED;

  if (
    !contactName.ok || !organisation.ok || !email.ok || !phone.ok ||
    !website.ok || !level.ok || !message.ok || consent !== true
  ) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    value: {
      contactName: contactName.value,
      organisation: organisation.value ?? null,
      email: email.value,
      phone: phone.value ?? null,
      website: website.value ?? null,
      level: level.value ?? null,
      message: message.value,
      consent: true,
    },
  };
}

const SPONSOR_ENQUIRY_SITES: readonly SponsorEnquirySite[] = ['saoc', 'nos'];

/**
 * The stored document. Every optional is null, never undefined; `site` and `now` come from the
 * server. A site outside the allowlist is stored as null.
 */
export function buildSponsorEnquiryDoc(
  value: ValidSponsorEnquiry,
  site: SponsorEnquirySite,
  now: Date,
): SponsorEnquiryDoc {
  const source = SPONSOR_ENQUIRY_SITES.includes(site) ? site : null;
  return { ...value, source, status: 'new', submittedAt: now };
}

export function sponsorLevelLabel(level: SponsorLevel | null): string | null {
  return SPONSOR_LEVELS.find((entry) => entry.value === level)?.label ?? null;
}
