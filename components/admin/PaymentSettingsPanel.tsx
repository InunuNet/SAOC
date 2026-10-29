'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { StatusPill } from '@/components/admin/StatusPill';
import { CARD_CLASS } from '@/components/admin/tokens';
import { FormErrorAlert } from '@/components/ui/FormErrorAlert';
import { formatAdminDateTime } from '@/lib/admin-format';
import { PAYMENT_MODES, SELECTABLE_PAYMENT_MODES, type PaymentMode } from '@/lib/payment-mode';
import type { PaymentSettingsChange } from '@/lib/payment-settings-audit';
import type { GatewayId } from '@/lib/payments/active-gateway';

const GATEWAY_ENDPOINT = '/api/admin/settings/active-payment-gateway';
const TEST_AMOUNT_ENDPOINT = '/api/admin/settings/ozow-sandbox-test-mode';
const GATEWAY_LABELS: Record<GatewayId, string> = { ozow: 'Ozow', payfast: 'PayFast' };
const MODE_LABELS: Record<PaymentMode, string> = { sandbox: 'Sandbox', live: 'Live' };
const NOT_SET = 'not set';
const LIVE_UNAVAILABLE_REASON =
  'Live is not available. Live payment credentials have not been configured, so only Sandbox can be selected.';

interface PaymentSettingsPanelProps {
  initialGateway: GatewayId | null;
  initialTestAmount: boolean;
  recent: PaymentSettingsChange[];
  recentLoadFailed?: boolean;
}

