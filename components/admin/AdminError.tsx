'use client';

import { useEffect } from 'react';

import { BUTTON_PRIMARY, CARD_CLASS } from './tokens';
import { PageShell } from './PageHeader';

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Shared error state for the admin error boundaries: plain message, one recovery action. */
export function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error('[admin] route error', {
      operation: 'admin route render',
      exceptionType: error.name,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <PageShell>
      <div role="alert" className={`${CARD_CLASS} max-w-[520px]`}>
        <p className="font-sans text-[15px] text-ink">This page could not be loaded.</p>
        <button type="button" onClick={reset} className={`${BUTTON_PRIMARY} mt-4`}>
          Try again
        </button>
      </div>
    </PageShell>
  );
}
