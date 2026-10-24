// Contact form input validation. Pure: the request body arrives as `unknown`, so every field is
// checked for type and length before anything reaches Firestore or an email payload.

// 254 is the RFC 5321 maximum address length; 100 for a personal name and 200 for a subject line
// are generous for real input while stopping log, DB and email-payload bloat; 5000 is the cap the
// route already had for message.
export const CONTACT_FIELD_MAX_LENGTHS = { name: 100, email: 254, subject: 200, message: 5000 } as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactValidation = { ok: true; value: ContactInput } | { ok: false; error: string };

type ContactField = keyof ContactInput;

const FIELDS: ContactField[] = ['name', 'email', 'subject', 'message'];

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function lengthError(field: ContactField): string {
  const max = CONTACT_FIELD_MAX_LENGTHS[field];
  if (field === 'message') return `Message must be under ${max} characters.`;
  return `${field.charAt(0).toUpperCase()}${field.slice(1)} must be under ${max} characters.`;
}

export function validateContactInput(raw: unknown): ContactValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'All fields are required.' };
  }
  const { name, email, subject, message } = raw as Record<string, unknown>; // each checked below
  if (!isFilled(name) || !isFilled(email) || !isFilled(subject) || !isFilled(message)) {
    return { ok: false, error: 'All fields are required.' };
  }
  const value: ContactInput = { name, email, subject, message };

  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: 'Invalid email address.' };
  for (const field of FIELDS) {
    if (value[field].length > CONTACT_FIELD_MAX_LENGTHS[field]) {
      return { ok: false, error: lengthError(field) };
    }
  }
  return { ok: true, value };
}
