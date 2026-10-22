'use client';

import { useRef, useState } from 'react';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface NewsletterSignupProps {
  source: 'saoc-footer' | 'nos-footer';
  emailLabel: string;
  placeholder: string;
  submitLabel: string;
  /** Keeps each footer's existing ids stable. */
  inputId: string;
  formId?: string;
  /** Each footer keeps its own markup classes (SAOC Tailwind, NOS `nf-*`). */
  formClassName?: string;
  /** Wraps the input and button only, so the label and status sit outside a flex row. */
  fieldsClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  statusClassName?: string;
  errorClassName?: string;
}

export function NewsletterSignup({
  source,
  emailLabel,
  placeholder,
  submitLabel,
  inputId,
  formId,
  formClassName,
  fieldsClassName,
  labelClassName,
  inputClassName,
  buttonClassName,
  statusClassName,
  errorClassName,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [emailInvalid, setEmailInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const errorId = `${inputId}-error`;
  const showError = status === 'error' && errorMessage !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage('');
    setEmailInvalid(false);

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, _hp: hp }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
        return;
      }
      const data: { error?: string; field?: string } = await res.json().catch(() => ({}));
      setStatus('error');
      setEmailInvalid(data.field === 'email');
      setErrorMessage(data.error ?? NEWSLETTER_COPY.genericError);
      inputRef.current?.focus();
    } catch {
      setStatus('error');
      setErrorMessage(NEWSLETTER_COPY.genericError);
      inputRef.current?.focus();
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className={formClassName}>
      <label htmlFor={inputId} className={labelClassName}>
        {emailLabel}
      </label>
      <div className={fieldsClassName}>
        <input
          id={inputId}
        ref={inputRef}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          aria-invalid={emailInvalid ? 'true' : undefined}
          aria-describedby={showError ? errorId : undefined}
          className={inputClassName}
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          aria-busy={status === 'submitting'}
          className={buttonClassName}
        >
          {submitLabel}
        </button>
      </div>
      <div hidden className="hidden" aria-hidden="true">
        <label>
          {NEWSLETTER_COPY.honeypotLabel}
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
      {/* One polite live region, in the DOM before submit, announces the success line and any
          error. Focus returns to the input on error. */}
      <div role="status" aria-live="polite" className={statusClassName}>
        {status === 'success' ? NEWSLETTER_COPY.success : null}
        {showError ? (
          <p id={errorId} className={errorClassName}>
            {errorMessage}
          </p>
        ) : null}
      </div>
    </form>
  );
}