export function PaymentSettingsPanel({
  initialGateway,
  initialTestAmount,
  recent,
  recentLoadFailed = false,
}: PaymentSettingsPanelProps) {
  const router = useRouter();
  const [gateway, setGateway] = useState<GatewayId | null>(initialGateway);
  const [testAmount, setTestAmount] = useState(initialTestAmount);
  const [saving, setSaving] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [testAmountError, setTestAmountError] = useState<string | null>(null);

  async function handleGatewayChange(next: GatewayId) {
    if (next === gateway) return;
    const confirmed = window.confirm(
      `Switch the payment gateway to ${GATEWAY_LABELS[next]}? New orders will use it. Orders already started finish on the gateway they began with.`,
    );
    if (!confirmed) return;
    setSaving(true);
    setGatewayError(null);
    const previous = gateway;
    setGateway(next);
    try {
      const res = await fetch(GATEWAY_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: next, mode: 'sandbox' }),
      });
      if (!res.ok) throw new Error('Request failed');
      router.refresh();
    } catch {
      setGateway(previous);
      setGatewayError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAmountChange(next: boolean) {
    setSaving(true);
    setTestAmountError(null);
    const previous = testAmount;
    setTestAmount(next);
    try {
      const res = await fetch(TEST_AMOUNT_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('Request failed');
      router.refresh();
    } catch {
      setTestAmount(previous);
      setTestAmountError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const testAmountAvailable = gateway === 'ozow';

  return (
    <div className="flex max-w-[520px] flex-col gap-4">
      <div
        role="status"
        className="flex items-center gap-3 rounded-[2px] border border-rule bg-bone px-4 py-3 font-sans text-[14px] text-ink"
      >
        <StatusPill status="Sandbox" tone="pending" />
        <span>Sandbox: these are test payments. No real money moves.</span>
      </div>

      <section className={CARD_CLASS}>
        <span className="block font-sans text-[15px] text-ink">Active payment gateway</span>
        <span className="mt-1 block font-sans text-[13px] text-muted">
          Customers no longer choose a gateway at checkout — this is used for every purchase.
        </span>
        <div className="mt-3 flex gap-4">
          {(Object.keys(GATEWAY_LABELS) as GatewayId[]).map((option) => (
            <label
              key={option}
              className="flex min-h-[44px] items-center gap-2 font-sans text-[15px] text-ink"
            >
              <input
                type="radio"
                name="activeGateway"
                value={option}
                checked={gateway === option}
                disabled={saving}
                onChange={() => void handleGatewayChange(option)}
                className="h-4 w-4 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
              />
              {GATEWAY_LABELS[option]}
            </label>
          ))}
        </div>
        {gateway === null ? (
          <div className="mt-3">
            <FormErrorAlert>No gateway is set — checkout will refuse purchases until one is chosen.</FormErrorAlert>
          </div>
        ) : null}
        {gatewayError ? <ErrorText>{gatewayError}</ErrorText> : null}
      </section>

      <section className={CARD_CLASS}>
        <span className="block font-sans text-[15px] text-ink">Mode</span>
        <div className="mt-3 flex flex-col gap-1">
          {PAYMENT_MODES.map((mode) => {
            const selectable = (SELECTABLE_PAYMENT_MODES as readonly PaymentMode[]).includes(mode);
            return (
              <label
                key={mode}
                className="flex min-h-[44px] items-center gap-2 font-sans text-[15px] text-ink"
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value={mode}
                  checked={mode === 'sandbox'}
                  disabled={!selectable || saving}
                  readOnly
                  onChange={() => undefined}
                  className="h-4 w-4 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
                />
                {MODE_LABELS[mode]}
              </label>
            );
          })}
        </div>
        <p className="mt-1 font-sans text-[13px] text-muted">{LIVE_UNAVAILABLE_REASON}</p>
      </section>

      <section className={CARD_CLASS}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={testAmount}
            disabled={!testAmountAvailable || saving}
            onChange={(e) => void handleTestAmountChange(e.target.checked)}
            className="mt-1 h-4 w-4 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
          />
          <span>
            <span className="block font-sans text-[15px] text-ink">
              Charge R0.01 instead of the displayed price
            </span>
            <span className="mt-1 block font-sans text-[13px] text-muted">
              Ozow Sandbox only. This overrides the amount charged; it is not Ozow&rsquo;s sandbox,
              which is always on. PayFast is unaffected.
            </span>
            {!testAmountAvailable ? (
              <span className="mt-1 block font-sans text-[13px] text-muted">Applies to Ozow only.</span>
            ) : null}
          </span>
        </label>
        {testAmountError ? <ErrorText>{testAmountError}</ErrorText> : null}
      </section>

      <section className={CARD_CLASS}>
        <h2 className="font-sans text-[15px] text-ink">Recent changes</h2>
        {recentLoadFailed ? (
          <div className="mt-3">
            <FormErrorAlert>Recent changes could not be loaded.</FormErrorAlert>
          </div>
        ) : recent.length === 0 ? (
          <p className="mt-2 font-sans text-[13px] text-muted">No changes recorded yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {recent.map((change) => (
              <li key={change.id} className="font-sans text-[13px] text-ink">
                {formatAdminDateTime(change.at)} · {change.byEmail ?? 'unknown'} ·{' '}
                {describeChange(change)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function describeGatewayValue(value: unknown): string {
  return value === 'ozow' || value === 'payfast' ? GATEWAY_LABELS[value] : NOT_SET;
}

function describeFlagValue(value: unknown): string {
  if (value === true) return 'On';
  if (value === false) return 'Off';
  return NOT_SET;
}

function describeChange(change: PaymentSettingsChange): string {
  if (change.setting === 'activePaymentGateway') {
    return `Active payment gateway: ${describeGatewayValue(change.from.gateway)} → ${describeGatewayValue(change.to.gateway)}`;
  }
  return `R0.01 amount: ${describeFlagValue(change.from.enabled)} → ${describeFlagValue(change.to.enabled)}`;
}

// A field error is a left rule plus --status-error text with an aria-hidden icon, never colour
// alone, and is announced to assistive tech.
function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 flex items-start gap-2 border-l-2 border-[var(--status-error)] bg-transparent px-4 font-sans text-[13px] font-medium text-[var(--status-error)]">
      <span aria-hidden="true">✕</span>
      <span>{children}</span>
    </p>
  );
}
