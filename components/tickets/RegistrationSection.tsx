// The registration forms of a flagged ticket type: one full form per ticket, "Attendee 1" to
// "Attendee N", in place of the attendee name and email rows.
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

export function RegistrationSection({ form, ticketSlug, disabled }: RegistrationSectionProps) {
  if (form.drafts.length === 0) return null;
  const handlers: Pick<RegistrationAttendeeFieldsProps, 'onField' | 'onSociety' | 'onShared'> = {
    onField: form.setField,
    onSociety: form.setSociety,
    onShared: form.setShared,
  };
  return (
    <div className="space-y-6">
      {form.drafts.map((draft, index) => {
        const attendee = index + 1;
        const label = `Attendee ${attendee}`;
        return (
          <div
            key={attendee}
            role="group"
            aria-label={label}
            className="space-y-3 rounded-[12px] border border-rule/60 p-4"
          >
            <h2 className="nk-attendees-title">{label}</h2>
            <RegistrationAttendeeFields
              attendee={attendee}
              ticketSlug={ticketSlug}
              draft={draft}
              errors={form.errors[index] ?? {}}
              disabled={disabled}
              {...handlers}
            />
          </div>
        );
      })}
    </div>
  );
}
