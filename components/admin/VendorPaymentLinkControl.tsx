'use client';

import { BUTTON_SECONDARY } from './tokens';

interface VendorPaymentLinkControlProps {
  isPending: boolean;
  paymentUrl: string | null;
  onRequestLink: () => void;
}

/**
 * Hotfix (contracts/golden/vendor-stand-payment-link-visibility, 2026-09-01) -- the
 * escape-hatch control that lets an admin fetch and copy a vendor's stand-payment link
 * directly, without depending on the (currently broken) confirmation email. Extracted from
 * VendorReviewTable.tsx to keep that component under the 150-line limit
 * (.claude/rules/coding.md). Loading/error state stays owned by VendorReviewTable
 * (pendingId/error, the same pattern used for the review actions) -- this component only
 * renders and performs the clipboard-write side effect.
 */
export function VendorPaymentLinkControl({
  isPending,
  paymentUrl,
  onRequestLink,
}: VendorPaymentLinkControlProps) {
  return (
    <div className="flex w-full flex-col gap-1 sm:w-60">
      <button
        type="button"
        disabled={isPending}
        onClick={onRequestLink}
        aria-label="Get vendor stand payment link and copy it to the clipboard"
        className={BUTTON_SECONDARY}
      >
        {isPending ? 'Generating…' : paymentUrl ? 'Copy payment link' : 'Get payment link'}
      </button>
      {paymentUrl && (
        <input
          type="text"
          readOnly
          value={paymentUrl}
          aria-label="Vendor stand payment link"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-[2px] border border-rule bg-bone px-2 py-1 font-mono text-[16px] leading-[17.05px] text-ink"
        />
      )}
    </div>
  );
}
