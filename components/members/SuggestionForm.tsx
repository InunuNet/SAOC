'use client';

// =============================================================
// SAOC — components/members/SuggestionForm.tsx
// Client Component — Members Portal suggestion/feature-request box.
// Deliberately NOT a member account form: no auth, no journal access,
// just name/email/suggestion. Mirrors components/contact/ContactForm.tsx
// field-for-field (labels, states, honeypot, validation) and reuses the
// SAME /api/contact endpoint + contactSubmissions collection, marking
// each submission via a fixed `subject` value rather than adding a new
// collection or API route.
// =============================================================

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const SUGGESTION_SUBJECT = 'Members Portal suggestion';

export function SuggestionForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState(''); // honeypot — never sent to the API
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    // 1. Honeypot — if filled, a bot did it. Show generic error, DO NOT call the API.
    if (hp.trim() !== '') {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
      return;
    }

    // 2. Client guard mirrors the API (cheap UX, API is still source of truth)
    if (message.trim().length < 10) {
      setStatus('error');
      setErrorMessage('Please write a suggestion of at least 10 characters.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject: SUGGESTION_SUBJECT, message }),
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

  if (status === 'success') {
    return (
      <div className="border border-rule bg-parchment p-8">
        <h3 className="font-serif text-[22px] font-semibold text-ink">Thank you</h3>
        <p className="mt-3 font-sans text-[15px] leading-relaxed text-ink/80">
          Your suggestion has reached the SAOC secretariat. We&apos;ll take it into account as
          the Members Portal is built.
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none focus:border-ink/40 transition-colors disabled:opacity-60';
  const labelClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="msf-name" className={labelClass}>
          Name
        </label>
        <input
          id="msf-name"
          type="text"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={status === 'submitting'}
          placeholder="Your name"
          className={inputClass}
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="msf-email" className={labelClass}>
          Email address
        </label>
        <input
          id="msf-email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting'}
          placeholder="your@email.co.za"
          className={inputClass}
        />
      </div>

      {/* Suggestion */}
      <div className="space-y-1.5">
        <label htmlFor="msf-message" className={labelClass}>
          Your suggestion
        </label>
        <textarea
          id="msf-message"
          name="message"
          required
          minLength={10}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={status === 'submitting'}
          placeholder="What would you want the Members Portal to do?"
          className={`${inputClass} resize-y`}
        />
        <p className="font-mono text-[11px] text-muted">Minimum 10 characters.</p>
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
      {status === 'error' && errorMessage ? (
        <p role="alert" className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[14px] text-primary-800">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending…' : 'Send suggestion'}
      </button>
    </form>
  );
}
