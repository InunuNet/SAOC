'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { client } from '@/sanity/lib/client';
import { ticketsPageQuery } from '@/sanity/queries';

// F3 (ticketing-pages) — PayFast's return_url. CRITICAL correctness trap: the buyer
// lands here via a browser redirect, which races the server-to-server ITN, so the
// ticket is very often still 'reserved' (not yet 'paid') at first paint. We poll a
// read-only status endpoint and never claim success or failure prematurely — see
// contracts/golden/ticketing-m1-m2/page-states.golden.md.
//
// A plain client component (not sanityFetch, which needs next/headers draftMode()) —
// the Sanity client works identically in the browser since projectId/dataset are
// NEXT_PUBLIC_ vars and the dataset is public-readable.
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 20; // ~1 minute of polling before we stop and say so.
const CONFIRMED_STATUSES = new Set(['paid', 'checked-in']);

interface TicketsPageCopy {
  confirmationPendingHeading?: string | null;
  confirmationPendingMessage?: string | null;
  confirmationSuccessHeading?: string | null;
  confirmationSuccessMessage?: string | null;
  confirmationNotFoundMessage?: string | null;
  ticketIncludesNote?: string | null;
}

type PollState = 'checking' | 'reserved' | 'confirmed' | 'not-found' | 'timed-out';

export default function TicketConfirmationPage() {
  const [copy, setCopy] = useState<TicketsPageCopy | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [state, setState] = useState<PollState>('checking');

  useEffect(() => {
    // setState calls are deferred into these callbacks (rather than called directly in
    // the effect body) so React never sees a synchronous setState-in-effect — both
    // reads (Sanity copy, the URL's ?ref=) are external-system syncs, not derived state.
    client?.fetch<TicketsPageCopy>(ticketsPageQuery).then(setCopy).catch(() => setCopy(null));
    Promise.resolve().then(() => {
      setRef(new URLSearchParams(window.location.search).get('ref'));
    });
  }, []);

  useEffect(() => {
    if (ref === null) return;
    const bookingRef = ref;

    let attempts = 0;
    let cancelled = false;

    async function poll() {
      if (bookingRef.trim().length === 0) {
        setState('not-found');
        return;
      }
      attempts += 1;
      try {
        const res = await fetch(`/api/tickets/status?ref=${encodeURIComponent(bookingRef)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setState('not-found');
          return;
        }
        const data = (await res.json()) as { status?: string };
        if (data.status && CONFIRMED_STATUSES.has(data.status)) {
          setState('confirmed');
          return;
        }
        if (data.status === 'reserved') {
          setState('reserved');
        }
      } catch {
        // Network hiccup — keep polling until MAX_POLL_ATTEMPTS is reached.
      }
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setState((prev) => (prev === 'confirmed' || prev === 'not-found' ? prev : 'timed-out'));
        return;
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const confirmationPendingHeading = copy?.confirmationPendingHeading ?? 'Confirming your payment';
  const confirmationPendingMessage =
    copy?.confirmationPendingMessage ??
    "We're still waiting for payment confirmation. Please don't refresh or submit payment again.";
  const confirmationSuccessHeading = copy?.confirmationSuccessHeading ?? "You're booked in";
  const confirmationSuccessMessage =
    copy?.confirmationSuccessMessage ?? 'Thank you — your payment is confirmed.';
  const confirmationNotFoundMessage =
    copy?.confirmationNotFoundMessage ?? "We couldn't find a booking for that reference.";
  const ticketIncludesNote = copy?.ticketIncludesNote ?? '';

  return (
    <div className="mx-auto max-w-[600px] px-8 py-20 text-center">
      {(state === 'checking' || state === 'reserved') && (
        <div role="status" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Reserved</p>
          <h1 className="mt-3 font-serif text-[32px] font-medium text-ink">{confirmationPendingHeading}</h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">{confirmationPendingMessage}</p>
        </div>
      )}

      {state === 'timed-out' && (
        <div role="status" aria-live="polite">
          <h1 className="font-serif text-[32px] font-medium text-ink">{confirmationPendingHeading}</h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">
            This is taking longer than expected. Please don&apos;t resubmit payment — contact
            info@saoc.co.za with your booking reference if this doesn&apos;t resolve soon.
          </p>
          {ref ? <p className="mt-3 font-mono text-[13px] text-muted">Booking ref: {ref}</p> : null}
        </div>
      )}

      {state === 'confirmed' && (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Paid</p>
          <h1 className="mt-3 font-serif text-[32px] font-medium text-ink">{confirmationSuccessHeading}</h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">{confirmationSuccessMessage}</p>
          {ref ? <p className="mt-3 font-mono text-[13px] text-muted">Booking ref: {ref}</p> : null}
          {ticketIncludesNote ? (
            <p className="mt-6 border-t border-rule pt-6 font-sans text-[13px] leading-relaxed text-muted">
              {ticketIncludesNote}
            </p>
          ) : null}
        </div>
      )}

      {state === 'not-found' && (
        <div>
          <h1 className="font-serif text-[28px] font-medium text-ink">Booking not found</h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">{confirmationNotFoundMessage}</p>
        </div>
      )}

      <Link
        href="/tickets"
        className="mt-8 inline-block font-sans text-[14px] text-ink underline underline-offset-2 hover:text-accent"
      >
        Back to tickets
      </Link>
    </div>
  );
}
