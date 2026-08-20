import Link from 'next/link';

import { ConfirmationPoller } from '@/components/tickets/ConfirmationPoller';
import { DownloadTicketButton } from '@/components/tickets/DownloadTicketButton';
import { client } from '@/sanity/lib/client';
import { ticketsPageQuery } from '@/sanity/queries';
import { getConfirmedOrderForDisplay } from '@/lib/orders';

// F1 (confirmation-page-qr-and-download) — this page reads live Firestore via the Admin SDK
// (getConfirmedOrderForDisplay, ticketing-multi-line-item-cart-ui F3) on every request, so it
// cannot be statically prerendered or ISR-cached — same reasoning as
// app/(marketing)/tickets/page.tsx's force-dynamic.
export const dynamic = 'force-dynamic';

export function normalizeBookingRefParam(ref: string | string[] | undefined): string {
  return typeof ref === 'string' ? ref.trim() : '';
}

interface TicketsPageCopy {
  confirmationSuccessHeading?: string | null;
  confirmationSuccessMessage?: string | null;
  ticketIncludesNote?: string | null;
  downloadTicketButtonLabel?: string | null;
}

export default async function TicketConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await searchParams;
  const bookingRef = normalizeBookingRefParam(ref);

  const confirmedOrder = bookingRef.length > 0 ? await getConfirmedOrderForDisplay(bookingRef) : null;

  if (!confirmedOrder) {
    return <ConfirmationPoller bookingRef={bookingRef} />;
  }

  const copy = await client?.fetch<TicketsPageCopy>(ticketsPageQuery).catch(() => null);
  const confirmationSuccessHeading = copy?.confirmationSuccessHeading ?? "You're booked in";
  const confirmationSuccessMessage =
    copy?.confirmationSuccessMessage ?? 'Thank you — your payment is confirmed.';
  const ticketIncludesNote = copy?.ticketIncludesNote ?? '';
  const downloadTicketButtonLabel = copy?.downloadTicketButtonLabel ?? 'Download ticket';

  const { positions } = confirmedOrder;
  const orderTotal = positions.reduce((sum, position) => sum + position.amount, 0);

  return (
    <div className="mx-auto max-w-[600px] px-8 py-20 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Paid</p>
      <h1 className="mt-3 font-serif text-[32px] font-medium text-ink">{confirmationSuccessHeading}</h1>
      <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">{confirmationSuccessMessage}</p>
      <p className="mt-4 font-sans text-[15px] font-medium text-ink">
        {positions.length} {positions.length === 1 ? 'ticket' : 'tickets'} · Total R{orderTotal.toFixed(2)}
      </p>

      <div className="mt-8 space-y-10">
        {positions.map((position) => (
          <div key={position.bookingRef} className="border-t border-rule pt-8 first:border-t-0 first:pt-0">
            <img
              src={position.qrDataUri}
              alt={`QR code for booking reference ${position.bookingRef} — scan at the door for check-in`}
              width={240}
              height={240}
              className="mx-auto"
            />

            <div className="mt-6 space-y-1">
              <p className="font-serif text-[18px] font-medium text-ink">{position.attendeeName}</p>
              <p className="font-sans text-[14px] text-ink/80">
                {position.ticketType} · R{position.amount.toFixed(2)}
              </p>
              <p className="font-mono text-[13px] text-muted">Booking ref: {position.bookingRef}</p>
            </div>

            <div className="mt-6">
              <DownloadTicketButton
                bookingRef={position.bookingRef}
                attendeeName={position.attendeeName}
                ticketType={position.ticketType}
                qrDataUri={position.qrDataUri}
                label={downloadTicketButtonLabel}
              />
            </div>
          </div>
        ))}
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
