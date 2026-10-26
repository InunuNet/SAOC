'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';

import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { getFirebaseApp } from '@/lib/firebase';
import { useHydrated } from '@/lib/hooks/useHydrated';

type FormValues = {
  title: string;
  kind: string;
  date: string;
  endDate: string;
  venue: string;
  location: string;
  description: string;
  hostSocietyId: string;
};

const INITIAL: FormValues = {
  title: '',
  kind: '',
  date: '',
  endDate: '',
  venue: '',
  location: '',
  description: '',
  hostSocietyId: '',
};

type SubmitEventFormProps = {
  societies: ReadonlyArray<{ id: string; name: string }>;
};

// Same field and label treatment as the /contact form. The boundary is --muted (3:1 non-text).
const INPUT_CLASS =
  'w-full min-h-11 rounded-sm border border-muted bg-ivory px-3.5 py-2.5 font-sans text-[16px] text-ink placeholder:text-muted outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-2 transition-colors disabled:opacity-60 aria-invalid:border-error';
const LABEL_CLASS = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const SUBMIT_CLASS =
  'inline-flex min-h-11 items-center rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ink hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60 disabled:cursor-not-allowed';

const ALLOWED_KINDS = ['exhibition', 'meeting', 'show', 'workshop', 'social'] as const;

function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!v.title.trim()) errors.title = 'Title is required.';
  if (!v.kind || !ALLOWED_KINDS.includes(v.kind as (typeof ALLOWED_KINDS)[number])) {
    errors.kind = 'Please select an event type.';
  }
  const dateObj = v.date ? new Date(v.date) : null;
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj <= new Date()) {
    errors.date = 'Date must be in the future.';
  }
  if (v.endDate) {
    const endObj = new Date(v.endDate);
    if (isNaN(endObj.getTime()) || (dateObj && endObj < dateObj)) {
      errors.endDate = 'End date must be on or after start date.';
    }
  }
  if (!v.venue.trim()) errors.venue = 'Venue is required.';
  if (!v.location.trim()) errors.location = 'Location is required.';
  if (v.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters.';
  }
  return errors;
}

// The existing sign-in route honours `next` (lib/safe-next-path.ts), so the member lands back here.
const SIGN_IN_HREF = '/admin/login?next=/events/submit';
const SIGN_IN_LINK_TEXT = 'sign in again';

// `linkText`, when set, is the part of `text` that links to the sign-in route.
type ServerError = { text: string; linkText?: string };

function ServerErrorMessage({ error }: { error: ServerError }) {
  const at = error.linkText ? error.text.indexOf(error.linkText) : -1;
  if (!error.linkText || at < 0) return <>{error.text}</>;
  return (
    <>
      {error.text.slice(0, at)}
      <Link href={SIGN_IN_HREF} className="underline underline-offset-2">
        {error.linkText}
      </Link>
      {error.text.slice(at + error.linkText.length)}
    </>
  );
}

