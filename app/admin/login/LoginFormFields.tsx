'use client';

import type { FormEvent } from 'react';

interface LoginFormFieldsProps {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  disabled: boolean;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

// Matches ContactForm's input/label treatment (components/contact/ContactForm.tsx)
// plus a visible focus ring — the site's own inputs otherwise rely on border colour alone.
const inputClass =
  'w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60';
const labelClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';

/**
 * Presentational only — the password sign-in submit handler and the mintSession()
 * convergence onto /api/admin/session both live in app/admin/login/page.tsx. This
 * component exists purely to keep page.tsx under the project's 150-line cap; it must
 * never grow its own fetch/session logic.
 */
export function LoginFormFields({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  error,
  disabled,
  loading,
  onSubmit,
}: LoginFormFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={disabled}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          disabled={disabled}
          className={inputClass}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-sm border border-rule bg-bone px-3.5 py-2.5 font-sans text-[14px] text-primary-800"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-sm bg-primary px-4 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
