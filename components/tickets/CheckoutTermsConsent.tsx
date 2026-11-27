import Link from 'next/link';

import { CHECKBOX_CLASS, OPTION_LABEL_CLASS } from '@/components/tickets/RegistrationAttendeeFields';
import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { CANCELLATION_SCHEDULE_LINES, REFUND_POLICY_LAST_UPDATED } from '@/content/legal/refunds';
import { TERMS_LAST_UPDATED, TERMS_TITLE } from '@/content/legal/terms';
import { REFUND_POLICY_DISPLAY_TITLE, TERMS_NOT_ACCEPTED_ERROR } from '@/lib/checkout-terms';

export const TERMS_CHECKBOX_ID = 'checkout-terms';
const TERMS_ERROR_ID = `${TERMS_CHECKBOX_ID}-error`;
const LINK_CLASS = 'underline underline-offset-4 text-primary-800';
// The box sits on the label's first line, not centred against a wrapped label.
const CONSENT_LABEL_CLASS = OPTION_LABEL_CLASS.replace('items-center', 'items-start py-2');
// The master's three tier sentences, after the intro, are shown as a list.
const TIER_START = 1;
const TIER_END = 4;
// `.nos-theme p` caps paragraphs at 60ch; the panel is already a readable measure, so fill it.
const SCHEDULE_TEXT_CLASS = 'm-0 max-w-none!';
const NOWRAP = 'whitespace-nowrap';

interface CheckoutTermsConsentProps {
  checked: boolean;
  invalid: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  // The listing's own schedule, when it differs from the policy's; empty or null means the policy's.
  cancellationTerms?: string[] | null;
}

// Terms 5.1 and 7: before paying the customer sees the cancellation schedule and a dated link to each
// document, and confirms they have read and accept both.
export function CheckoutTermsConsent({
  checked,
  invalid,
  disabled,
  onChange,
  cancellationTerms,
}: CheckoutTermsConsentProps) {
  // Blank entries are dropped, so a listing holding only "" or " " falls back to the policy's schedule.
  const customLines = (cancellationTerms ?? []).filter((line) => line.trim().length > 0);
  const custom = customLines.length > 0;
  const schedule = custom ? customLines : CANCELLATION_SCHEDULE_LINES;
  // Only the standard schedule has the tier structure; a listing's own lines stay paragraphs.
  const tierStart = custom ? schedule.length : TIER_START;
  const tierEnd = custom ? schedule.length : TIER_END;
  const paragraph = (line: string, index: number) => (
    <p key={`${index}-${line}`} className={SCHEDULE_TEXT_CLASS}>
      {line}
    </p>
  );
  return (
    <div className="grid gap-2 font-sans text-[14px] text-ink" data-checkout-terms="">
      <div
        className="grid gap-2 border border-rule bg-parchment p-4 text-[13px]"
        data-cancellation-schedule=""
      >
        {schedule.slice(0, tierStart).map((line, index) => paragraph(line, index))}
        {tierEnd > tierStart ? (
          <ul className="m-0 grid max-w-none list-disc gap-1 pl-5">
            {schedule.slice(tierStart, tierEnd).map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        ) : null}
        {schedule.slice(tierEnd).map((line, index) => paragraph(line, tierEnd + index))}
      </div>
      <ul className="m-0 grid list-none gap-1 p-0">
        <li>
          <Link href="/terms" className={LINK_CLASS}>
            {TERMS_TITLE}
          </Link>{' '}
          <span className={NOWRAP}>(Last updated: {TERMS_LAST_UPDATED})</span>
        </li>
        <li>
          <Link href="/refunds" className={LINK_CLASS}>
            {REFUND_POLICY_DISPLAY_TITLE}
          </Link>{' '}
          <span className={NOWRAP}>(Last updated: {REFUND_POLICY_LAST_UPDATED})</span>
        </li>
      </ul>
      <label htmlFor={TERMS_CHECKBOX_ID} className={CONSENT_LABEL_CLASS}>
        <input
          id={TERMS_CHECKBOX_ID}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? TERMS_ERROR_ID : undefined}
          className={`${CHECKBOX_CLASS} mt-0.5`}
        />
        I have read and accept the {TERMS_TITLE} and the {REFUND_POLICY_DISPLAY_TITLE}.
      </label>
      {invalid ? <TicketFieldAlert id={TERMS_ERROR_ID}>{TERMS_NOT_ACCEPTED_ERROR}</TicketFieldAlert> : null}
    </div>
  );
}
