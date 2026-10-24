// Event submission guard. Pure: validation, the verified-email gate and the host-society check are
// all injectable so they run offline against fixtures.

export const ALLOWED_EVENT_KINDS = ['exhibition', 'meeting', 'show', 'workshop', 'social'] as const;

export const EVENT_FIELD_MAX_LENGTHS = {
  title: 150,
  venue: 150,
  location: 150,
  description: 5000,
  hostSocietyId: 64,
} as const;

const DESCRIPTION_MIN_LENGTH = 20;

export type EventValidation = { ok: true } | { ok: false; error: string; field: string };

type CappedField = keyof typeof EVENT_FIELD_MAX_LENGTHS;

const reject = (error: string, field: string): EventValidation => ({ ok: false, error, field });

function isAllowedKind(value: unknown): boolean {
  return ALLOWED_EVENT_KINDS.some((kind) => kind === value);
}

function tooLong(field: CappedField, label: string, value: string): EventValidation | null {
  if (value.length <= EVENT_FIELD_MAX_LENGTHS[field]) return null;
  return reject(`${label} must be at most ${EVENT_FIELD_MAX_LENGTHS[field]} characters`, field);
}

function validateDates(record: Record<string, unknown>, now: Date): EventValidation | null {
  const { date, endDate } = record;
  const dateObj = typeof date === 'string' && date !== '' ? new Date(date) : null;
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj <= now) {
    return reject('Date must be a valid date in the future', 'date');
  }
  if (endDate === undefined || endDate === '') return null;
  const endObj = typeof endDate === 'string' ? new Date(endDate) : null;
  if (!endObj || isNaN(endObj.getTime()) || endObj < dateObj) {
    return reject('End date must be on or after start date', 'endDate');
  }
  return null;
}

function validateRequiredText(
  value: unknown,
  field: CappedField,
  label: string,
  missing: string,
): EventValidation | null {
  if (typeof value !== 'string' || !value.trim()) return reject(missing, field);
  return tooLong(field, label, value);
}

function validateDescription(value: unknown): EventValidation | null {
  if (typeof value !== 'string' || value.trim().length < DESCRIPTION_MIN_LENGTH) {
    return reject('Description must be at least 20 characters', 'description');
  }
  return tooLong('description', 'Description', value);
}

function validateHostSociety(value: unknown): EventValidation | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') return reject('Invalid host society', 'hostSocietyId');
  return tooLong('hostSocietyId', 'Host society', value);
}

export function validateEventSubmission(raw: unknown, now: Date): EventValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return reject('Invalid request body', 'body');
  }
  const record = raw as Record<string, unknown>; // shape-checked field by field below

  const titleProblem = validateRequiredText(record.title, 'title', 'Title', 'Title is required');
  if (titleProblem) return titleProblem;
  if (!isAllowedKind(record.kind)) return reject('Invalid event kind', 'kind');
  const dateProblem = validateDates(record, now);
  if (dateProblem) return dateProblem;
  return (
    validateRequiredText(record.venue, 'venue', 'Venue', 'Venue is required') ??
    validateRequiredText(record.location, 'location', 'Location', 'Location is required') ??
    validateDescription(record.description) ??
    validateHostSociety(record.hostSocietyId) ?? { ok: true }
  );
}

/** Only a verified email may submit: the token claim must be the boolean true. */
export function isVerifiedSubmitter(decoded: { email_verified?: unknown }): boolean {
  return decoded.email_verified === true;
}

/** Fails closed: an empty id, a missing society and a failing lookup are all false. */
export async function hostSocietyExists(
  id: string,
  lookup: (id: string) => Promise<boolean>,
): Promise<boolean> {
  if (id === '') return false;
  try {
    return (await lookup(id)) === true;
  } catch {
    return false;
  }
}
