// The registration form of a flagged ticket type: the buyer's fields, then at the bottom the
// "Add spouse/partner" control, which reveals the travelling companion block.
import { RegistrationPersonFields } from '@/components/tickets/RegistrationPersonFields';
import type { useRegistrationForm } from '@/components/tickets/useRegistrationForm';
import {
  ADD_PARTNER_LABEL,
  REGISTRATION_SECTION_HEADINGS,
  REMOVE_PARTNER_LABEL,
} from '@/lib/registration';

interface RegistrationSectionProps {
  form: ReturnType<typeof useRegistrationForm>;
  disabled: boolean;
  onAddPartner: () => void;
  onRemovePartner: () => void;
}

const PARTNER_CONTROL_CLASS =
  'min-h-11 font-sans text-[15px] font-medium text-primary underline underline-offset-2 disabled:opacity-60';

export function RegistrationSection({
  form,
  disabled,
  onAddPartner,
  onRemovePartner,
}: RegistrationSectionProps) {
  return (
    <div className="space-y-6">
      <RegistrationPersonFields
        role="primary"
        draft={form.drafts[0]}
        errors={form.errors[0] ?? {}}
        disabled={disabled}
        onField={form.setField}
        onSociety={form.setSociety}
      />
      {form.hasPartner ? (
        <div
          role="group"
          aria-label={REGISTRATION_SECTION_HEADINGS.partner}
          className="space-y-3 rounded-[12px] border border-rule/60 p-4"
        >
          <h2 className="nk-attendees-title">{REGISTRATION_SECTION_HEADINGS.partner}</h2>
          <RegistrationPersonFields
            role="partner"
            draft={form.drafts[1]}
            errors={form.errors[1] ?? {}}
            disabled={disabled}
            onField={form.setField}
            onSociety={form.setSociety}
          />
        </div>
      ) : null}
      <button
        type="button"
        className={PARTNER_CONTROL_CLASS}
        disabled={disabled}
        onClick={form.hasPartner ? onRemovePartner : onAddPartner}
      >
        {form.hasPartner ? REMOVE_PARTNER_LABEL : ADD_PARTNER_LABEL}
      </button>
    </div>
  );
}
