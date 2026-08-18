import Link from 'next/link';

import { ConfirmationPoller } from '@/components/tickets/ConfirmationPoller';
import { DownloadTicketButton } from '@/components/tickets/DownloadTicketButton';
import { client } from '@/sanity/lib/client';
import { ticketsPageQuery } from '@/sanity/queries';
import { getConfirmedTicketForDisplay } from '@/lib/orders';

// F1 (confirmation-page-qr-and-download) — this page reads live Firestore via the Admin SDK
// (getConfirmedTicketForDisplay) on every request, so it cannot be statically prerendered or
// ISR-cached — same reasoning as app/(marketing)/tickets/page.tsx's force-dynamic.
export const dynamic = 'force-dynamic';

interface TicketsPageCopy {
  confirmationSuccessHeading?: string | null;
  confirmationSuccessMessage?: string | null;
  ticketIncludesNote?: string | null;
  downloadTicketButtonLabel?: string | null;
}

export default async function TicketConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const bookingRef = ref?.trim() ?? '';

  const confirmedTicket = bookingRef.length > 0 ? await getConfirmedTicketForDisplay(bookingRef) : null;

  if (!confirmedTicket) {
    return <ConfirmationPoller bookingRef={bookingRef} />;
  }

  const copy = await client?.fetch<TicketsPageCopy>(ticketsPageQuery).catch(() => null);
  const confirmationSuccessHeading = copy?.confirmationSuccessHeading ?? "You're booked in";
  const confirmationSuccessMessage =
    copy?.confirmationSuccessMessage ?? 'Thank you — your payment is confirmed.';
  const ticketIncludesNote = copy?.ticketIncludesNote ?? '';
  const downloadTicketButtonLabel = copy?.downloadTicketButtonLabel ?? 'Download ticket';

  const { bookingRef: confirmedRef, attendeeName, ticketType, amount, qrDataUri } = confirmedTicket;

  return (
    <div className="mx-auto max-w-[600px] px-8 py-20 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Paid</p>
      <h1 className="mt-3 font-serif text-[32px] font-medium text-ink">{confirmationSuccessHeading}</h1>
      <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">{confirmationSuccessMessage}</p>

      <img
        src={qrDataUri}
        alt={`QR code for booking reference ${confirmedRef} — scan at the door for check-in`}
        width={240}
        height={240}
        className="mx-auto mt-8"
      />

      <div className="mt-6 space-y-1">
        <p className="font-serif text-[18px] font-medium text-ink">{attendeeName}</p>
        <p className="font-sans text-[14px] text-ink/80">
          {ticketType} · R{amount.toFixed(2)}
        </p>
        <p className="font-mono text-[13px] text-muted">Booking ref: {confirmedRef}</p>
      </div>

      <div className="mt-6">
        <DownloadTicketButton
          bookingRef={confirmedRef}
          attendeeName={attendeeName}
          ticketType={ticketType}
          qrDataUri={qrDataUri}
          label={downloadTicketButtonLabel}
        />
      </div>

      {ticketIncludesNote ? (
        <p className="mt-6 border-t border-rule pt-6 font-sans text-[13px] leading-relaxed text-muted">
          {ticketIncludesNote}
        </p>
      ) : null}

      <Link
        href="/tickets"
        className="mt-8 inline-block font-sans text-[14px] text-ink underline underline-offset-2 hover:text-accent"
      >
        Back to tickets
      </Link>
    </div>
  );
}
