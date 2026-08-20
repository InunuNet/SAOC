'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { client } from '@/sanity/lib/client';
import { ticketsPageQuery } from '@/sanity/queries';

// F1 (confirmation-page-qr-and-download) — extracted out of the old all-client confirmation
// page. This component now handles ONLY the pre-confirmed states (checking/reserved/
// timed-out/not-found); the 'confirmed' render moved server-side into page.tsx, which reads
// real Firestore data via lib/orders.ts:getConfirmedOrderForDisplay (ticketing-multi-line-item-
// cart-ui F3 — order-aware, returns every paid position; this component itself has no
// single-ticket assumption baked in, since it only ever polls `bookingRef`'s status and defers
// to page.tsx for what "confirmed" renders). Polling behavior and the UNCHANGED
// /api/tickets/status endpoint (still { status } only) are unchanged from before — see
// contracts/golden/ticketing-m1-m2/page-states.golden.md for why polling exists at all (the
// buyer's browser redirect races PayFast's server-to-server ITN).
//
// On detecting paid/checked-in, this calls router.refresh() instead of rendering the confirmed
// state itself — that re-runs the Server Component for the current URL, which now finds the
// paid ticket and renders the QR/details/download branch server-side.
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 20; // ~1 minute of polling before we stop and say so.
const CONFIRMED_STATUSES = new Set(['paid', 'checked-in']);

interface TicketsPageCopy {
  confirmationPendingHeading?: string | null;
  confirmationPendingMessage?: string | null;
  confirmationNotFoundMessage?: string | null;
}

type PollState = 'checking' | 'reserved' | 'not-found' | 'timed-out';

interface ConfirmationPollerProps {
  bookingRef: string;
}

export function ConfirmationPoller({ bookingRef }: ConfirmationPollerProps) {
  const router = useRouter();
  const [copy, setCopy] = useState<TicketsPageCopy | null>(null);
  const [state, setState] = useState<PollState>('checking');

  useEffect(() => {
    client?.fetch<TicketsPageCopy>(ticketsPageQuery).then(setCopy).catch(() => setCopy(null));
  }, []);

  useEffect(() => {
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
          router.refresh();
          return;
        }
        if (data.status === 'reserved') {
          setState('reserved');
        }
      } catch {
        // Network hiccup — keep polling until MAX_POLL_ATTEMPTS is reached.
      }
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setState((prev) => (prev === 'not-found' ? prev : 'timed-out'));
        return;
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [bookingRef, router]);

  const confirmationPendingHeading = copy?.confirmationPendingHeading ?? 'Confirming your payment';
  const confirmationPendingMessage =
    copy?.confirmationPendingMessage ??
    "We're still waiting for payment confirmation. Please don't refresh or submit payment again.";
  const confirmationNotFoundMessage =
    copy?.confirmationNotFoundMessage ?? "We couldn't find a booking for that reference.";

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
          {bookingRef ? (
            <p className="mt-3 font-mono text-[13px] text-muted">Booking ref: {bookingRef}</p>
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
