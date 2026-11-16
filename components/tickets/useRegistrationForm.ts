'use client';

// State for the registration forms of a ticket type flagged requiresRegistration: one draft per
// ticket in the cart, and the field errors of the last submit attempt.
import { useState } from 'react';

import {
  checkDrafts,
  emptyDraft,
  hasErrors,
  keepFlaggedErrors,
  type DraftTextField,
  type RegistrationDraft,
  type RegistrationErrors,
} from '@/components/tickets/registrationDraft';
import { SOCIETY_NONE, type RegistrationShareSection } from '@/lib/registration';

function selectSocieties(current: string[], option: string, checked: boolean): string[] {
  // "None" stands alone: choosing it clears the societies, choosing a society clears "None".
  if (!checked) return current.filter((entry) => entry !== option);
  if (option === SOCIETY_NONE) return [SOCIETY_NONE];
  return [...current.filter((entry) => entry !== SOCIETY_NONE), option];
}

// Ticking or unticking "Same as above" clears the section, so unticking shows it empty.
function withShared(
  draft: RegistrationDraft,
  section: RegistrationShareSection,
  checked: boolean
): RegistrationDraft {
  return section === 'contact'
    ? { ...draft, sameContact: checked, mobile: '', country: 'South Africa', province: '' }
    : { ...draft, sameMembership: checked, societies: [] };
}

export function useRegistrationForm(count: number, ticketSlug: string) {
  const [stored, setStored] = useState<RegistrationDraft[]>([]);
  const [errors, setErrors] = useState<RegistrationErrors[]>([]);

  // A removed attendee's errors go with it, so a form added back later starts clean (the cart's
  // own attendee rows do the same). React re-renders at once when state is set during render.
  if (errors.length > count) setErrors(errors.slice(0, count));
  const shownErrors = errors.slice(0, count);

  // Drafts beyond the quantity are kept, so lowering and raising it again loses nothing typed.
  const drafts = Array.from({ length: count }, (_, i) => stored[i] ?? emptyDraft());

  function applyDrafts(next: RegistrationDraft[]) {
    setStored([...next, ...stored.slice(next.length)]);
    if (hasErrors(errors)) {
      setErrors(keepFlaggedErrors(errors, checkDrafts(next.slice(0, count), ticketSlug).errors));
    }
  }

  function change(attendee: number, update: (draft: RegistrationDraft) => RegistrationDraft) {
    applyDrafts(drafts.map((draft, i) => (i === attendee - 1 ? update(draft) : draft)));
  }

  function setField(attendee: number, field: DraftTextField, value: string) {
    change(attendee, (draft) => ({ ...draft, [field]: value,
      ...(field === 'country' && value !== 'South Africa' ? { province: '' } : {}),
      ...(field === 'dietary' && value !== 'Other' ? { dietaryOther: '' } : {}),
    }));
  }

  function setAvailability(attendee: number, checked: boolean) {
    change(attendee, (draft) => ({ ...draft, judgeAvailable: checked, judgeDates: checked ? draft.judgeDates : [] }));
  }

  function setJudgeDate(attendee: number, date: string, checked: boolean) {
    change(attendee, (draft) => ({ ...draft, judgeDates: checked ? [...draft.judgeDates, date] : draft.judgeDates.filter((entry) => entry !== date) }));
  }

  function setSociety(attendee: number, option: string, checked: boolean) {
    change(attendee, (draft) => ({
      ...draft,
      societies: selectSocieties(draft.societies, option, checked),
    }));
  }

  function setShared(attendee: number, section: RegistrationShareSection, checked: boolean) {
    change(attendee, (draft) => withShared(draft, section, checked));
  }

  // Runs on every submit attempt. Returns the people to post, or null with the errors shown.
  function validate() {
    const { errors: found, people } = checkDrafts(drafts, ticketSlug);
    setErrors(found);
    return hasErrors(found) ? null : people;
  }

  return { drafts, errors: shownErrors, setField, setSociety, setShared, setAvailability, setJudgeDate, validate };
}
