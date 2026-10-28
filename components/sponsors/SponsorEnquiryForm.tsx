'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';

import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import {
  ENQUIRY_CONSENT_LABEL,
  ENQUIRY_LABELS,
  ENQUIRY_PRIVACY_LINK_TEXT,
  ENQUIRY_REUSED,
} from '@/lib/sponsor-enquiry-copy';
import {
  SPONSOR_ENQUIRY_FIELD_ORDER,
  SPONSOR_LEVELS,
  validateSponsorEnquiry,
  type SponsorEnquiryField,
  type SponsorEnquiryFieldErrors,
  type SponsorEnquirySite,
} from '@/lib/sponsor-enquiry';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const ENDPOINT = '/api/sponsors/enquire';
const FORM_ERROR_ID = 'se-form-error';
const SUCCESS_HEADING_ID = 'enquire-success-heading';
const MESSAGE_HINT_ID = 'se-message-hint';
const MESSAGE_ROWS = 6;

interface Values {
  contactName: string;
  organisation: string;
  email: string;
  phone: string;
  website: string;
  level: string;
  message: string;
  consent: boolean;
}

const EMPTY_VALUES: Values = {
  contactName: '',
  organisation: '',
  email: '',
  phone: '',
  website: '',
  level: '',
  message: '',
  consent: false,
};

// The field boundary is --muted (a 3:1 non-text contrast, WCAG 1.4.11); same classes as ContactForm,
// with a 44px row and a 16px size so a phone does not zoom on focus.
const inputClass =
  'min-h-11 w-full rounded-sm border border-muted bg-ivory px-3.5 py-2.5 font-sans text-[16px] text-ink placeholder:text-muted outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] transition-colors disabled:opacity-60 aria-invalid:border-error';
const labelClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';

interface FieldProps {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? <TicketFieldAlert id={`${id}-error`}>{error}</TicketFieldAlert> : null}
    </div>
  );
}

interface SponsorEnquiryFormProps {
  site: SponsorEnquirySite;
}

