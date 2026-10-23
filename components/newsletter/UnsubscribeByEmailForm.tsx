'use client';

import { useEffect, useRef, useState } from 'react';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';

type Phase = 'form' | 'sending' | 'result';

// Same shape the server enforces (normaliseNewsletterEmail); checked here so a typo never costs
// a round trip or one of the hourly attempts.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INPUT_ID = 'unsubscribe-email';
const ERROR_ID = 'unsubscribe-email-error';

const PRIMARY_BUTTON =
  'inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ink hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60 disabled:cursor-not-allowed md:w-auto';
const TEXT_BUTTON =
  'inline-flex min-h-11 items-center font-sans text-[14px] text-ink underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory';

// The /unsubscribe page: one email field. The host decides which newsletter is left (server side);
// `site` only picks the intro line.
export function UnsubscribeByEmailForm({ site }: { site: 'saoc' | 'nos' }) {
  const [phase, setPhase] = useState<Phase>('form');
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [error, setError] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'result') resultRef.current?.focus();
  }, [phase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (phase === 'sending') return;
    if (!EMAIL_SHAPE.test(email.trim())) {
      setError(NEWSLETTER_COPY.invalidEmail);
      inputRef.current?.focus();
      return;
    }
    setError('');
    setPhase('sending');
    try {
      const res = await fetch('/api/newsletter/unsubscribe-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, _hp: hp }),
      });
      if (res.ok) {
        setPhase('result');
        return;
      }
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(data.error ?? NEWSLETTER_COPY.genericError);
    } catch {
      setError(NEWSLETTER_COPY.genericError);
    }
    setPhase('form');
    inputRef.current?.focus();
  }

  function another() {
    setEmail('');
    setHp('');
    setError('');
    setPhase('form');
    // The input remounts with the form; focus it once it exists.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (phase === 'result') {
    return (
      <div>
        <div
          ref={resultRef}
          role="status"
          aria-live="polite"
          tabIndex={-1}
          className="font-sans text-[16px] leading-[1.55] text-ink focus:outline-none"
        >
          {NEWSLETTER_COPY.unsubPageResult}
        </div>
        <p className="mt-4">
          <button type="button" onClick={another} className={TEXT_BUTTON}>
            {NEWSLETTER_COPY.unsubPageAnother}
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
      <p className="font-sans text-[16px] leading-[1.55] text-ink">
        {site === 'nos' ? NEWSLETTER_COPY.unsubPageIntroNos : NEWSLETTER_COPY.unsubPageIntroSaoc}
      </p>
      <label htmlFor={INPUT_ID} className="mt-6 block font-sans text-[14px] font-medium text-ink">
        {NEWSLETTER_COPY.unsubPageEmailLabel}
      </label>
      <input
        id={INPUT_ID}
        ref={inputRef}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={error === '' ? undefined : 'true'}
        aria-describedby={error === '' ? undefined : ERROR_ID}
        className="mt-2 block min-h-11 w-full rounded-sm border border-rule bg-ivory px-3 py-2 font-sans text-[16px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
      />
      {error === '' ? null : (
        <p id={ERROR_ID} role="alert" className="mt-2 font-sans text-[14px] leading-[1.55] text-primary-800">
          {error}
        </p>
      )}
      <div hidden className="hidden" aria-hidden="true">
        <label>
          {NEWSLETTER_COPY.honeypotLabel}
          <input
            type="text"
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(event) => setHp(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-6">
        <button type="submit" disabled={phase === 'sending'} aria-busy={phase === 'sending'} className={PRIMARY_BUTTON}>
          {NEWSLETTER_COPY.unsubPageButton}
        </button>
      </div>
    </form>
  );
}
