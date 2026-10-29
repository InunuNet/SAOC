'use client';

import { useEffect } from 'react';
import { CircleAlert } from 'lucide-react';

import { BUTTON_PRIMARY } from './tokens';
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
      <div role="alert" className="max-w-[520px] rounded-[2px] border-2 border-[var(--status-error)] p-6">
        <p className="flex items-start gap-2 font-sans text-[15px] font-medium text-[var(--status-error)]">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>This page could not be loaded.</span>
        </p>
        <button type="button" onClick={reset} className={`${BUTTON_PRIMARY} mt-4`}>
          Try again
        </button>
      </div>
    </PageShell>
  );
}
