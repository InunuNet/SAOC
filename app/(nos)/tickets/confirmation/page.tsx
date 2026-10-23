import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';

import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ConfirmationPoller } from '@/components/tickets/ConfirmationPoller';
import { DownloadTicketButton } from '@/components/tickets/DownloadTicketButton';
import { client } from '@/sanity/lib/client';
import { ticketsPageQuery } from '@/sanity/queries';
import { normalizeBookingRefParam } from '@/lib/booking-ref';
import { getConfirmedOrderForDisplay as getConfirmedOrderUncached } from '@/lib/orders';
import { getTicketStatus } from '@/lib/ticket-status';

// F1 (confirmation-page-qr-and-download) — this page reads live Firestore via the Admin SDK
// (getConfirmedOrderForDisplay, ticketing-multi-line-item-cart-ui F3) on every request, so it
// cannot be statically prerendered or ISR-cached — same reasoning as
// app/(nos)/tickets/page.tsx's force-dynamic.
export const dynamic = 'force-dynamic';

interface TicketsPageCopy {
  confirmationSuccessHeading?: string | null;
  confirmationSuccessMessage?: string | null;
  ticketIncludesNote?: string | null;
  downloadTicketButtonLabel?: string | null;
  confirmationNotFoundMessage?: string | null;
}

const BOOKING_NOT_FOUND_TITLE = 'Booking not found';

// nos-critique-r19 F1 — generateMetadata and the page share one lookup per request.
const getConfirmedOrderForDisplay = cache(getConfirmedOrderUncached);
const getCachedTicketStatus = cache(getTicketStatus);

// Not found = no confirmed order AND (an empty ref, or no ticket status for the ref): the same
// lookup /api/tickets/status uses. A failed lookup is not "not found"; the caller keeps the poller.
const isBookingNotFound = cache(async (bookingRef: string): Promise<boolean> => {
  if (bookingRef.length === 0) return true;
  try {
    return (await getCachedTicketStatus(bookingRef)) === null;
  } catch (error) {
    console.error('[tickets/confirmation] Failed to look up ticket status:', error);
    return false;
  }
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}): Promise<Metadata> {
  const { ref } = await searchParams;
  const bookingRef = normalizeBookingRefParam(ref);
  try {
    const confirmedOrder =
      bookingRef.length > 0 ? await getConfirmedOrderForDisplay(bookingRef) : null;
    if (confirmedOrder) return {};
  } catch {
    // The page surfaces the order lookup's error itself; the title keeps the site default.
    return {};
  }
  return (await isBookingNotFound(bookingRef)) ? { title: BOOKING_NOT_FOUND_TITLE } : {};
}

async function BookingNotFound() {
  const copy = await client?.fetch<TicketsPageCopy>(ticketsPageQuery).catch(() => null);
  const confirmationNotFoundMessage =
    copy?.confirmationNotFoundMessage ?? "We couldn't find a booking for that reference.";

  return (
    <>
      <NosHero
        route="/tickets/confirmation"
        title={BOOKING_NOT_FOUND_TITLE}
        lede={confirmationNotFoundMessage}
        priority
      />
      <NosSection>
        <div className="nk-state">
          <Link href="/tickets" className="nk-btn nk-cta">
            Back to tickets
          </Link>
        </div>
      </NosSection>
    </>
  );
}

export default async function TicketConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await searchParams;
  const bookingRef = normalizeBookingRefParam(ref);

  const confirmedOrder =
    bookingRef.length > 0 ? await getConfirmedOrderForDisplay(bookingRef) : null;

  if (!confirmedOrder) {
    if (await isBookingNotFound(bookingRef)) return <BookingNotFound />;
    return (
      <>
        <NosHero route="/tickets/confirmation" title="Tickets" priority />
        <ConfirmationPoller bookingRef={bookingRef} />
      </>
    );
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
    <>
      <NosHero
        route="/tickets/confirmation"
        title={confirmationSuccessHeading}
        lede={confirmationSuccessMessage}
        priority
      />
      <NosSection>
        <div className="mx-auto max-w-[600px] text-center">
          <p className="font-sans text-[15px] font-medium text-ink">
            {positions.length} {positions.length === 1 ? 'ticket' : 'tickets'} · Total R
            {orderTotal.toFixed(2)}
          </p>

          <div className="mt-8 space-y-10">
            {positions.map((position) => (
              <div
                key={position.bookingRef}
                className="border-t border-rule pt-8 first:border-t-0 first:pt-0"
              >
                <img
                  src={position.qrDataUri}
                  alt={`QR code for booking reference ${position.bookingRef} — scan at the door for check-in`}
                  width={240}
                  height={240}
                  className="mx-auto"
                />

                <div className="mt-6 space-y-1">
                  <p className="font-serif text-[18px] font-medium text-ink">
                    {position.attendeeName}
                  </p>
                  <p className="font-sans text-[14px] text-ink/80">
                    {position.ticketType} · R{position.amount.toFixed(2)}
                  </p>
                  <p className="font-sans text-[13px] text-muted">
                    Booking ref: {position.bookingRef}
                  </p>
                </div>

                <div className="mt-6">
                  <DownloadTicketButton
                    orderReference={confirmedOrder.reference}
                    bookingRef={position.bookingRef}
                    attendeeName={position.attendeeName}
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
            className="mt-8 inline-block py-0.5 font-sans text-[14px] text-ink underline underline-offset-2 hover:text-accent"
          >
            Back to tickets
          </Link>
        </div>
      </NosSection>
    </>
  );
}
