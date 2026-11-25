// Pure logic behind the attendee email blur check, split out so a static contract check can run it
// directly (node --experimental-strip-types: type-only imports, no path aliases, no JSX).
import type { AttendeeFieldErrors } from '@/components/tickets/CartAttendeeFields';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';

/** The inline error for one attendee's email when its field loses focus. An empty field gives no
 *  error (the submit check owns "required"), so tabbing through the form does not shout. */
export function blurEmailError(email: string): string | undefined {
  if (email.length === 0) return undefined;
  return EMAIL_PATTERN.test(email) ? undefined : INVALID_EMAIL_MESSAGE;
}

/** Returns a copy of the blur-only errors with one row's email error set, or cleared when `error`
 *  is undefined. Other rows are untouched. */
export function withBlurEmailError(
  blurErrors: AttendeeFieldErrors,
  rowKey: string,
  error: string | undefined
): AttendeeFieldErrors {
  const next = { ...blurErrors };
  if (error) next[rowKey] = { email: error };
  else delete next[rowKey];
  return next;
}

/** The whole blur transition: the next blur-only error map after attendee `index` loses focus.
 *  Blurring an empty field clears that row's blur error; "required" stays the submit check's job. */
export function nextBlurErrors(
  prev: AttendeeFieldErrors,
  rows: ReadonlyArray<{ attendeeEmail: string }>,
  index: number,
  rowKey: string
): AttendeeFieldErrors {
  const row = rows[index];
  if (!row) return prev;
  return withBlurEmailError(prev, rowKey, blurEmailError(row.attendeeEmail));
}

/** What the fields show: blur-only errors under the submit errors. The form-level summary reads the
 *  submit errors alone, so a blur never opens it. */
export function visibleFieldErrors(
  blurErrors: AttendeeFieldErrors,
  submitErrors: AttendeeFieldErrors
): AttendeeFieldErrors {
  return { ...blurErrors, ...submitErrors };
}
