'use client';

import { useEffect, useState } from 'react';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { CARD_CLASS } from '@/components/admin/tokens';
import type { GatewayId } from '@/lib/payments/active-gateway';

/**
 * /admin/settings -- owner-only Ozow sandbox test-mode toggle (mission ozow-sandbox-toggle F1)
 * plus the active-payment-gateway picker (mission gateway-picker-admin-only F1). Sits inside
 * app/admin/(shell)/settings/layout.tsx's capability gate. Client component: reads/writes each setting
 * via its own admin GET/PUT route, same fetch-from-client pattern as this project's other
 * interactive admin surfaces (e.g. VendorReviewTable's approve/reject actions).
 */
export default function AdminSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gateway, setGateway] = useState<GatewayId | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [gatewaySaving, setGatewaySaving] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings/active-payment-gateway')
      .then((res) => res.json())
      .then((data: { gateway?: GatewayId | null }) => {
        if (!cancelled) setGateway(data.gateway ?? null);
      })
      .catch(() => {
        if (!cancelled) setGatewayError('Failed to load current setting.');
      })
      .finally(() => {
        if (!cancelled) setGatewayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGatewayChange(next: GatewayId) {
    setGatewaySaving(true);
    setGatewayError(null);
    const previous = gateway;
    setGateway(next);
    try {
      const res = await fetch('/api/admin/settings/active-payment-gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: next }),
      });
      if (!res.ok) throw new Error('Request failed');
    } catch {
      setGateway(previous);
      setGatewayError('Failed to save. Please try again.');
    } finally {
      setGatewaySaving(false);
    }
  }

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
    <PageShell>
      <PageHeader title="Settings" />

      <div className="flex max-w-[520px] flex-col gap-4">
        <section className={CARD_CLASS}>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              disabled={loading || saving}
              onChange={(e) => void handleToggle(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-sans text-[15px] text-ink">
                Ozow sandbox test mode
              </span>
              <span className="mt-1 block font-sans text-[13px] text-muted">
                When on, Ozow charges R0.01 instead of the displayed price. PayFast is unaffected.
              </span>
            </span>
          </label>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </section>

        <section className={CARD_CLASS}>
          <span className="block font-sans text-[15px] text-ink">Active payment gateway</span>
          <span className="mt-1 block font-sans text-[13px] text-muted">
            Customers no longer choose a gateway at checkout — this is used for every purchase.
          </span>
          <div className="mt-3 flex gap-4">
            {(['ozow', 'payfast'] as const).map((option) => (
              <label key={option} className="flex min-h-[44px] items-center gap-2 font-sans text-[15px] text-ink">
                <input
                  type="radio"
                  name="activeGateway"
                  value={option}
                  checked={gateway === option}
                  disabled={gatewayLoading || gatewaySaving}
                  onChange={() => void handleGatewayChange(option)}
                  className="h-4 w-4"
                />
                {option === 'ozow' ? 'Ozow' : 'PayFast'}
              </label>
            ))}
          </div>
          {gateway === null && !gatewayLoading ? (
            <ErrorText>No gateway is set — checkout will refuse purchases until one is chosen.</ErrorText>
          ) : null}
          {gatewayError ? <ErrorText>{gatewayError}</ErrorText> : null}
        </section>
      </div>
    </PageShell>
  );
}

// An error is ink text with a ✕ icon, never colour alone, and announced to assistive tech.
function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 flex items-start gap-2 font-sans text-[13px] font-medium text-ink">
      <span aria-hidden="true">✕</span>
      <span>{children}</span>
    </p>
  );
}
