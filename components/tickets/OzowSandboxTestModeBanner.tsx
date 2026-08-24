'use client';

import { useEffect, useState } from 'react';

import { OZOW_SANDBOX_TEST_MODE_BANNER_TEXT } from '@/lib/ozow-sandbox-test-mode-shared';

/**
 * Mission ozow-sandbox-toggle F1. Polls the public, unauthenticated status route once on mount
 * and renders a visible banner when Ozow sandbox test mode is on. Renders nothing while the
 * status is unknown or reports `enabled: false` -- fail-closed on the client mirrors the
 * server-side fail-closed read in lib/ozow-sandbox-test-mode.ts. See
 * contracts/golden/ozow-sandbox-toggle-f1/README.md §5.
 */
export function OzowSandboxTestModeBanner() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tickets/ozow-sandbox-test-mode')
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setEnabled(data.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      role="status"
      className="border border-rule bg-bone px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink"
    >
      {OZOW_SANDBOX_TEST_MODE_BANNER_TEXT}
    </div>
  );
}
