'use client';

// State for the registration form of a ticket type flagged requiresRegistration: the buyer's
// draft, an optional spouse/partner draft, and the field errors of the last submit attempt.
import { useState } from 'react';

import {
  draftToPerson,
  emptyDraft,
  keepFlaggedErrors,
  validateDrafts,
  type DraftTextField,
  type RegistrationDraft,
  type RegistrationErrors,
} from '@/components/tickets/registrationDraft';
import {
  REGISTRATION_MAX_PEOPLE,
  SOCIETY_NONE,
  type RegistrationPerson,
  type RegistrationRole,
} from '@/lib/registration';

function selectSocieties(current: string[], option: string, checked: boolean): string[] {
  // "None" stands alone: choosing it clears the societies, choosing a society clears "None".
  if (!checked) return current.filter((entry) => entry !== option);
  if (option === SOCIETY_NONE) return [SOCIETY_NONE];
  return [...current.filter((entry) => entry !== SOCIETY_NONE), option];
}

export function useRegistrationForm(startWithPartner: boolean) {
  const [drafts, setDrafts] = useState<RegistrationDraft[]>(() =>
    startWithPartner ? [emptyDraft(), emptyDraft()] : [emptyDraft()]
  );
  const [errors, setErrors] = useState<RegistrationErrors[]>([]);

  const roleIndex = (role: RegistrationRole) => (role === 'primary' ? 0 : 1);

  function applyDrafts(next: RegistrationDraft[]) {
    setDrafts(next);
    if (errors.some((personErrors) => Object.keys(personErrors).length > 0)) {
      setErrors(keepFlaggedErrors(errors, validateDrafts(next)));
    }
  }

  function setField(role: RegistrationRole, field: DraftTextField, value: string) {
    const index = roleIndex(role);
    applyDrafts(drafts.map((draft, i) => (i === index ? { ...draft, [field]: value } : draft)));
  }

  function setSociety(option: string, checked: boolean) {
    applyDrafts(
      drafts.map((draft, i) =>
        i === 0 ? { ...draft, societies: selectSocieties(draft.societies, option, checked) } : draft
      )
    );
  }

  function addPartner() {
    if (drafts.length >= REGISTRATION_MAX_PEOPLE) return;
    setDrafts([...drafts, emptyDraft()]);
  }

  function removePartner() {
    setDrafts(drafts.slice(0, 1));
    setErrors((prev) => prev.slice(0, 1));
  }

  // Runs on every submit attempt. Returns the people to post, or null with the errors shown.
  function validate(): RegistrationPerson[] | null {
    const found = validateDrafts(drafts);
    setErrors(found);
    if (found.some((personErrors) => Object.keys(personErrors).length > 0)) return null;
    return drafts.map((draft, index) => draftToPerson(draft, index === 0 ? 'primary' : 'partner'));
  }

  return {
    drafts,
    errors,
    hasPartner: drafts.length > 1,
    setField,
    setSociety,
    addPartner,
    removePartner,
    validate,
  };
}
