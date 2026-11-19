'use client';

// The registration forms of a flagged ticket type: one full form per ticket, "Attendee 1" to
// "Attendee N", in place of the attendee name and email rows. With several attendees each is a
// card that opens on its header, one at a time. Collapsed forms stay mounted (hidden), so
// nothing typed is lost and the validation targets stay in the DOM.
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  RegistrationAttendeeFields,
  type RegistrationAttendeeFieldsProps,
} from '@/components/tickets/RegistrationAttendeeFields';
import type { useRegistrationForm } from '@/components/tickets/useRegistrationForm';

interface RegistrationSectionProps {
  form: ReturnType<typeof useRegistrationForm>;
  ticketSlug: string;
  disabled: boolean;
}

const CARD_CLASS = 'rounded-[12px] border border-rule/60';
const HEADER_CLASS =
  'flex min-h-11 w-full items-center justify-between gap-3 rounded-[12px] px-4 py-3 text-left outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]';

export function RegistrationSection({ form, ticketSlug, disabled }: RegistrationSectionProps) {
  const [openAttendee, setOpenAttendee] = useState<number | null>(1);
  const { attempts, errors } = form;

  // After each failed submit, open the first card that has an error.
  useEffect(() => {
    if (attempts === 0) return;
    const first = errors.findIndex((attendeeErrors) => Object.keys(attendeeErrors).length > 0);
    // Opening the card that holds the error is the effect's whole job; it runs once per submit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (first !== -1) setOpenAttendee(first + 1);
    // Only a new submit attempt re-opens a card, not each correction made afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts]);

  if (form.drafts.length === 0) return null;
  const handlers: Pick<RegistrationAttendeeFieldsProps, 'onField' | 'onSociety' | 'onShared' | 'onAvailability' | 'onJudgeDate'> = {
    onField: form.setField,
    onSociety: form.setSociety,
    onShared: form.setShared,
    onAvailability: form.setAvailability,
    onJudgeDate: form.setJudgeDate,
  };
  const several = form.drafts.length > 1;
  return (
    <div className="space-y-6">
      {form.drafts.map((draft, index) => {
        const attendee = index + 1;
        const label = `Attendee ${attendee}`;
        const open = !several || openAttendee === attendee;
        const panelId = `registration-${attendee}-panel`;
        const buttonId = `registration-${attendee}-toggle`;
        const fields = (
          <RegistrationAttendeeFields
            attendee={attendee}
            ticketSlug={ticketSlug}
            draft={draft}
            errors={form.errors[index] ?? {}}
            disabled={disabled}
            {...handlers}
          />
        );
        if (!several) {
          return (
            <div key={attendee} role="group" aria-label={label} className={`${CARD_CLASS} space-y-3 p-4`}>
              <h2 className="nk-attendees-title">{label}</h2>
              {fields}
            </div>
          );
        }
        return (
          <div key={attendee} role="group" aria-label={label} className={CARD_CLASS}>
            <h2 className="nk-attendees-title m-0">
              <button
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenAttendee(open ? null : attendee)}
                className={HEADER_CLASS}
              >
                <span>{label}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>
            </h2>
            <div id={panelId} data-attendee-panel hidden={!open} className="space-y-3 px-4 pb-4">
              {fields}
            </div>
          </div>
        );
      })}
    </div>
  );
}