export function SubmitEventForm({ societies }: SubmitEventFormProps) {
  const hydrated = useHydrated();
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<ServerError | null>(null);

  function set(field: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setStatus('submitting');
    setServerError(null);

    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;
    if (!user) {
      setServerError({ text: 'Please sign in again.', linkText: SIGN_IN_LINK_TEXT });
      setStatus('error');
      return;
    }

    let token: string;
    try {
      token = await user.getIdToken();
    } catch {
      setServerError({
        text: 'Failed to get auth token. Please sign in again.',
        linkText: SIGN_IN_LINK_TEXT,
      });
      setStatus('error');
      return;
    }

    const payload: Record<string, string> = {
      title: values.title,
      kind: values.kind,
      date: values.date,
      venue: values.venue,
      location: values.location,
      description: values.description,
    };
    if (values.endDate) payload.endDate = values.endDate;
    if (values.hostSocietyId.trim()) payload.hostSocietyId = values.hostSocietyId.trim();

    try {
      const res = await fetch('/api/events/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        setStatus('success');
        setValues(INITIAL);
        return;
      }

      const data = (await res.json()) as { error?: string; field?: string };
      if (res.status === 401) {
        setServerError({
          text: 'Your session expired — please sign in again.',
          linkText: SIGN_IN_LINK_TEXT,
        });
        setStatus('error');
        return;
      }
      if (res.status === 400 && data.field) {
        setErrors({ [data.field]: data.error ?? 'Invalid value.' });
        setStatus('idle');
        return;
      }
      setServerError({ text: data.error ?? 'Something went wrong. Please try again.' });
      setStatus('error');
    } catch {
      setServerError({ text: 'Network error. Please try again.' });
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="border border-rule bg-parchment p-8">
        <p role="status" className="font-sans text-[16px] leading-[1.55] text-ink/80">
          Submitted for council review. Thank you — we will be in touch.
        </p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="space-y-5">
      <div aria-live="polite" className="min-h-[1.25rem]">
        {serverError && (
          <TicketFieldAlert id="submit-event-error">
            <ServerErrorMessage error={serverError} />
          </TicketFieldAlert>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="title" className={LABEL_CLASS}>
          Event title <span aria-hidden>*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={values.title}
          onChange={set('title')}
          aria-invalid={errors.title ? 'true' : undefined}
          aria-describedby={errors.title ? 'title-error' : undefined}
          className={INPUT_CLASS}
        />
        {errors.title && <TicketFieldAlert id="title-error">{errors.title}</TicketFieldAlert>}
      </div>

      {/* Kind */}
      <div className="space-y-1.5">
        <label htmlFor="kind" className={LABEL_CLASS}>
          Event type <span aria-hidden>*</span>
        </label>
        <select
          id="kind"
          name="kind"
          required
          value={values.kind}
          onChange={set('kind')}
          aria-invalid={errors.kind ? 'true' : undefined}
          aria-describedby={errors.kind ? 'kind-error' : undefined}
          className={INPUT_CLASS}
        >
          <option value="">Select type…</option>
          {ALLOWED_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
        {errors.kind && <TicketFieldAlert id="kind-error">{errors.kind}</TicketFieldAlert>}
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <label htmlFor="date" className={LABEL_CLASS}>
          Start date <span aria-hidden>*</span>
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          value={values.date}
          onChange={set('date')}
          aria-invalid={errors.date ? 'true' : undefined}
          aria-describedby={errors.date ? 'date-error' : undefined}
          className={INPUT_CLASS}
        />
        {errors.date && <TicketFieldAlert id="date-error">{errors.date}</TicketFieldAlert>}
      </div>

      {/* End date */}
      <div className="space-y-1.5">
        <label htmlFor="endDate" className={LABEL_CLASS}>
          End date <span className="text-muted">(optional)</span>
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          value={values.endDate}
          onChange={set('endDate')}
          aria-invalid={errors.endDate ? 'true' : undefined}
          aria-describedby={errors.endDate ? 'endDate-error' : undefined}
          className={INPUT_CLASS}
        />
        {errors.endDate && <TicketFieldAlert id="endDate-error">{errors.endDate}</TicketFieldAlert>}
      </div>

      {/* Venue */}
      <div className="space-y-1.5">
        <label htmlFor="venue" className={LABEL_CLASS}>
          Venue <span aria-hidden>*</span>
        </label>
        <input
          id="venue"
          name="venue"
          type="text"
          required
          value={values.venue}
          onChange={set('venue')}
          aria-invalid={errors.venue ? 'true' : undefined}
          aria-describedby={errors.venue ? 'venue-error' : undefined}
          className={INPUT_CLASS}
        />
        {errors.venue && <TicketFieldAlert id="venue-error">{errors.venue}</TicketFieldAlert>}
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label htmlFor="location" className={LABEL_CLASS}>
          City / area <span aria-hidden>*</span>
        </label>
        <input
          id="location"
          name="location"
          type="text"
          required
          value={values.location}
          onChange={set('location')}
          aria-invalid={errors.location ? 'true' : undefined}
          aria-describedby={errors.location ? 'location-error' : undefined}
          className={INPUT_CLASS}
        />
        {errors.location && <TicketFieldAlert id="location-error">{errors.location}</TicketFieldAlert>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className={LABEL_CLASS}>
          Description <span aria-hidden>*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          value={values.description}
          onChange={set('description')}
          aria-invalid={errors.description ? 'true' : undefined}
          aria-describedby={errors.description ? 'description-error' : undefined}
          className={INPUT_CLASS}
        />
        {errors.description && <TicketFieldAlert id="description-error">{errors.description}</TicketFieldAlert>}
      </div>

      {/* Host society */}
      <div className="space-y-1.5">
        <label htmlFor="hostSocietyId" className={LABEL_CLASS}>
          Host society <span className="text-muted">(optional)</span>
        </label>
        <select
          id="hostSocietyId"
          name="hostSocietyId"
          value={values.hostSocietyId}
          onChange={set('hostSocietyId')}
          className={INPUT_CLASS}
          aria-invalid={errors.hostSocietyId ? 'true' : undefined}
          aria-describedby={errors.hostSocietyId ? 'hostSocietyId-error' : undefined}
        >
          <option value="">Select society…</option>
          {societies.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {errors.hostSocietyId && (
          <TicketFieldAlert id="hostSocietyId-error">{errors.hostSocietyId}</TicketFieldAlert>
        )}
      </div>

      <button
        type="submit"
        disabled={status === 'submitting' || !hydrated}
        className={SUBMIT_CLASS}
      >
        {status === 'submitting' ? 'Submitting…' : 'Submit event'}
      </button>
    </form>
  );
}
