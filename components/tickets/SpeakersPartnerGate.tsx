'use client';

// The password prompt in front of the hidden Speakers Partner ticket. The password is checked
// on the server (POST /api/tickets/speakers-partner/auth); this component only sends it and
// refreshes the page once the server has set the access cookie.
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ArrowIcon } from '@/components/tickets/keepsake/parts';
import { TicketFieldAlert, TicketFormField } from '@/components/tickets/TicketFormField';
import { SPEAKERS_PARTNER_AUTH_ROUTE } from '@/lib/speakers-partner';

const FIELD_ID = 'speakers-partner-password';
const NETWORK_ERROR = 'We could not check the password. Please try again.';

export function SpeakersPartnerGate() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(SPEAKERS_PARTNER_AUTH_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? NETWORK_ERROR);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="nk-checkout grid max-w-md gap-3" noValidate>
      <TicketFormField
        id={FIELD_ID}
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        disabled={submitting}
      />
      {error ? <TicketFieldAlert>{error}</TicketFieldAlert> : null}
      <button type="submit" className="nk-btn nk-cta" disabled={submitting || password === ''}>
        Continue
        <ArrowIcon />
      </button>
    </form>
  );
}
