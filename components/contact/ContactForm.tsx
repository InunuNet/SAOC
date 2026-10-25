'use client';

import { useEffect, useRef, useState } from 'react';

import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { NOS_CONTACT_SUCCESS_BODY_PLACEHOLDER } from '@/lib/nos-contact-copy';
import { useHydrated } from '@/lib/hooks/useHydrated';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const HINT_ID = 'cf-message-hint';
const FORM_ERROR_ID = 'cf-form-error';
const MIN_MESSAGE_LENGTH = 10;
// The API's own email test (app/api/contact/route.ts).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldKey = 'name' | 'email' | 'subject' | 'message';
type FieldErrors = Partial<Record<FieldKey, string>>;

// DOM order: the first invalid field takes focus.
const FIELD_ORDER: FieldKey[] = ['name', 'email', 'subject', 'message'];

function validate(values: Record<FieldKey, string>): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim() === '') errors.name = 'Required';
  if (values.email.trim() === '') errors.email = 'Required';
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email';
  if (values.subject.trim() === '') errors.subject = 'Required';
  if (values.message.trim().length < MIN_MESSAGE_LENGTH) {
    errors.message = 'Please write a message of at least 10 characters.';
  }
  return errors;
}

interface ContactFormProps {
  /** Which site renders the form; only the success wording differs. */
  site?: 'saoc' | 'nos';
  /** True on the beta preview, where an unsupplied NOS success body shows as a marked stand-in. */
  markPlaceholders?: boolean;
}

export function ContactForm({ site = 'saoc', markPlaceholders = false }: ContactFormProps) {
  const hydrated = useHydrated();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState(''); // honeypot — never sent to the API
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const successHeading = useRef<HTMLHeadingElement>(null);
  const formError = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'success') successHeading.current?.focus();
  }, [status]);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    // 1. Honeypot — if filled, a bot did it. Show generic error, DO NOT call the API.
    setFieldErrors({});
    if (hp.trim() !== '') {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
      return;
    }

    // 2. Client guard mirrors the API (cheap UX, API is still source of truth)
    const errors = validate({ name, email, subject, message });
    const firstInvalid = FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) {
      setStatus('idle');
      setErrorMessage('');
      setFieldErrors(errors);
      document.getElementById(`cf-${firstInvalid}`)?.focus();
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }), // NOTE: no _hp
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMessage(data?.error ?? 'Failed to submit. Please try again.');
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  // The field boundary is --muted (a 3:1 non-text contrast, WCAG 1.4.11); the hairline --rule is too faint for an input.
  const inputClass =
    'w-full rounded-sm border border-muted bg-ivory px-3.5 py-2.5 font-sans text-[16px] text-ink placeholder:text-muted outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-2 transition-colors disabled:opacity-60 aria-invalid:border-error';
  const labelClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';

  const showError = status === 'error' && errorMessage !== '';

  // The submit button is disabled while sending, which drops focus to <body>: a failure takes it.
  useEffect(() => {
    if (showError) formError.current?.focus();
  }, [showError]);

  return (
    <>
      {/* Live region: present before submit so the success message is announced when it arrives. */}
      <div role="status" aria-live="polite">
        {status === 'success' ? (
          <div
            className={`border border-rule bg-parchment p-8${site === 'nos' ? ' rounded-[14px]' : ''}`}
          >
            <h3
              ref={successHeading}
              tabIndex={-1}
              className="font-serif font-normal text-[22px] text-ink outline-none"
            >
              Thank you
            </h3>
            {site === 'saoc' ? (
              <p className="mt-3 font-sans text-[16px] leading-[1.55] text-ink/80">
                Your message has reached the SAOC secretariat. We&apos;ll be in touch soon.
              </p>
            ) : markPlaceholders ? (
              <div data-placeholder="true" className="mt-3 flex flex-col items-start">
                <p className="font-sans text-[16px] leading-[1.55] text-ink/80">
                  {NOS_CONTACT_SUCCESS_BODY_PLACEHOLDER}
                </p>
                <PlaceholderMarker />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {status === 'success' ? null : (
    <form method="post" onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="cf-name" className={labelClass}>
          Name
        </label>
        <input
          id="cf-name"
          type="text"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
          }}
          disabled={status === 'submitting'}
          placeholder="Your name"
          className={inputClass}
          aria-invalid={fieldErrors.name ? 'true' : undefined}
          aria-describedby={fieldErrors.name ? 'cf-name-error' : undefined}
        />
        {fieldErrors.name ? (
          <TicketFieldAlert id="cf-name-error">{fieldErrors.name}</TicketFieldAlert>
        ) : null}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="cf-email" className={labelClass}>
          Email address
        </label>
        <input
          id="cf-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError('email');
          }}
          disabled={status === 'submitting'}
          placeholder="your@email.co.za"
          className={inputClass}
          aria-invalid={fieldErrors.email ? 'true' : undefined}
          aria-describedby={fieldErrors.email ? 'cf-email-error' : undefined}
        />
        {fieldErrors.email ? (
          <TicketFieldAlert id="cf-email-error">{fieldErrors.email}</TicketFieldAlert>
        ) : null}
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <label htmlFor="cf-subject" className={labelClass}>
          Subject
        </label>
        <input
          id="cf-subject"
          type="text"
          name="subject"
          required
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            clearFieldError('subject');
          }}
          disabled={status === 'submitting'}
          placeholder="What is your enquiry about?"
          className={inputClass}
          aria-invalid={fieldErrors.subject ? 'true' : undefined}
          aria-describedby={fieldErrors.subject ? 'cf-subject-error' : undefined}
        />
        {fieldErrors.subject ? (
          <TicketFieldAlert id="cf-subject-error">{fieldErrors.subject}</TicketFieldAlert>
        ) : null}
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <label htmlFor="cf-message" className={labelClass}>
          Message
        </label>
        <textarea
          id="cf-message"
          name="message"
          required
          minLength={10}
          rows={6}
          aria-describedby={fieldErrors.message ? `${HINT_ID} cf-message-error` : HINT_ID}
          aria-invalid={fieldErrors.message ? 'true' : undefined}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            clearFieldError('message');
          }}
          disabled={status === 'submitting'}
          placeholder="Write your message here…"
          className={`${inputClass} resize-y`}
        />
        <p id={HINT_ID} className="font-mono text-[11px] text-muted">
          Minimum 10 characters.
        </p>
        {fieldErrors.message ? (
          <TicketFieldAlert id="cf-message-error">{fieldErrors.message}</TicketFieldAlert>
        ) : null}
      </div>

      {/* Honeypot — visually hidden, tab-unreachable, aria-hidden */}
      <div className="hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input
            type="text"
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

      {/* Inline error */}
      {showError ? (
        <div ref={formError} tabIndex={-1} className="outline-none">
          <TicketFieldAlert id={FORM_ERROR_ID}>{errorMessage}</TicketFieldAlert>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting' || !hydrated}
        className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ink hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
      )}
    </>
  );
}
