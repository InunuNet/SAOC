// One person's registration fields, in the sheet's order: personal information, membership
// (the buyer only), then dietary requirements. Ids are `registration-<role>-<key>`.
import {
  fieldId,
  type DraftTextField,
  type RegistrationDraft,
  type RegistrationErrors,
} from '@/components/tickets/registrationDraft';
import {
  TicketFieldAlert,
  TicketFormField,
  TicketSelectField,
} from '@/components/tickets/TicketFormField';
import {
  REGISTRATION_LABELS,
  REGISTRATION_OPTIONS,
  REGISTRATION_SECTION_HEADINGS,
  SOUTH_AFRICA,
  type RegistrationRole,
} from '@/lib/registration';

interface RegistrationPersonFieldsProps {
  role: RegistrationRole;
  draft: RegistrationDraft;
  errors: RegistrationErrors;
  disabled: boolean;
  onField: (role: RegistrationRole, field: DraftTextField, value: string) => void;
  onSociety: (option: string, checked: boolean) => void;
}

const HEADING_CLASS = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const OPTION_LABEL_CLASS = 'flex min-h-11 items-center gap-2 font-sans text-[15px] text-ink';
// Native control (exempt from WCAG 1.4.11); the label row keeps a 44px hit area.
const CHECKBOX_CLASS =
  'size-6 shrink-0 accent-primary outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] disabled:opacity-60';
const NAME_MAX = 100;
const MOBILE_MAX = 30;
const EMAIL_MAX = 254;

function SocietyGroup({
  role,
  value,
  error,
  disabled,
  onChange,
}: {
  role: RegistrationRole;
  value: string[];
  error?: string;
  disabled: boolean;
  onChange: (option: string, checked: boolean) => void;
}) {
  const id = fieldId(role, 'societies');
  const errorId = `${id}-error`;
  return (
    <fieldset
      id={id}
      className="space-y-2"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="font-sans text-[14px] font-medium text-[var(--ink-700)]">
        {REGISTRATION_LABELS.societies}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REGISTRATION_OPTIONS.society.map((option) => {
          const optionId = `${id}-${option.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          return (
            <label key={option} htmlFor={optionId} className={OPTION_LABEL_CLASS}>
              <input
                id={optionId}
                type="checkbox"
                name={id}
                value={option}
                checked={value.includes(option)}
                onChange={(e) => onChange(option, e.target.checked)}
                disabled={disabled}
                className={CHECKBOX_CLASS}
              />
              {option}
            </label>
          );
        })}
      </div>
      {error ? <TicketFieldAlert id={errorId}>{error}</TicketFieldAlert> : null}
    </fieldset>
  );
}

export function RegistrationPersonFields({
  role,
  draft,
  errors,
  disabled,
  onField,
  onSociety,
}: RegistrationPersonFieldsProps) {
  const text = (key: DraftTextField, type: 'text' | 'email' | 'tel', max: number) => (
    <TicketFormField
      id={fieldId(role, key)}
      label={REGISTRATION_LABELS[key as keyof typeof REGISTRATION_LABELS]}
      type={type}
      autoComplete={type === 'text' ? undefined : type}
      maxLength={max}
      value={draft[key]}
      onChange={(value) => onField(role, key, value)}
      disabled={disabled}
      error={errors[key]}
    />
  );
  const select = (key: 'title' | 'country' | 'province' | 'dietary') => (
    <TicketSelectField
      id={fieldId(role, key)}
      label={REGISTRATION_LABELS[key]}
      options={REGISTRATION_OPTIONS[key]}
      value={draft[key]}
      onChange={(value) => onField(role, key, value)}
      disabled={disabled}
      error={errors[key]}
    />
  );
  // Province is for South Africa only: hidden once another country is chosen.
  const showProvince = draft.country === '' || draft.country === SOUTH_AFRICA;
  return (
    <div className="space-y-3">
      <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.personal}</h3>
      {select('title')}
      {text('firstName', 'text', NAME_MAX)}
      {text('surname', 'text', NAME_MAX)}
      {text('preferredName', 'text', NAME_MAX)}
      {text('mobile', 'tel', MOBILE_MAX)}
      {text('email', 'email', EMAIL_MAX)}
      {select('country')}
      {showProvince ? select('province') : null}
      {role === 'primary' ? (
        <>
          <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.membership}</h3>
          <SocietyGroup
            role={role}
            value={draft.societies}
            error={errors.societies}
            disabled={disabled}
            onChange={onSociety}
          />
        </>
      ) : null}
      <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.dietary}</h3>
      {select('dietary')}
    </div>
  );
}
