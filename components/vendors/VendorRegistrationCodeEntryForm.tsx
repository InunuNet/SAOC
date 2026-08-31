'use client';

import { useState } from 'react';

import { VendorFormField } from './VendorFormField';

/**
 * F23 (vendor-gated-registration-flow, M4) -- the gate in front of the full registration form.
 * TWO structured fields (business name + 4-digit code), not one free-text field parsed by
 * splitting on a hyphen -- business names can legitimately contain hyphens ("Cape-Town
 * Orchids"), which would make splitting a single string ambiguous. See
 * contracts/golden/vendor-gated-registration-flow-m4/README.md's "Format" section.
 *
 * POSTs to /api/vendors/register/verify-code, which sets an HttpOnly session cookie on
 * success -- this component never sees or handles that artifact. On success it reloads the
 * page so the gated registration page's server component re-evaluates the cookie and renders
 * VendorRegisterForm; a submit alone is never itself the gate.
 */

interface VendorRegistrationCodeEntryFormProps {
  initialBusinessName?: string;
  initialCodeId?: string;
}

type Status = 'idle' | 'submitting' | 'error';

const GENERIC_ERROR_FALLBACK = 'Something went wrong. Please try again.';

export function VendorRegistrationCodeEntryForm({
  initialBusinessName = '',
  initialCodeId = '',
}: VendorRegistrationCodeEntryFormProps) {
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [codeId, setCodeId] = useState(initialCodeId);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/vendors/register/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, codeId }),
      });
      const body = (await res.json().catch(() => undefined)) as { ok?: boolean; error?: string } | undefined;

      if (res.ok && body?.ok) {
        // The session cookie is already set by the response above -- reload so the server
        // component re-checks it and renders the full form. Never render the form from client
        // state alone; the server-side cookie check remains the only gate.
        window.location.reload();
        return;
      }

      setStatus('error');
      setErrorMessage(body?.error ?? GENERIC_ERROR_FALLBACK);
    } catch {
      setStatus('error');
      setErrorMessage('Failed to reach the server. Please try again.');
    }
  }

  const disabled = status === 'submitting';

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <p className="font-sans text-[15px] leading-relaxed text-ink/80">
        Enter your business name and the 4-digit code from your approval email to continue to
        the full registration form.
      </p>

      {status === 'error' && errorMessage ? (
        <p role="alert" className="rounded-sm border border-primary-800 bg-bone p-4 font-sans text-[15px] font-medium text-primary-800">
          {errorMessage}
        </p>
      ) : null}

      <VendorFormField
        fieldKey="code-entry-business-name"
        label="Business name"
        htmlType="text"
        value={businessName}
        onChange={setBusinessName}
        disabled={disabled}
        required
        maxLength={200}
      />

      <div className="space-y-1.5">
        <label htmlFor="vendor-register-code-entry-code" className="font-mono text-[11px] tracking-[0.16em] text-muted">
          4-digit code
        </label>
        <input
          id="vendor-register-code-entry-code"
          name="codeId"
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          required
          value={codeId}
          onChange={(e) => setCodeId(e.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={disabled}
          placeholder="0000"
          className="w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] tracking-[0.3em] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory hover:bg-accent-soft transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
      >
        {status === 'submitting' ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}
