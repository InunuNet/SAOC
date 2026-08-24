'use client';

import { useEffect, useState } from 'react';

/**
 * /admin/settings -- owner-only Ozow sandbox test-mode toggle (mission ozow-sandbox-toggle F1).
 * Sits inside app/admin/settings/layout.tsx's capability gate. Client component: reads/writes
 * the flag via the admin GET/PUT route, same fetch-from-client pattern as this project's other
 * interactive admin surfaces (e.g. VendorReviewTable's approve/reject actions).
 */
export default function AdminSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings/ozow-sandbox-test-mode')
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setEnabled(data.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load current setting.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(next: boolean) {
    setSaving(true);
    setError(null);
    const previous = enabled;
    setEnabled(next);
    try {
      const res = await fetch('/api/admin/settings/ozow-sandbox-test-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('Request failed');
    } catch {
      setEnabled(previous);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
        <span className="eyebrow">Admin</span>
        <h1 className="mt-4 font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
          Payment Settings
        </h1>

        <div className="mt-8 max-w-[520px] border border-rule bg-bone px-6 py-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              disabled={loading || saving}
              onChange={(e) => void handleToggle(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-sans text-[15px] text-ink">
                Ozow sandbox test mode
              </span>
              <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                When on, Ozow charges R0.01 instead of the displayed price. PayFast is unaffected.
              </span>
            </span>
          </label>
          {error ? (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
