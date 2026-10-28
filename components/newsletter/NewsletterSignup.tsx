'use client';

import { useRef, useState, type ReactNode } from 'react';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { FOOTER_HEADINGS } from '@/components/chrome/footer-data';
import type { NewsletterTopic } from '@/lib/newsletter';
import { useHydrated } from '@/lib/hooks/useHydrated';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface NewsletterSignupProps {
  site: 'saoc' | 'nos';
  /** True on the beta preview, where unsupplied copy shows as a visible COPY GAP; decided on the server. */
  showCopyGap: boolean;
  source: 'saoc-footer' | 'nos-footer';
  emailLabel: string;
  placeholder: string;
  submitLabel: string;
  /** Keeps each footer's existing ids stable. */
  inputId: string;
  formId?: string;
  /** Each footer keeps its own markup classes (SAOC Tailwind, NOS `nf-*`). */
  formClassName?: string;
  /** Wraps the email input, topic chooser and button; label and status sit outside. */
  fieldsClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  statusClassName?: string;
  errorClassName?: string;
  errorIcon?: ReactNode;
}

export function NewsletterSignup({
  site,
  showCopyGap,
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
  errorIcon,
}: NewsletterSignupProps) {
  const hydrated = useHydrated();
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [topics, setTopics] = useState<NewsletterTopic[]>([site]);
  const [topicsInvalid, setTopicsInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstTopicRef = useRef<HTMLInputElement>(null);

  const errorId = `${inputId}-error`;
  const topicsErrorId = `${inputId}-topics-error`;
  const showError = status === 'error' && errorMessage !== '';
  const orderedTopics: NewsletterTopic[] = site === 'nos' ? ['nos', 'saoc'] : ['saoc', 'nos'];

  function toggleTopic(topic: NewsletterTopic, checked: boolean) {
    setTopics((current) => checked ? [...current, topic] : current.filter((item) => item !== topic));
    if (checked) setTopicsInvalid(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    if (topics.length === 0) {
      setTopicsInvalid(true);
      firstTopicRef.current?.focus();
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    setEmailInvalid(false);
    setTopicsInvalid(false);

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, topics, _hp: hp }),
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
      if (data.field === 'topics') {
        setTopicsInvalid(true);
        firstTopicRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    } catch {
      setStatus('error');
      setErrorMessage(NEWSLETTER_COPY.genericError);
      inputRef.current?.focus();
    }
  }

  return (
    <form id={formId} method="post" onSubmit={handleSubmit} noValidate className={formClassName}>
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
        <fieldset className="mt-2 w-full basis-full">
          <legend className="sr-only">{FOOTER_HEADINGS.touch}</legend>
          <div className="flex flex-col">
            {orderedTopics.map((topic, index) => (
              <label key={topic} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 font-sans text-[16px] ${site === 'nos' ? 'text-[var(--nc-ground)]' : 'text-ivory'}`}>
                <input
                  ref={index === 0 ? firstTopicRef : undefined}
                  type="checkbox"
                  name="topics"
                  value={topic}
                  checked={topics.includes(topic)}
                  onChange={(event) => toggleTopic(topic, event.target.checked)}
                  aria-invalid={topicsInvalid ? 'true' : undefined}
                  aria-describedby={topicsInvalid ? topicsErrorId : undefined}
                  className="size-6 shrink-0 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ivory"
                  style={site === 'nos' ? { accentColor: 'var(--nc-gold)' } : undefined}
                />
                {topic === 'saoc' ? NEWSLETTER_COPY.topicLabelSaoc : NEWSLETTER_COPY.topicLabelNos}
              </label>
            ))}
          </div>
          {topicsInvalid ? (
            showCopyGap ? (
              <p id={topicsErrorId} role="alert" className={`mt-1.5 border-l-2 px-4 font-sans text-[14px] text-ivory ${site === 'nos' ? 'border-error' : 'border-[var(--status-error-on-dark)]'}`}>
                <span aria-hidden="true">⚠︎</span>{' '}
                <span>COPY GAP — AI-generated placeholder: Select at least one newsletter topic.</span>
              </p>
            ) : (
              <p id={topicsErrorId} role="alert" className="sr-only">
                {NEWSLETTER_COPY.genericError}
              </p>
            )
          ) : null}
        </fieldset>
        <button
          type="submit"
          disabled={status === 'submitting' || !hydrated}
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
            {errorIcon}
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
