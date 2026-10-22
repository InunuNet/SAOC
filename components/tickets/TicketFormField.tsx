// F2 (ticketing-pages) — labelled text input shared by name/email fields in
// TicketPurchaseForm. No hooks of its own; inherits the client boundary from its
// parent form.
import type { ReactNode } from 'react';

// nos-ticket-day-stub F3 (Codi): the ticket forms' required-field alert, defined once here. Text and
// a 2px left border in the error colour, a leading warning sign hidden from assistive tech, no box
// outline. The day pickers (hub card and checkout) and the checkout's own error render it too.
const ALERT_CLASS =
  'flex gap-2 border-l-2 border-error bg-bone px-4 py-3 font-sans text-[14px] text-error';
// U+FE0E asks for the text glyph, so the sign takes the error colour rather than an emoji's.
const ALERT_ICON = '\u26A0\uFE0E';

interface TicketFieldAlertProps {
  children: ReactNode;
  // The day pickers set the alert 6px below their options.
  spaced?: boolean;
}

export function TicketFieldAlert({ children, spaced = false }: TicketFieldAlertProps) {
  return (
    <p role="alert" className={spaced ? `mt-1.5 ${ALERT_CLASS}` : ALERT_CLASS}>
      <span aria-hidden="true">{ALERT_ICON}</span>
      <span>{children}</span>
    </p>
  );
}

interface TicketFormFieldProps {
  id: string;
  label: string;
  type: 'text' | 'email';
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  autoComplete?: 'name' | 'email';
}

export function TicketFormField({
  id,
  label,
  type,
  value,
  onChange,
  disabled,
  error,
  autoComplete,
}: TicketFormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-sans text-[14px] font-medium text-[var(--ink-700)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted transition-colors focus:border-ink/40 disabled:opacity-60"
      />
      {error ? <TicketFieldAlert>{error}</TicketFieldAlert> : null}
    </div>
  );
}