export function SponsorEnquiryForm({ site }: SponsorEnquiryFormProps) {
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SponsorEnquiryFieldErrors>({});
  const submitting = useRef(false);
  const successHeading = useRef<HTMLHeadingElement>(null);

  // The form is replaced in place by the thank-you; focus moves to its heading.
  useEffect(() => {
    if (status === 'success') successHeading.current?.focus();
  }, [status]);

  function setField(key: keyof Values) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = key === 'consent' ? (event.target as HTMLInputElement).checked : event.target.value;
      setValues((prev) => ({ ...prev, [key]: next }));
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    };
  }

  function showErrors(errors: SponsorEnquiryFieldErrors) {
    setStatus('idle');
    setErrorMessage('');
    setFieldErrors(errors);
    const first = SPONSOR_ENQUIRY_FIELD_ORDER.find((key: SponsorEnquiryField) => errors[key]);
    if (first) document.getElementById(`se-${first}`)?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;

    setFieldErrors({});
    // A filled honeypot means a bot: show the generic error, as ContactForm does.
    if (honeypot.trim() !== '') {
      setStatus('error');
      setErrorMessage(ENQUIRY_REUSED.genericError);
      return;
    }

    // The client runs the same rules as the API (cheap UX; the API stays the source of truth).
    const validation = validateSponsorEnquiry(values);
    if (!validation.ok) {
      showErrors(validation.fieldErrors);
      return;
    }

    submitting.current = true;
    setStatus('submitting');
    setErrorMessage('');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, _hp: honeypot }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          fieldErrors?: SponsorEnquiryFieldErrors;
        };
        if (data.fieldErrors) {
          showErrors(data.fieldErrors);
          return;
        }
        setStatus('error');
        setErrorMessage(data.error ?? ENQUIRY_REUSED.genericError);
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage(ENQUIRY_REUSED.networkError);
    } finally {
      submitting.current = false;
    }
  }

  const disabled = status === 'submitting';
  const describedBy = (key: SponsorEnquiryField) => (fieldErrors[key] ? `se-${key}-error` : undefined);
  const invalid = (key: SponsorEnquiryField) => (fieldErrors[key] ? 'true' : undefined);

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className="border border-rule bg-parchment p-8">
        <h3
          id={SUCCESS_HEADING_ID}
          ref={successHeading}
          tabIndex={-1}
          className="font-serif font-normal text-[22px] text-ink outline-none"
        >
          {ENQUIRY_REUSED.successHeading}
        </h3>
        {site === 'saoc' ? (
          <p className="mt-3 font-sans text-[16px] leading-[1.55] text-ink/80">
            {ENQUIRY_REUSED.successBody}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field id="se-contactName" label={ENQUIRY_REUSED.name} error={fieldErrors.contactName}>
        <input
          id="se-contactName"
          type="text"
          name="contactName"
          autoComplete="name"
          required
          maxLength={120}
          value={values.contactName}
          onChange={setField('contactName')}
          disabled={disabled}
          className={inputClass}
          aria-invalid={invalid('contactName')}
          aria-describedby={describedBy('contactName')}
        />
      </Field>

      <Field id="se-organisation" label={ENQUIRY_LABELS.organisation} error={fieldErrors.organisation}>
        <input
          id="se-organisation"
          type="text"
          name="organisation"
          autoComplete="organization"
          maxLength={160}
          value={values.organisation}
          onChange={setField('organisation')}
          disabled={disabled}
          className={inputClass}
          aria-invalid={invalid('organisation')}
          aria-describedby={describedBy('organisation')}
        />
      </Field>

      <Field id="se-email" label={ENQUIRY_REUSED.email} error={fieldErrors.email}>
        <input
          id="se-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          value={values.email}
          onChange={setField('email')}
          disabled={disabled}
          className={inputClass}
          aria-invalid={invalid('email')}
          aria-describedby={describedBy('email')}
        />
      </Field>

      <Field id="se-phone" label={ENQUIRY_LABELS.phone} error={fieldErrors.phone}>
        <input
          id="se-phone"
          type="tel"
          name="phone"
          autoComplete="tel"
          maxLength={40}
          value={values.phone}
          onChange={setField('phone')}
          disabled={disabled}
          className={inputClass}
          aria-invalid={invalid('phone')}
          aria-describedby={describedBy('phone')}
        />
      </Field>

      <Field id="se-website" label={ENQUIRY_REUSED.website} error={fieldErrors.website}>
        <input
          id="se-website"
          type="url"
          name="website"
          autoComplete="url"
          maxLength={200}
          value={values.website}
          onChange={setField('website')}
          disabled={disabled}
          className={inputClass}
          aria-invalid={invalid('website')}
          aria-describedby={describedBy('website')}
        />
      </Field>

      <Field id="se-level" label={ENQUIRY_LABELS.level} error={fieldErrors.level}>
        <select
          id="se-level"
          name="level"
          value={values.level}
          onChange={setField('level')}
          disabled={disabled}
          className={inputClass}
          aria-invalid={invalid('level')}
          aria-describedby={describedBy('level')}
        >
          <option value="">Choose a level</option>
          {SPONSOR_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="se-message" label={ENQUIRY_REUSED.message} error={fieldErrors.message}>
        <textarea
          id="se-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={MESSAGE_ROWS}
          value={values.message}
          onChange={setField('message')}
          disabled={disabled}
          className={`${inputClass} resize-y`}
          aria-invalid={invalid('message')}
          aria-describedby={
            fieldErrors.message ? `${MESSAGE_HINT_ID} se-message-error` : MESSAGE_HINT_ID
          }
        />
        <p id={MESSAGE_HINT_ID} className="font-sans text-[14px] normal-case tracking-normal text-muted">
          Minimum 10 characters.
        </p>
      </Field>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label
            htmlFor="se-consent"
            className="flex min-h-11 items-start gap-2.5 py-2.5 font-sans text-[15px] leading-relaxed text-ink"
          >
            <input
              id="se-consent"
              type="checkbox"
              name="consent"
              required
              checked={values.consent}
              onChange={setField('consent')}
              disabled={disabled}
              className="mt-0.5 h-6 w-6 shrink-0 rounded-sm border border-rule outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] disabled:opacity-60"
              aria-invalid={invalid('consent')}
              aria-describedby={describedBy('consent')}
            />
            <span>{ENQUIRY_CONSENT_LABEL}</span>
          </label>
          <a
            href="/privacy"
            className="inline-flex min-h-11 items-center font-sans text-[15px] text-ink underline underline-offset-2 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
          >
            {ENQUIRY_PRIVACY_LINK_TEXT}
          </a>
        </div>
        {fieldErrors.consent ? (
          <TicketFieldAlert id="se-consent-error">{fieldErrors.consent}</TicketFieldAlert>
        ) : null}
      </div>

      {/* Honeypot: visually hidden, tab-unreachable, aria-hidden. Sent so the server can drop a bot silently. */}
      <div className="hidden" aria-hidden="true">
        <label>
          {ENQUIRY_REUSED.honeypotLabel}
          <input
            type="text"
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </label>
      </div>

      {status === 'error' && errorMessage !== '' ? (
        <TicketFieldAlert id={FORM_ERROR_ID}>{errorMessage}</TicketFieldAlert>
      ) : null}

      <button
        type="submit"
        disabled={disabled}
        className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {disabled ? ENQUIRY_REUSED.submitting : ENQUIRY_REUSED.submit}
      </button>
    </form>
  );
}
