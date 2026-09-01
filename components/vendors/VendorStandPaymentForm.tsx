'use client';

import { useState } from 'react';

import { PayfastRedirectForm } from '@/components/tickets/PayfastRedirectForm';
import {
  VENDOR_STAND_BOOTH_SIZES,
  VENDOR_STAND_BOOTH_SIZE_LABELS,
  VENDOR_STAND_EARLY_BIRD_DISCOUNT_PERCENT,
  VENDOR_STAND_PER_STAND_RATE_ZAR_CENTS,
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

  // Both prices shown here, standard AND early-bird -- which one actually applies depends on
  // the active show's real cutoff date, which this client component has no access to (it's
  // resolved server-side from Sanity). This is purely a UX preview, computed from the two
  // confirmed pure constants; never trusted for the actual charge -- POST
  // /api/vendors/stand-payment/initiate re-derives amount + tier server-side independently,
  // including the "no active show configured" refusal, surfaced via `error` on submit.
  const standardCents = VENDOR_STAND_PER_STAND_RATE_ZAR_CENTS * boothSize;
  const earlyBirdCents = Math.round(
    (standardCents * (100 - VENDOR_STAND_EARLY_BIRD_DISCOUNT_PERCENT)) / 100,
  );

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
        {`Price: R${(standardCents / 100).toFixed(2)} (R${(earlyBirdCents / 100).toFixed(2)} early-bird) — exact rate confirmed at payment.`}
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
        disabled={submitting}
        onClick={handlePay}
        className="rounded-sm border border-rule bg-ivory px-4 py-2 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-parchment disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Starting payment…' : 'Pay Now'}
      </button>
    </div>
  );
}
