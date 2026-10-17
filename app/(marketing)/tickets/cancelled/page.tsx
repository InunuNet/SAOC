import type { Metadata } from 'next';
import Link from 'next/link';

import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { sanityFetch } from '@/sanity/lib/fetch';
import { ticketsPageQuery } from '@/sanity/queries';

// F4 (ticketing-pages) — PayFast's cancel_url. A cancelled PayFast session leaves the
// ticket doc in Firestore as status: 'reserved' — this page adds no cleanup, expiry
// job, or write of any kind. Expiring stale reserved docs is future work (F6/F7), not
// part of this pass. See contracts/golden/ticketing-m1-m2/README.md, decision #6.
export const revalidate = 60;

export const metadata: Metadata = { title: 'Payment Cancelled' };

interface TicketsPageCopy {
  cancelledHeading?: string | null;
  cancelledMessage?: string | null;
  cancelledButtonLabel?: string | null;
}

export default async function TicketCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const copy = await sanityFetch<TicketsPageCopy>({
    query: ticketsPageQuery,
    tags: ['ticketsPage', 'sanity'],
  });

  const cancelledHeading = copy?.cancelledHeading ?? 'Payment cancelled';
  const cancelledMessage =
    copy?.cancelledMessage ??
    'No payment was taken. Your reservation has been left open as reserved — you are welcome ' +
      'to try again whenever you are ready.';
  const cancelledButtonLabel = copy?.cancelledButtonLabel ?? 'Back to tickets';

  return (
    <>
      <NosHero
        route="/tickets/cancelled"
        title={cancelledHeading}
        lede={cancelledMessage}
        priority
      />
      <NosSection>
        <div className="mx-auto max-w-[600px] text-center">
          {ref ? <p className="font-sans text-[15px] text-muted">Booking ref: {ref}</p> : null}
          <Link
            href="/national-show/tickets"
            className="nk-btn nk-cta mt-8 inline-flex w-auto"
          >
            {cancelledButtonLabel}
          </Link>
        </div>
      </NosSection>
    </>
  );
}
