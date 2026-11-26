import Link from 'next/link';

import { CHECKBOX_CLASS, OPTION_LABEL_CLASS } from '@/components/tickets/RegistrationAttendeeFields';
import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { CANCELLATION_SCHEDULE_LINES, REFUND_POLICY_LAST_UPDATED, REFUND_POLICY_TITLE } from '@/content/legal/refunds';
import { TERMS_LAST_UPDATED, TERMS_TITLE } from '@/content/legal/terms';
import { TERMS_NOT_ACCEPTED_ERROR } from '@/lib/checkout-terms';

export const TERMS_CHECKBOX_ID = 'checkout-terms';
const TERMS_ERROR_ID = `${TERMS_CHECKBOX_ID}-error`;
const LINK_CLASS = 'underline underline-offset-4 text-primary-800';

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
  const schedule =
    cancellationTerms && cancellationTerms.length > 0 ? cancellationTerms : CANCELLATION_SCHEDULE_LINES;
  return (
    <div className="grid gap-2 font-sans text-[14px] text-ink" data-checkout-terms="">
      <div className="grid gap-2" data-cancellation-schedule="">
        {schedule.map((line) => (
          <p key={line} className="m-0">
            {line}
          </p>
        ))}
      </div>
      <ul className="m-0 grid list-none gap-1 p-0">
        <li>
          <Link href="/terms" className={LINK_CLASS}>
            {TERMS_TITLE}
          </Link>{' '}
          (Last updated: {TERMS_LAST_UPDATED})
        </li>
        <li>
          <Link href="/refunds" className={LINK_CLASS}>
            {REFUND_POLICY_TITLE}
          </Link>{' '}
          (Last updated: {REFUND_POLICY_LAST_UPDATED})
        </li>
      </ul>
      <label htmlFor={TERMS_CHECKBOX_ID} className={OPTION_LABEL_CLASS}>
        <input
          id={TERMS_CHECKBOX_ID}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? TERMS_ERROR_ID : undefined}
          className={CHECKBOX_CLASS}
        />
        I have read and accept the {TERMS_TITLE} and the {REFUND_POLICY_TITLE}.
      </label>
      {invalid ? <TicketFieldAlert id={TERMS_ERROR_ID}>{TERMS_NOT_ACCEPTED_ERROR}</TicketFieldAlert> : null}
    </div>
  );
}
