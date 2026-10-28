'use client';

import { useEffect, useRef, type FormEvent } from 'react';

import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { useHydrated } from '@/lib/hooks/useHydrated';

interface LoginFormFieldsProps {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  emailError: string;
  notice: string;
  onForgotPassword: () => void;
  disabled: boolean;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

// Matches ContactForm's input/label treatment (components/contact/ContactForm.tsx)
// plus a visible focus ring — the site's own inputs otherwise rely on border colour alone.
const inputClass =
  'min-h-[44px] w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[16px] leading-[23.25px] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary disabled:opacity-60';
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
  emailError,
  notice,
  onForgotPassword,
  disabled,
  loading,
  onSubmit,
}: LoginFormFieldsProps) {
  const hydrated = useHydrated();
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Move focus to whatever just failed, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (emailError) emailRef.current?.focus();
  }, [emailError]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <form method="post" onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          ref={emailRef}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={disabled}
          aria-invalid={emailError ? 'true' : undefined}
          aria-describedby={emailError ? 'login-email-error' : undefined}
          className={`${inputClass} aria-invalid:border-error`}
        />
        {emailError && <TicketFieldAlert id="login-email-error">{emailError}</TicketFieldAlert>}
      </div>

      <div>
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
        <div className="mt-2 text-right">
          <button
            type="button"
            data-testid="admin-forgot-password"
            onClick={onForgotPassword}
            disabled={disabled}
            className="inline-link inline-flex min-h-[44px] items-center px-1 font-sans text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Forgot password?
          </button>
        </div>
      </div>

      {error && (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <TicketFieldAlert>{error}</TicketFieldAlert>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-sm border border-rule bg-bone px-3.5 py-2.5 font-sans text-[14px] text-primary-800"
        >
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || !hydrated}
        className="min-h-[44px] w-full rounded-sm bg-primary px-4 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
