'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { NosSection } from '@/components/nos/NosSection';
import { client } from '@/sanity/lib/client';
import { ticketsPageQuery } from '@/sanity/queries';

// F1 (confirmation-page-qr-and-download) — extracted out of the old all-client confirmation
// page. This component now handles ONLY the pre-confirmed states (checking/reserved/
// timed-out); the 'confirmed' render moved server-side into page.tsx, which reads
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
// paid ticket and renders the QR/details/download branch server-side. A 404 (nos-critique-r19)
// refreshes the same way, once per mount: page.tsx decides "booking not found" server-side and
// renders it. A second 404 (the server lookup failed and rendered this poller again) ends in
// the timed-out state instead of refreshing in a loop.
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 20; // ~1 minute of polling before we stop and say so.
const HTTP_TOO_MANY_REQUESTS = 429;
const MS_PER_SECOND = 1_000;
const MAX_RATE_LIMIT_BACKOFFS = 10;
const MAX_RETRY_AFTER_SECONDS = 60; // a hostile or odd header must not park the poller for good.
const CONFIRMED_STATUSES = new Set(['paid', 'checked-in']);

/** Retry-After (seconds) as a poll delay: never shorter than the normal interval, never unbounded. */
function retryDelayMs(header: string | null): number {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return POLL_INTERVAL_MS;
  return Math.max(POLL_INTERVAL_MS, Math.min(seconds, MAX_RETRY_AFTER_SECONDS) * MS_PER_SECOND);
}

interface TicketsPageCopy {
  confirmationPendingHeading?: string | null;
  confirmationPendingMessage?: string | null;
}

type PollState = 'checking' | 'reserved' | 'timed-out';

interface ConfirmationPollerProps {
  bookingRef: string;
}

export function ConfirmationPoller({ bookingRef }: ConfirmationPollerProps) {
  const router = useRouter();
  const [copy, setCopy] = useState<TicketsPageCopy | null>(null);
  const [state, setState] = useState<PollState>('checking');

  useEffect(() => {
    client
      ?.fetch<TicketsPageCopy>(ticketsPageQuery)
      .then(setCopy)
      .catch(() => setCopy(null));
  }, []);

  useEffect(() => {
    let attempts = 0;
    let cancelled = false;
    let refreshedOn404 = false;
    let rateLimitBackoffs = 0;

    async function poll() {
      if (bookingRef.trim().length === 0) {
        router.refresh();
        return;
      }
      attempts += 1;
      let nextDelayMs = POLL_INTERVAL_MS;
      try {
        const res = await fetch(`/api/tickets/status?ref=${encodeURIComponent(bookingRef)}`);
        if (cancelled) return;
        if (res.status === 404) {
          if (refreshedOn404) {
            setState('timed-out');
            return;
          }
          refreshedOn404 = true;
          router.refresh();
          if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        if (res.status === HTTP_TOO_MANY_REQUESTS) {
          // Rate limited, not an error: back off for Retry-After, then poll again. A backoff does
          // not use up a poll attempt, but they are capped so a stuck limiter still ends.
          rateLimitBackoffs += 1;
          if (rateLimitBackoffs <= MAX_RATE_LIMIT_BACKOFFS) attempts -= 1;
          nextDelayMs = retryDelayMs(res.headers.get('Retry-After'));
        } else {
          const data = (await res.json()) as { status?: string };
          if (data.status && CONFIRMED_STATUSES.has(data.status)) {
            router.refresh();
            return;
          }
          if (data.status === 'reserved') {
            setState('reserved');
          }
        }
      } catch {
        // Network hiccup — keep polling until MAX_POLL_ATTEMPTS is reached.
      }
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setState('timed-out');
        return;
      }
      if (!cancelled) setTimeout(poll, nextDelayMs);
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

  return (
    <NosSection>
      <div className="mx-auto max-w-[600px] text-center">
        {(state === 'checking' || state === 'reserved') && (
          <div role="status" aria-live="polite">
            <p className="font-sans text-[13px] font-semibold text-muted">Reserved</p>
            <h2 className="mt-3 font-serif tracking-[-0.015em] font-light text-[32px] text-ink">
              {confirmationPendingHeading}
            </h2>
            <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">
              {confirmationPendingMessage}
            </p>
          </div>
        )}

        {state === 'timed-out' && (
          <div role="status" aria-live="polite">
            <h2 className="font-serif tracking-[-0.015em] font-light text-[32px] text-ink">
              {confirmationPendingHeading}
            </h2>
            <p className="mt-4 font-sans text-[15px] leading-relaxed text-ink/80">
              This is taking longer than expected. Please don&apos;t resubmit payment — contact
              info@saoc.co.za with your booking reference if this doesn&apos;t resolve soon.
            </p>
            {bookingRef ? (
              <p className="mt-3 font-sans text-[13px] text-muted">Booking ref: {bookingRef}</p>
            ) : null}
          </div>
        )}

        <Link
          href="/tickets"
          className="mt-8 inline-block py-0.5 font-sans text-[14px] text-ink underline underline-offset-2 hover:text-accent"
        >
          Back to tickets
        </Link>
      </div>
    </NosSection>
  );
}
