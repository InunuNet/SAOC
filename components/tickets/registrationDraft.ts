// Form-side state for the registration form: what the buyer has typed, how it becomes the
// people lib/registration.ts validates, and how a failed validation becomes the error summary.
import type { CheckoutErrorEntry } from '@/components/tickets/CheckoutErrorSummary';
import {
  SOUTH_AFRICA,
  validateRegistrationGroup,
  type RegistrationPerson,
  type RegistrationRole,
} from '@/lib/registration';

export interface RegistrationDraft {
  title: string;
  firstName: string;
  surname: string;
  preferredName: string;
  mobile: string;
  email: string;
  country: string;
  province: string;
  societies: string[];
  dietary: string;
}

export type RegistrationErrors = Record<string, string>;

export type DraftTextField = Exclude<keyof RegistrationDraft, 'societies'>;

export const REGISTRATION_ROLES: RegistrationRole[] = ['primary', 'partner'];

// Short names for the error summary only; the fields keep the sheet's own labels.
const SUMMARY_FIELD_NAMES: Record<keyof RegistrationDraft, string> = {
  title: 'Title',
  firstName: 'First name',
  surname: 'Surname',
  preferredName: 'Preferred name',
  mobile: 'Mobile number',
  email: 'Email address',
  country: 'Country',
  province: 'Province',
  societies: 'Society',
  dietary: 'Dietary requirements',
};

const SUMMARY_ORDER = Object.keys(SUMMARY_FIELD_NAMES) as (keyof RegistrationDraft)[];

export function emptyDraft(): RegistrationDraft {
  return {
    title: '',
    firstName: '',
    surname: '',
    preferredName: '',
    mobile: '',
    email: '',
    country: '',
    province: '',
    societies: [],
    dietary: '',
  };
}

// Province belongs to South Africa only; membership is asked of the buyer only.
export function draftToPerson(
  draft: RegistrationDraft,
  role: RegistrationRole
): RegistrationPerson {
  return {
    role,
    title: draft.title,
    firstName: draft.firstName,
    surname: draft.surname,
    preferredName: draft.preferredName,
    mobile: draft.mobile,
    email: draft.email,
    country: draft.country,
    province: draft.country === SOUTH_AFRICA ? draft.province : null,
    societies: role === 'primary' ? draft.societies : null,
    dietary: draft.dietary,
  };
}

// Field errors for one person, keyed by field, from the same rules the server runs.
export function validateDrafts(drafts: RegistrationDraft[]): RegistrationErrors[] {
  const people = drafts.map((draft, index) =>
    draftToPerson(draft, index === 0 ? 'primary' : 'partner')
  );
  const result = validateRegistrationGroup(people);
  const byPerson: RegistrationErrors[] = drafts.map(() => ({}));
  if (result.ok) return byPerson;
  for (const [key, message] of Object.entries(result.errors)) {
    const [, index, field] = key.split('.');
    if (field !== undefined) byPerson[Number(index)][field] = message;
  }
  return byPerson;
}

export function fieldId(role: RegistrationRole, key: keyof RegistrationDraft): string {
  return `registration-${role}-${key}`;
}

// Entries in DOM order: each person's fields in sheet order.
export function summaryEntriesFor(errors: RegistrationErrors[]): CheckoutErrorEntry[] {
  const entries: CheckoutErrorEntry[] = [];
  errors.forEach((personErrors, index) => {
    const role: RegistrationRole = index === 0 ? 'primary' : 'partner';
    const prefix = errors.length > 1 ? `${index === 0 ? 'Buyer' : 'Spouse/partner'}, ` : '';
    for (const key of SUMMARY_ORDER) {
      const message = personErrors[key];
      if (!message) continue;
      const id = fieldId(role, key);
      entries.push({
        key: id,
        message: `${prefix}${SUMMARY_FIELD_NAMES[key]}: ${message}`,
        target: key === 'societies' ? `#${id} input:not(:disabled)` : `#${id}`,
      });
    }
  });
  return entries;
}

// After a failed submit the buyer's corrections clear errors as they go; a field that was not
// already flagged never gains one while typing.
export function keepFlaggedErrors(
  flagged: RegistrationErrors[],
  next: RegistrationErrors[]
): RegistrationErrors[] {
  return flagged.map((was, index) => {
    const kept: RegistrationErrors = {};
    for (const key of Object.keys(was)) {
      if (next[index]?.[key]) kept[key] = next[index][key];
    }
    return kept;
  });
}
