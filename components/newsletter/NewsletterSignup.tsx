'use client';

import { useState } from 'react';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface NewsletterSignupProps {
  source: 'saoc-footer' | 'nos-footer';
  emailLabel: string;
  placeholder: string;
  submitLabel: string;
  /** Each footer keeps its own markup classes (SAOC Tailwind, NOS `nf-*`). */
  formClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  statusClassName?: string;
  errorClassName?: string;
}

const INPUT_ID_PREFIX = 'newsletter-email';

export function NewsletterSignup({
  source,
  emailLabel,
  placeholder,
  submitLabel,
  formClassName,
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

  const inputId = `${INPUT_ID_PREFIX}-${source}`;
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
    } catch {
      setStatus('error');
      setErrorMessage(NEWSLETTER_COPY.genericError);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={formClassName}>
      <label htmlFor={inputId} className={labelClassName}>
        {emailLabel}
      </label>
      <input
        id={inputId}
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        aria-invalid={emailInvalid ? 'true' : undefined}
        aria-describedby={showError ? errorId : undefined}
        className={inputClassName}
      />
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
      <button
        type="submit"
        disabled={status === 'submitting'}
        aria-busy={status === 'submitting'}
        className={buttonClassName}
      >
        {submitLabel}
      </button>
      {/* Live region present before submit so the success line is announced when it arrives. */}
      <div role="status" aria-live="polite" className={statusClassName}>
        {status === 'success' ? NEWSLETTER_COPY.success : null}
      </div>
      {showError ? (
        <p id={errorId} role="alert" className={errorClassName}>
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
