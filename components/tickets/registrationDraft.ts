// Form-side state for the registration form: what the buyer has typed for each attendee, how it
// becomes the people lib/registration.ts validates, and how a failed validation becomes the error
// summary. Attendees are numbered from 1, as on the page.
import type { CheckoutErrorEntry } from '@/components/tickets/CheckoutErrorSummary';
import {
  ATTENDING_BY_TICKET,
  SHARE_SECTION_FIELDS,
  SOUTH_AFRICA,
  validateRegistrationGroup,
  type RegistrationPerson,
  type RegistrationShareSection,
} from '@/lib/registration';

export interface RegistrationDraft {
  title: string;
  firstName: string;
  surname: string;
  preferredName: string;
  email: string;
  mobile: string;
  country: string;
  province: string;
  societies: string[];
  judgeAccredited: string;
  judgeOrganisation: string;
  judgeAvailable: string;
  judgeDate: string;
  judgeCommunication: string;
  judgeForum: string;
  dietary: string;
  // "Same as above" ticks, forms 2 and later: the section is hidden and copied from attendee 1.
  sameContact: boolean;
  sameMembership: boolean;
}

export type DraftTextField = Exclude<
  keyof RegistrationDraft,
  'societies' | 'sameContact' | 'sameMembership'
>;

/** Field errors of one attendee, keyed by field. */
export type RegistrationErrors = Record<string, string>;

// Short names for the error summary only; the fields keep the sheet's own labels.
const SUMMARY_FIELD_NAMES: Record<string, string> = {
  title: 'Title',
  firstName: 'First name',
  surname: 'Surname',
  preferredName: 'Preferred name',
  email: 'Email address',
  mobile: 'Mobile number',
  country: 'Country',
  province: 'Province',
  societies: 'Society',
  judgeAccredited: 'Accredited Orchid Judge',
  judgeOrganisation: 'Orchid Organisation',
  judgeAvailable: 'Available as a Show Judge',
  judgeDate: 'Date available',
  judgeCommunication: 'Judges Communication',
  judgeForum: 'Judges Forum',
  dietary: 'Dietary requirements',
};

export function emptyDraft(): RegistrationDraft {
  return {
    title: '',
    firstName: '',
    surname: '',
    preferredName: '',
    email: '',
    mobile: '',
    country: '',
    province: '',
    societies: [],
    judgeAccredited: '',
    judgeOrganisation: '',
    judgeAvailable: '',
    judgeDate: '',
    judgeCommunication: '',
    judgeForum: '',
    dietary: '',
    sameContact: false,
    sameMembership: false,
  };
}

/** The sections a draft has ticked "Same as above", as the server expects them. */
function sharedOf(draft: RegistrationDraft, index: number): RegistrationShareSection[] {
  if (index === 0) return [];
  const shared: RegistrationShareSection[] = [];
  if (draft.sameContact) shared.push('contact');
  if (draft.sameMembership) shared.push('membership');
  return shared;
}

// The people to validate and post. Ticked sections carry attendee 1's values; the server copies
// them again and is the authority.
export function draftsToPeople(drafts: RegistrationDraft[], ticketSlug: string) {
  const first = drafts[0];
  return drafts.map((draft, index) => {
    const shared = sharedOf(draft, index);
    const contact = shared.includes('contact') ? first : draft;
    const membership = shared.includes('membership') ? first : draft;
    return {
      title: draft.title,
      firstName: draft.firstName,
      surname: draft.surname,
      preferredName: draft.preferredName,
      email: draft.email,
      mobile: contact.mobile,
      country: contact.country,
      province: contact.country === SOUTH_AFRICA ? contact.province : null,
      societies: membership.societies,
      attending: ATTENDING_BY_TICKET[ticketSlug] ?? '',
      judgeAccredited: draft.judgeAccredited,
      judgeOrganisation: draft.judgeOrganisation,
      judgeAvailable: draft.judgeAvailable,
      judgeDate: draft.judgeDate,
      judgeCommunication: draft.judgeCommunication,
      judgeForum: draft.judgeForum,
      dietary: draft.dietary,
      sameAsAttendee1: shared,
    };
  });
}

function isSharedField(draft: RegistrationDraft, index: number, field: string): boolean {
  return sharedOf(draft, index).some((section) => SHARE_SECTION_FIELDS[section].includes(field));
}

// Field errors for each attendee, from the same rules the server runs, and the validated people
// (attendee numbers assigned, ticked sections copied) when there are none. A hidden, copied
// section shows no error of its own: any fault in it belongs to attendee 1's fields.
export function checkDrafts(
  drafts: RegistrationDraft[],
  ticketSlug: string
): { errors: RegistrationErrors[]; people: RegistrationPerson[] | null } {
  const errors: RegistrationErrors[] = drafts.map(() => ({}));
  const result = validateRegistrationGroup(draftsToPeople(drafts, ticketSlug), ticketSlug);
  if (result.ok) return { errors, people: result.people };
  for (const [key, message] of Object.entries(result.errors)) {
    const [, index, field] = key.split('.');
    if (field === undefined || field === 'attending' || field === 'sameAsAttendee1') continue;
    if (isSharedField(drafts[Number(index)], Number(index), field)) continue;
    errors[Number(index)][field] = message;
  }
  return { errors, people: null };
}

export function hasErrors(errors: RegistrationErrors[]): boolean {
  return errors.some((attendeeErrors) => Object.keys(attendeeErrors).length > 0);
}

export function fieldId(attendee: number, key: string): string {
  return `registration-${attendee}-${key}`;
}

// Entries in DOM order: each attendee's fields in sheet order.
export function summaryEntriesFor(errors: RegistrationErrors[]): CheckoutErrorEntry[] {
  const entries: CheckoutErrorEntry[] = [];
  errors.forEach((attendeeErrors, index) => {
    const attendee = index + 1;
    for (const key of Object.keys(SUMMARY_FIELD_NAMES)) {
      const message = attendeeErrors[key];
      if (!message) continue;
      const id = fieldId(attendee, key);
      entries.push({
        key: id,
        message: `Attendee ${attendee}, ${SUMMARY_FIELD_NAMES[key]}: ${message}`,
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
