'use client';

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
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={onRequestLink}
        aria-label="Get vendor photo upload link and copy it to the clipboard"
        className="rounded-sm border border-rule bg-ivory px-3 py-1.5 font-sans text-[13px] font-medium text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-50"
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
          className="w-56 rounded-sm border border-rule bg-bone px-2 py-1 font-mono text-[11px] text-ink"
        />
      )}
    </div>
  );
}
