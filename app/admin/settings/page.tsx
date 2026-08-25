'use client';

import { useEffect, useState } from 'react';

import type { GatewayId } from '@/lib/payments/active-gateway';

/**
 * /admin/settings -- owner-only Ozow sandbox test-mode toggle (mission ozow-sandbox-toggle F1)
 * plus the active-payment-gateway picker (mission gateway-picker-admin-only F1). Sits inside
 * app/admin/settings/layout.tsx's capability gate. Client component: reads/writes each setting
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
              <span className="mt-1 block font-mono text-[11px] tracking-[0.16em] text-muted">
                When on, Ozow charges R0.01 instead of the displayed price. PayFast is unaffected.
              </span>
            </span>
          </label>
          {error ? (
            <p className="mt-3 font-mono text-[11px] tracking-[0.16em] text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 max-w-[520px] border border-rule bg-bone px-6 py-6">
          <span className="block font-sans text-[15px] text-ink">Active payment gateway</span>
          <span className="mt-1 block font-mono text-[11px] tracking-[0.16em] text-muted">
            Customers no longer choose a gateway at checkout — this is used for every purchase.
          </span>
          <div className="mt-3 flex gap-4">
            {(['ozow', 'payfast'] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 font-sans text-[15px] text-ink">
                <input
                  type="radio"
                  name="activeGateway"
                  value={option}
                  checked={gateway === option}
                  disabled={gatewayLoading || gatewaySaving}
                  onChange={() => void handleGatewayChange(option)}
                />
                {option === 'ozow' ? 'Ozow' : 'PayFast'}
              </label>
            ))}
          </div>
          {gateway === null && !gatewayLoading ? (
            <p className="mt-3 font-mono text-[11px] tracking-[0.16em] text-red-700">
              No gateway is set — checkout will refuse purchases until one is chosen.
            </p>
          ) : null}
          {gatewayError ? (
            <p className="mt-3 font-mono text-[11px] tracking-[0.16em] text-red-700">
              {gatewayError}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
