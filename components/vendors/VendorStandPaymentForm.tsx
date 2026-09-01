'use client';

import { useState } from 'react';

import { PayfastRedirectForm } from '@/components/tickets/PayfastRedirectForm';
import {
  VENDOR_STAND_BOOTH_SIZES,
  VENDOR_STAND_BOOTH_SIZE_LABELS,
  VENDOR_STAND_PRICE_ZAR,
  type VendorStandBoothSizeValue,
} from '@/lib/vendor-stand-pricing';
import { VENDOR_STAND_FORFEITURE_NOTICE } from '@/lib/vendor-stand-forfeiture-notice';

interface VendorStandPaymentFormProps {
  token: string;
  businessName: string;
}

interface InitiateResponse {
  processUrl?: string;
  fields?: Record<string, string>;
  amount?: string;
  error?: string;
}

/**
 * F29 (vendor-gated-registration-flow, M3) -- booth-size selector + forfeiture notice + pay
 * control. This selection is INDEPENDENT of whatever VendorSubmission.boothSize may hold (F17
 * is unbuilt and this page does not read it) -- see the golden README "Relationship to
 * M2/F17". The displayed price is read directly from lib/vendor-stand-pricing.ts's pure
 * constant, the SAME source of truth POST /api/vendors/stand-payment/initiate re-derives from
 * server-side -- never trusted for the actual charge, purely a UX preview.
 */
export function VendorStandPaymentForm({ token, businessName }: VendorStandPaymentFormProps) {
  const [boothSize, setBoothSize] = useState<VendorStandBoothSizeValue>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<{ processUrl: string; fields: Record<string, string> } | null>(
    null,
  );

  const price = VENDOR_STAND_PRICE_ZAR[boothSize];
  const pricingConfirmed = price !== null;

  async function handlePay() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/vendors/stand-payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, boothSize }),
      });
      const body = (await res.json()) as InitiateResponse;
      if (!res.ok || !body.processUrl || !body.fields) {
        setError(body.error ?? 'Failed to start payment. Please try again.');
        return;
      }
      setRedirect({ processUrl: body.processUrl, fields: body.fields });
    } catch {
      setError('Failed to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (redirect) {
    return <PayfastRedirectForm processUrl={redirect.processUrl} fields={redirect.fields} />;
  }

  return (
    <div className="space-y-8">
      <p className="font-sans text-[15px] text-ink">
        Stand payment for <strong>{businessName}</strong>.
      </p>

      <fieldset className="space-y-3">
        <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Stand size
        </legend>
        {VENDOR_STAND_BOOTH_SIZES.map((size) => (
          <label
            key={size}
            className="flex items-center gap-3 border border-rule bg-ivory px-4 py-3 font-sans text-[14px] text-ink"
          >
            <input
              type="radio"
              name="boothSize"
              value={size}
              checked={boothSize === size}
              onChange={() => setBoothSize(size)}
            />
            <span>{VENDOR_STAND_BOOTH_SIZE_LABELS[size]}</span>
          </label>
        ))}
      </fieldset>

      <p className="font-sans text-[14px] text-ink">
        {pricingConfirmed
          ? `Price: R${price.toFixed(2)}`
          : 'Pricing for this stand size has not yet been confirmed by the Show Organising Committee.'}
      </p>

      <div className="border border-rule bg-bone px-4 py-3 font-sans text-[13px] text-ink" role="note">
        {VENDOR_STAND_FORFEITURE_NOTICE}
      </div>

      {error && (
        <p className="font-sans text-[14px] text-ink" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={submitting || !pricingConfirmed}
        onClick={handlePay}
        className="rounded-sm border border-rule bg-ivory px-4 py-2 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-parchment disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Starting payment…' : 'Pay Now'}
      </button>
    </div>
  );
}
