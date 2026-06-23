'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
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
      setErrorMessage('Please write a message of at least 10 characters.');
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

  if (status === 'success') {
    return (
      <div className="border border-rule bg-parchment p-8">
        <h3 className="font-serif text-[22px] font-semibold text-ink">Thank you</h3>
        <p className="mt-3 font-sans text-[15px] leading-relaxed text-ink/80">
          Your message has reached the SAOC secretariat. We&apos;ll be in touch soon.
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none focus:border-ink/40 transition-colors disabled:opacity-60';
  const labelClass = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted';

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="cf-name" className={labelClass}>
          Name
        </label>
        <input
          id="cf-name"
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
        <label htmlFor="cf-email" className={labelClass}>
          Email address
        </label>
        <input
          id="cf-email"
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
          onChange={(e) => setSubject(e.target.value)}
          disabled={status === 'submitting'}
          placeholder="What is your enquiry about?"
          className={inputClass}
        />
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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={status === 'submitting'}
          placeholder="Write your message here…"
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
        <p role="alert" className="font-sans text-[14px] text-[var(--accent)]">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory hover:bg-accent-soft transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
