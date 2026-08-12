'use client';

import { useState } from 'react';

import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { TicketTypeCard, type TicketTypeCardData } from '@/components/tickets/TicketTypeCard';
import { TicketFormField } from '@/components/tickets/TicketFormField';
import { PayfastRedirectForm } from '@/components/tickets/PayfastRedirectForm';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'submitting' | 'error';

interface CheckoutFields {
  processUrl: string;
  fields: Record<string, string>;
}

interface TicketPurchaseFormProps {
  ticketTypes: TicketTypeCardData[];
  buyButtonLabel: string;
  soldOutMessage: string;
}

export function TicketPurchaseForm({
  ticketTypes,
  buyButtonLabel,
  soldOutMessage,
}: TicketPurchaseFormProps) {
  const firstOpenType = ticketTypes.find((t) => !t.soldOut);
  const [selectedType, setSelectedType] = useState(firstOpenType?.slug ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; type?: string }>(
    {}
  );
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [redirect, setRedirect] = useState<CheckoutFields | null>(null);
  // One key per form instance, so a double-click through a slow response or a retry
  // reuses it and the server answers with the SAME reservation instead of holding a
  // second seat nobody will pay for. The lazy initialiser keeps it stable across
  // re-renders. It is never replaced in place: handing off to PayFast unmounts this
  // component into PayfastRedirectForm, so a browser Back from PayFast REMOUNTS the form
  // with a brand-new key and the next submit takes a SECOND seat. Reservation expiry
  // (lib/tickets-constants.ts RESERVATION_TTL_MINUTES) is what releases that seat. Do not
  // "fix" this by persisting the key across the Back navigation — that would replay the
  // first reservation, which the server now refuses with 409 once it is paid or expired,
  // blocking a buyer who is legitimately retrying.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    const errors: typeof fieldErrors = {};
    if (name.trim().length === 0) errors.name = 'Please enter the attendee name.';
    if (!EMAIL_PATTERN.test(email)) errors.email = 'Please enter a valid email address.';
    if (!selectedType) errors.type = 'Please select a ticket type.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/tickets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          showId: NATIONAL_SHOW_ID,
          ticketType: selectedType,
          attendeeName: name.trim(),
          attendeeEmail: email.trim(),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        processUrl?: string;
        fields?: Record<string, string>;
      };

      if (!res.ok || !data.processUrl || !data.fields) {
        setStatus('error');
        setErrorMessage(data.error ?? 'Failed to start checkout. Please try again.');
        return;
      }

      setRedirect({ processUrl: data.processUrl, fields: data.fields });
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  if (redirect) {
    return <PayfastRedirectForm processUrl={redirect.processUrl} fields={redirect.fields} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Ticket type
        </legend>
        {ticketTypes.map((t) => (
          <TicketTypeCard
            key={t.slug}
            ticketType={t}
            selected={selectedType === t.slug}
            onSelect={setSelectedType}
            soldOutLabel={soldOutMessage}
          />
        ))}
        {fieldErrors.type ? (
          <p className="font-sans text-[13px] text-accent">{fieldErrors.type}</p>
        ) : null}
      </fieldset>

      <TicketFormField
        id="tp-name"
        label="Attendee name"
        type="text"
        value={name}
        onChange={setName}
        disabled={status === 'submitting'}
        error={fieldErrors.name}
      />
      <TicketFormField
        id="tp-email"
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        disabled={status === 'submitting'}
        error={fieldErrors.email}
      />

      {status === 'error' && errorMessage ? (
        <p role="alert" className="font-sans text-[14px] text-accent">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting' ? 'Redirecting to PayFast…' : buyButtonLabel}
      </button>
    </form>
  );
}
