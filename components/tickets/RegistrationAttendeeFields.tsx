import { fieldId, isAccreditedJudge, type DraftTextField, type RegistrationDraft, type RegistrationErrors } from '@/components/tickets/registrationDraft';
import { SocietyDropdown } from '@/components/tickets/SocietyDropdown';
import { TicketFieldAlert, TicketFormField, TicketSelectField } from '@/components/tickets/TicketFormField';
import { JUDGE_DATE_LABELS, REGISTRATION_LABELS, REGISTRATION_OPTIONS, REGISTRATION_SECTION_HEADINGS, SAME_AS_ABOVE_LABEL, SOUTH_AFRICA, type RegistrationShareSection } from '@/lib/registration';

export interface RegistrationAttendeeFieldsProps {
  attendee: number;
  ticketSlug: string;
  draft: RegistrationDraft;
  errors: RegistrationErrors;
  disabled: boolean;
  onField: (attendee: number, field: DraftTextField, value: string) => void;
  onSociety: (attendee: number, option: string, checked: boolean) => void;
  onShared: (attendee: number, section: RegistrationShareSection, checked: boolean) => void;
  onAvailability: (attendee: number, checked: boolean) => void;
  onJudgeDate: (attendee: number, date: string, checked: boolean) => void;
}

const HEADING_CLASS = 'font-mono text-[11px] tracking-[0.16em] text-muted';
export const OPTION_LABEL_CLASS = 'flex min-h-11 items-center gap-2 font-sans text-[15px] text-ink';
export const CHECKBOX_CLASS = 'size-6 shrink-0 accent-primary outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] disabled:opacity-60';

function SameAsAbove({ id, covers, checked, disabled, onChange }: { id: string; covers: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  const coversId = `${id}-covers`;
  return <div><label htmlFor={id} className={OPTION_LABEL_CLASS}>
    <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} aria-describedby={coversId} className={CHECKBOX_CLASS} />{SAME_AS_ABOVE_LABEL}
  </label><p id={coversId} className="pl-8 font-sans text-[13px] text-muted">{covers}</p></div>;
}

export function RegistrationAttendeeFields({ attendee, draft, errors, disabled, onField, onSociety, onShared, onAvailability, onJudgeDate }: RegistrationAttendeeFieldsProps) {
  const later = attendee > 1;
  const text = (key: DraftTextField, type: 'text' | 'email' | 'tel', max: number) => <TicketFormField
    id={fieldId(attendee, key)} label={REGISTRATION_LABELS[key]} type={type} autoComplete={type === 'text' ? undefined : type}
    maxLength={max} value={draft[key]} onChange={(value) => onField(attendee, key, value)} disabled={disabled} error={errors[key]} />;
  const select = (key: DraftTextField, options: readonly string[]) => <TicketSelectField
    id={fieldId(attendee, key)} label={REGISTRATION_LABELS[key]} options={options} value={draft[key]}
    onChange={(value) => onField(attendee, key, value)} disabled={disabled} error={errors[key]} />;
  const dateId = fieldId(attendee, 'judgeDate');
  return <div className="space-y-3">
    <h3 className={HEADING_CLASS}>{REGISTRATION_SECTION_HEADINGS.personal}</h3>
    <div className="grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">{select('title', REGISTRATION_OPTIONS.title)}{text('firstName', 'text', 100)}{text('surname', 'text', 100)}</div>
    <div className="grid gap-3 sm:grid-cols-2 sm:items-end">{text('preferredName', 'text', 100)}{text('email', 'email', 254)}</div>
    {later ? <SameAsAbove id={fieldId(attendee, 'same-contact')} covers={[REGISTRATION_LABELS.mobile, REGISTRATION_LABELS.country, REGISTRATION_LABELS.province].join(', ')} checked={draft.sameContact} disabled={disabled} onChange={(checked) => onShared(attendee, 'contact', checked)} /> : null}
    {!draft.sameContact ? <>{text('mobile', 'tel', 30)}<div className="grid gap-3 sm:grid-cols-2 sm:items-end">{select('country', REGISTRATION_OPTIONS.country)}{draft.country === SOUTH_AFRICA ? select('province', REGISTRATION_OPTIONS.province) : null}</div></> : null}
    <h3 className={`${HEADING_CLASS} mt-8`}>{REGISTRATION_SECTION_HEADINGS.membership}</h3>
    {later ? <SameAsAbove id={fieldId(attendee, 'same-membership')} covers={REGISTRATION_LABELS.societies} checked={draft.sameMembership} disabled={disabled} onChange={(checked) => onShared(attendee, 'membership', checked)} /> : null}
    {!draft.sameMembership ? <SocietyDropdown id={fieldId(attendee, 'societies')} value={draft.societies} error={errors.societies} disabled={disabled} onChange={(option, checked) => onSociety(attendee, option, checked)} /> : null}
    <h3 className={`${HEADING_CLASS} mt-8`}>{REGISTRATION_SECTION_HEADINGS.judges}</h3>
    {select('judgeAccreditation', REGISTRATION_OPTIONS.judgeAccreditation)}
    {isAccreditedJudge(draft) ? <div><label htmlFor={fieldId(attendee, 'judgeAvailable')} className={OPTION_LABEL_CLASS}>
      <input id={fieldId(attendee, 'judgeAvailable')} type="checkbox" checked={draft.judgeAvailable} onChange={(event) => onAvailability(attendee, event.target.checked)} disabled={disabled} aria-invalid={Boolean(errors.judgeAvailable)} aria-describedby={errors.judgeAvailable ? `${fieldId(attendee, 'judgeAvailable')}-error` : undefined} className={CHECKBOX_CLASS} />Available as a show judge
    </label>{errors.judgeAvailable ? <TicketFieldAlert id={`${fieldId(attendee, 'judgeAvailable')}-error`}>{errors.judgeAvailable}</TicketFieldAlert> : null}</div> : null}
    {isAccreditedJudge(draft) && draft.judgeAvailable ? <div role="group" aria-label={REGISTRATION_LABELS.judgeDate} aria-invalid={Boolean(errors.judgeDate)} aria-describedby={errors.judgeDate ? `${dateId}-error` : undefined}>
      <p className="font-sans text-[14px] font-medium text-[var(--ink-700)]">{REGISTRATION_LABELS.judgeDate}</p>
      {REGISTRATION_OPTIONS.judgeDateChoices.map((date) => { const id = `${dateId}-${date.toLowerCase()}`; return <label htmlFor={id} key={date} className={OPTION_LABEL_CLASS}><input id={id} type="checkbox" checked={draft.judgeDates.includes(date)} onChange={(event) => onJudgeDate(attendee, date, event.target.checked)} disabled={disabled} className={CHECKBOX_CLASS} />{JUDGE_DATE_LABELS[date]}</label>; })}
      {errors.judgeDate ? <TicketFieldAlert id={`${dateId}-error`}>{errors.judgeDate}</TicketFieldAlert> : null}
    </div> : null}
    <div className="grid gap-3 sm:grid-cols-2 sm:items-end">{select('judgeCommunication', REGISTRATION_OPTIONS.judgeYesNo)}{select('judgeForum', REGISTRATION_OPTIONS.judgeYesNo)}</div>
    <h3 className={`${HEADING_CLASS} mt-8`}>{REGISTRATION_SECTION_HEADINGS.dietary}</h3>
    {select('dietary', REGISTRATION_OPTIONS.dietary)}
    {draft.dietary === 'Other' ? text('dietaryOther', 'text', 100) : null}
  </div>;
}
