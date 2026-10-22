'use client';

import { BUTTON_SECONDARY } from './tokens';

interface VendorPhotoLinkControlProps {
  isPending: boolean;
  photoUrl: string | null;
  onRequestLink: () => void;
}

/**
 * Admin escape hatch (mission vendor-flow-fixes, F2) -- fetches and copies a fresh photo
 * upload link for a vendor whose registration-received email never arrived or was lost.
 * Styling mirrors VendorPaymentLinkControl.tsx; loading/error state stays owned by
 * VendorReviewTable (pendingId/error).
 */
export function VendorPhotoLinkControl({
  isPending,
  photoUrl,
  onRequestLink,
}: VendorPhotoLinkControlProps) {
  return (
    <div className="flex w-full flex-col gap-1 sm:w-60">
      <button
        type="button"
        disabled={isPending}
        onClick={onRequestLink}
        aria-label="Get vendor photo upload link and copy it to the clipboard"
        className={BUTTON_SECONDARY}
      >
        {isPending ? 'Generating…' : photoUrl ? 'Copy photo upload link' : 'Get photo upload link'}
      </button>
      {photoUrl && (
        <input
          type="text"
          readOnly
          value={photoUrl}
          aria-label="Vendor photo upload link"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-[2px] border border-rule bg-bone px-2 py-1 font-mono text-[16px] leading-[17.05px] text-ink"
        />
      )}
    </div>
  );
}
