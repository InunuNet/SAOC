// One attendee's full registration form, in the sheet's order: personal information, membership,
// booking options (locked to the ticket), Judges Events and dietary requirements. On attendee 2
// and later the contact fields and the membership section each take a "Same as above" tick.
// Ids are `registration-{n}-{key}`.
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
  ATTENDING_BY_TICKET,
  REGISTRATION_LABELS,
  REGISTRATION_OPTIONS,
  REGISTRATION_SECTION_HEADINGS,
  SAME_AS_ABOVE_LABEL,
  SOUTH_AFRICA,
  type RegistrationShareSection,
} from '@/lib/registration';

export interface RegistrationAttendeeFieldsProps {
  attendee: number;
  ticketSlug: string;
  draft: RegistrationDraft;
  errors: RegistrationErrors;
  disabled: boolean;
  onField: (attendee: number, field: DraftTextField, value: string) => void;
  onSociety: (attendee: number, option: string, checked: boolean) => void;
  onShared: (attendee: number, section: RegistrationShareSection, checked: boolean) => void;
}

const HEADING_CLASS = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const OPTION_LABEL_CLASS = 'flex min-h-11 items-center gap-2 font-sans text-[15px] text-ink';
// Native control (exempt from WCAG 1.4.11); the label row keeps a 44px hit area.
const CHECKBOX_CLASS =
  'size-6 shrink-0 accent-primary outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] disabled:opacity-60';
const NAME_MAX = 100;
const MOBILE_MAX = 30;
const EMAIL_MAX = 254;
const CONTACT_COVERS = [
  REGISTRATION_LABELS.mobile,
  REGISTRATION_LABELS.country,
  REGISTRATION_LABELS.province,
].join(', ');

function SameAsAbove({
  id,
  covers,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  covers: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const coversId = `${id}-covers`;
  return (
    <div>
      <label htmlFor={id} className={OPTION_LABEL_CLASS}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-describedby={coversId}
          className={CHECKBOX_CLASS}
        />
        {SAME_AS_ABOVE_LABEL}
      </label>
      <p id={coversId} className="pl-8 font-sans text-[13px] text-muted">
        {covers}
      </p>
    </div>
  );
}

function SocietyGroup({
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  value: string[];
  error?: string;
  disabled: boolean;
  onChange: (option: string, checked: boolean) => void;
}) {
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

export function RegistrationAttendeeFields(props: RegistrationAttendeeFieldsProps) {
  const { attendee, ticketSlug, draft, errors, disabled, onField, onSociety, onShared } = props;
  const later = attendee > 1;
  const text = (key: DraftTextField, type: 'text' | 'email' | 'tel', max: number) => (
    <TicketFormField
      id={fieldId(attendee, key)}
      label={REGISTRATION_LABELS[key]}
      type={type}
      autoComplete={type === 'text' ? undefined : type}
      maxLength={max}
      value={draft[key]}
      onChange={(value) => onField(attendee, key, value)}
      disabled={disabled}
      error={errors[key]}
    />
  );
  const select = (key: DraftTextField, options: readonly string[]) => (
    <TicketSelectField
      id={fieldId(attendee, key)}
      label={REGISTRATION_LABELS[key]}
      options={options}
      value={draft[key]}
      onChange={(value) => onField(attendee, key, value)}
      disabled={disabled}
      error={errors[key]}
    />
  );
  // Province is for South Africa only: hidden once another country is chosen.
  const showProvince = draft.country === '' || draft.country === SOUTH_AFRICA;
  const yesNoNa = REGISTRATION_OPTIONS.judgeYesNoNa;
  return (
    <div className="space-y-3">
      <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.personal}</h3>
      {select('title', REGISTRATION_OPTIONS.title)}
      {text('firstName', 'text', NAME_MAX)}
      {text('surname', 'text', NAME_MAX)}
      {text('preferredName', 'text', NAME_MAX)}
      {text('email', 'email', EMAIL_MAX)}
      {later ? (
        <SameAsAbove
          id={fieldId(attendee, 'same-contact')}
          covers={CONTACT_COVERS}
          checked={draft.sameContact}
          disabled={disabled}
          onChange={(checked) => onShared(attendee, 'contact', checked)}
        />
      ) : null}
      {draft.sameContact ? null : (
        <>
          {text('mobile', 'tel', MOBILE_MAX)}
          {select('country', REGISTRATION_OPTIONS.country)}
          {showProvince ? select('province', REGISTRATION_OPTIONS.province) : null}
        </>
      )}
      <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.membership}</h3>
      {later ? (
        <SameAsAbove
          id={fieldId(attendee, 'same-membership')}
          covers={REGISTRATION_LABELS.societies}
          checked={draft.sameMembership}
          disabled={disabled}
          onChange={(checked) => onShared(attendee, 'membership', checked)}
        />
      ) : null}
      {draft.sameMembership ? null : (
        <SocietyGroup
          id={fieldId(attendee, 'societies')}
          value={draft.societies}
          error={errors.societies}
          disabled={disabled}
          onChange={(option, checked) => onSociety(attendee, option, checked)}
        />
      )}
      <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.booking}</h3>
      <TicketSelectField
        id={fieldId(attendee, 'attending')}
        label={REGISTRATION_LABELS.attending}
        options={REGISTRATION_OPTIONS.attending}
        value={ATTENDING_BY_TICKET[ticketSlug] ?? ''}
        onChange={() => undefined}
        disabled
      />
      <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.judges}</h3>
      {select('judgeAccredited', yesNoNa)}
      {select('judgeOrganisation', REGISTRATION_OPTIONS.judgeOrganisation)}
      {select('judgeAvailable', yesNoNa)}
      {select('judgeDate', REGISTRATION_OPTIONS.judgeDate)}
      {select('judgeCommunication', yesNoNa)}
      {select('judgeForum', yesNoNa)}
      <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.dietary}</h3>
      {select('dietary', REGISTRATION_OPTIONS.dietary)}
    </div>
  );
}
