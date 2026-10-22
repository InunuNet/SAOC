'use client';

import { useState } from 'react';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';

type Status = 'idle' | 'submitting' | 'done' | 'error';

export function UnsubscribeConfirm({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleConfirm() {
    if (status === 'submitting') return;
    setStatus('submitting');
    setErrorMessage('');
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setStatus('done');
        return;
      }
      const data: { error?: string } = await res.json().catch(() => ({}));
      setStatus('error');
      setErrorMessage(data.error ?? NEWSLETTER_COPY.genericError);
    } catch {
      setStatus('error');
      setErrorMessage(NEWSLETTER_COPY.genericError);
    }
  }

  return (
    <div>
      <div role="status" aria-live="polite">
        {status === 'done' ? (
          <p className="font-sans text-[16px] leading-[1.55] text-ink">
            {NEWSLETTER_COPY.unsubscribeDone}
          </p>
        ) : null}
      </div>
      {status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border border-primary-800 bg-bone px-4 py-3 font-sans text-[16px] leading-[1.55] text-primary-800"
        >
          {errorMessage}
        </p>
      ) : null}
      {status === 'done' ? null : (
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={status === 'submitting'}
          aria-busy={status === 'submitting'}
          className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ink hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {NEWSLETTER_COPY.unsubscribeConfirm}
        </button>
      )}
    </div>
  );
}
