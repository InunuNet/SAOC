import type { Metadata } from 'next';
import Link from 'next/link';

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
    <div className="mx-auto max-w-[600px] px-8 py-20 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        No charge made
      </p>
      <h1 className="mt-3 font-serif text-[32px] font-medium text-ink">{cancelledHeading}</h1>
      <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">{cancelledMessage}</p>
      {ref ? <p className="mt-3 font-mono text-[13px] text-muted">Booking ref: {ref}</p> : null}

      <Link
        href="/tickets"
        className="mt-8 inline-block rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors hover:bg-accent-soft"
      >
        {cancelledButtonLabel}
      </Link>
    </div>
  );
}
