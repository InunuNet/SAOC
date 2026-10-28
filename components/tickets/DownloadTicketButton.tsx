// ticket-pdf (F1) — the confirmation-page download is the branded A4 PDF served by
// GET /api/tickets/pdf. It supersedes the earlier Canvas-composited PNG card (see the golden's
// "Download format decision", superseded by Brad's request via Codi's ruling, 2026-10-22).
// The link carries the order reference (the page's existing proof of ownership) and this
// ticket's booking reference to select its single page.

interface DownloadTicketButtonProps {
  orderReference: string;
  bookingRef: string;
  attendeeName: string;
  label: string;
}

export function DownloadTicketButton({
  orderReference,
  bookingRef,
  attendeeName,
  label,
}: DownloadTicketButtonProps) {
  const href = `/api/tickets/pdf?ref=${encodeURIComponent(orderReference)}&position=${encodeURIComponent(bookingRef)}`;

  return (
    <a
      href={href}
      download
      aria-label={`Download ticket for ${attendeeName} as a PDF`}
      className="inline-block rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
    >
      {label}
    </a>
  );
}
