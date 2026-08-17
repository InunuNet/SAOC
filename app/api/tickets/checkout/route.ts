import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { generateBookingRef } from '@/lib/booking-ref';
import { initAdmin } from '@/lib/firebase-admin';
import { generateSignature, PAYFAST_SANDBOX_PROCESS_URL } from '@/lib/payfast';
import { client } from '@/sanity/lib/client';
import {
  allShowActivationQuery,
  nationalShowSalesQuery,
  ticketTypeBySlugQuery,
  ticketsPageQuery,
} from '@/sanity/queries';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { resolveActiveShow } from '@/lib/show-resolution';
import { NATIONAL_SHOW_ID, RESERVATION_TTL_MINUTES } from '@/lib/tickets-constants';

/**
 * Canonical production origin. Used only as the fallback when `SITE_URL` is unset.
 * PayFast sandbox testing MUST override it — `saoc.co.za` still resolves to the old
 * Joomla site, so a sandbox `notify_url` built on this origin would deliver the ITN
 * there and never reach this app. Set `SITE_URL` to the App Hosting origin instead.
 */
const DEFAULT_SITE_URL = 'https://saoc.co.za';
const ITEM_NAME = 'SAOC 2027 National Show Ticket';

/**
 * Resolve the origin at request time, not module load. Firebase App Hosting supplies
 * `SITE_URL` with RUNTIME availability only, so reading it at module scope would
 * capture `undefined` during the build and bake the fallback into the bundle.
 * Deliberately NOT `NEXT_PUBLIC_` — a public prefix is inlined at build time, which
 * would defeat the same runtime lookup.
 */
function resolveSiteUrl(): string {
  return process.env.SITE_URL?.trim().replace(/\/+$/, '') || DEFAULT_SITE_URL;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Duplicate-POST protection is keyed on this header ALONE — never on the buyer's email,
 * which would silently refuse a genuine second purchase.
 * See contracts/golden/ticketing-hardening/idempotency-and-booking-ref.golden.md.
 */
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The nil and max UUIDs are the two constants a client sends when it has no real key.
 *  A constant key is not an idempotency key — it deduplicates unrelated buyers onto one
 *  reservation and returns the first buyer's door code to all of them. */
const FORBIDDEN_IDEMPOTENCY_KEYS = new Set([
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
]);

const TICKETS_COLLECTION = 'tickets';

/** The only status from which a reservation can still be paid for. */
const RESERVED_STATUS = 'reserved';

/**
 * Firestore's default is 5. The capacity read locks every reserved/paid document for the
 * show, so a burst of buyers for the last seats contends hard by design; a few extra
 * attempts turn that contention into the intended 409, not a 500.
 */
const TRANSACTION_MAX_ATTEMPTS = 10;

// Not `number` — Sanity does not enforce field types at the API level, so a document
// written by the seed script or the HTTP API can carry a string or null here. Typing
// these as `number` is the assertion that produced the defect.
interface SanityTicketType {
  _id: string;
  name: string;
  price: unknown;
  capacity: unknown;
  show: { _ref: string } | null | undefined;
}

// F1 (ticketing-foundation): the currently sellable `show`, per resolveActiveShow()'s
// fail-closed contract — never a guess. Kept minimal (matches
// lib/show-resolution.ts's ShowActivationFields) rather than reusing SanityTicketType.
interface TicketTypeShowRef {
  _id: string;
  show?: { _ref: string } | null;
}

/**
 * Additive gate sitting next to the existing capacity/price validity checks below
 * (same shape, same failure mode, no change to the reservation transaction). Rejects
 * whenever the ticket type's `show` reference doesn't match the currently active show
 * — including "no active show at all" (`activeShowId === null`) and "ticket type
 * predates the `show` reference field" (no `show` at all).
 */
export function ticketTypeMatchesActiveShow(
  ticketType: TicketTypeShowRef,
  activeShowId: string | null
): boolean {
  if (activeShowId === null) return false;
  return ticketType.show?._ref === activeShowId;
}

// Sanity `validation:` is a Studio-authoring guard, not a read-time guarantee — the seed
// script and the HTTP API both write documents that never see it. A missing capacity
// previously compared as `held > undefined === false` and oversold silently; a missing
// price committed the reservation and then threw on `amount.toFixed(2)`, holding the seat
// and burning the idempotency key on every retry. Reject before anything is written.
//
// The `typeof` half is load-bearing twice: at runtime it rejects the string `"50"` that
// actually reproduces the oversell, and at compile time it is what narrows `unknown` to
// `number` — `Number.isFinite` alone does not narrow. Do NOT `Number(...)`-coerce first;
// `Number("50")` is `50` and puts the defect straight back.
function isUsableAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * 500, not 400: the request was well-formed and the CMS document is misconfigured, so a
 * 4xx would tell the buyer to fix something they cannot see.
 */
function unusableTicketType(slug: string, field: 'capacity' | 'price' | 'show'): NextResponse {
  console.error(
    `[tickets/checkout] ticketType '${slug}' has an unusable ${field}; refusing before any Firestore write.`
  );
  return NextResponse.json(
    { error: 'This ticket type is not available for purchase. Please contact us.' },
    { status: 500 }
  );
}

interface SanityNationalShowSales {
  salesOpen: boolean | null;
}

interface CheckoutRequestBody {
  showId?: unknown;
  ticketType?: unknown;
  attendeeName?: unknown;
  attendeeEmail?: unknown;
}

function isValidCheckoutBody(
  body: CheckoutRequestBody
): body is { showId: string; ticketType: string; attendeeName: string; attendeeEmail: string } {
  return (
    // showId must be the known pinned nationalShow singleton id, not merely "a
    // non-empty string" — getSoldCountsByTicketType(showId) scopes its capacity
    // ledger by this exact value, so an unvalidated showId lets a spoofed value pick
    // a fresh, always-empty ledger and bypass the capacity gate entirely. Same
    // posture as amount/salesOpen: the request body is never the authority.
    typeof body.showId === 'string' &&
    body.showId === NATIONAL_SHOW_ID &&
    typeof body.ticketType === 'string' &&
    typeof body.attendeeName === 'string' &&
    body.attendeeName.trim().length > 0 &&
    typeof body.attendeeEmail === 'string' &&
    EMAIL_PATTERN.test(body.attendeeEmail)
  );
}

/**
 * Outcome of the reservation transaction. `over-capacity` is an ordinary business
 * outcome, so it comes back as a sentinel rather than a thrown error — the caller needs
 * to fetch Sanity copy for the 409, and Sanity must never be called from inside a
 * transaction body that Firestore may retry.
 */
type ReservationOutcome =
  | { kind: 'created'; bookingRef: string; amount: number }
  | { kind: 'replayed'; bookingRef: string; amount: number }
  | { kind: 'over-capacity' }
  | { kind: 'key-payload-mismatch' }
  | { kind: 'key-not-payable'; reason: 'status' | 'expired' };

interface ReservationInput {
  showId: string;
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  amount: number;
  capacity: number;
  idempotencyKey: string;
}

/**
 * One checkout request reserves exactly one seat — there is no multi-ticket-per-request
 * field today — but the comparison is written in terms of the requested quantity so it
 * stays correct if that's ever added.
 */
const REQUESTED_QUANTITY = 1;

/**
 * Count, idempotency probe and reservation write in ONE transaction. Previously these
 * were an unguarded read-then-write: @qa reproduced 5 concurrent POSTs for the last seat
 * all returning 201, ending at 54 seats held against a capacity of 50.
 *
 * Firestore requires every read before any write, so both reads happen up front and the
 * decision is taken afterwards. Nothing but Firestore is touched in here — the body is
 * retried on contention, and an external call would be re-issued with it.
 */
async function reserveTicket(input: ReservationInput): Promise<ReservationOutcome> {
  const db = getFirestore(initAdmin());
  const tickets = db.collection(TICKETS_COLLECTION);

  return db.runTransaction(
    async (transaction): Promise<ReservationOutcome> => {
      const soldCounts = await getSoldCountsByTicketType(input.showId, transaction);
      const duplicate = await transaction.get(
        tickets.where('idempotencyKey', '==', input.idempotencyKey).limit(1)
      );

      if (!duplicate.empty) {
        const data = duplicate.docs[0].data();

        // Rule 1: the key is bound to the payload it first created. Matching on the key
        // alone handed a replaying stranger the original buyer's bookingRef — which is
        // the door code — and re-signed a payment at the original ticket type's price.
        // attendeeName is deliberately excluded: correcting a typo in your own name on a
        // retry is a legitimate replay, and the name is not a security boundary.
        if (
          data['attendeeEmail'] !== input.attendeeEmail ||
          data['ticketType'] !== input.ticketType
        ) {
          return { kind: 'key-payload-mismatch' };
        }

        // Rule 2: the replay branch hands back a live, signed PayFast payload, so it may
        // only run while the reservation can still be paid for.
        if (data['status'] !== RESERVED_STATUS) return { kind: 'key-not-payable', reason: 'status' };
        const expiresAt = data['expiresAt'];
        if (expiresAt instanceof Timestamp && expiresAt.toMillis() <= Date.now()) {
          return { kind: 'key-not-payable', reason: 'expired' };
        }

        return {
          kind: 'replayed',
          bookingRef: data['bookingRef'] as string,
          amount: data['amount'] as number,
        };
      }

      const alreadyHeld = soldCounts[input.ticketType] ?? 0;
      if (alreadyHeld + REQUESTED_QUANTITY > input.capacity) return { kind: 'over-capacity' };

      // The document id is derived from the booking reference, so a collision fails the
      // create instead of silently issuing a duplicate door code.
      const bookingRef = generateBookingRef();
      transaction.create(tickets.doc(bookingRef), {
        bookingRef,
        showId: input.showId,
        attendeeName: input.attendeeName,
        attendeeEmail: input.attendeeEmail,
        ticketType: input.ticketType,
        status: RESERVED_STATUS,
        amount: input.amount,
        // An unpaid hold releases itself: lib/data/tickets.ts stops counting a reserved
        // document once this passes (contracts/golden/.../reservation-expiry.golden.md).
        expiresAt: Timestamp.fromMillis(Date.now() + RESERVATION_TTL_MINUTES * 60_000),
        idempotencyKey: input.idempotencyKey,
        purchasedAt: null,
        checkedInAt: null,
        m_payment_id: bookingRef,
        pf_payment_id: null,
      });
      return { kind: 'created', bookingRef, amount: input.amount };
    },
    { maxAttempts: TRANSACTION_MAX_ATTEMPTS }
  );
}

/**
 * Visitor-facing copy comes from Sanity (ticketsPage.soldOutMessage), the same field
 * /tickets already uses for its cosmetic badge — not a new hardcoded string.
 */
async function fetchSoldOutMessage(): Promise<string> {
  if (!client) return 'Sold out.';
  try {
    const copy = await client.fetch<{ soldOutMessage?: string | null } | null>(ticketsPageQuery);
    return copy?.soldOutMessage ?? 'Sold out.';
  } catch (error) {
    console.error('[tickets/checkout] Failed to fetch soldOutMessage, using fallback:', error);
    return 'Sold out.';
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Before anything is read or written: without a well-formed key, duplicate protection
  // is opt-in, and therefore absent for exactly the callers that retry.
  const idempotencyKey = request.headers.get(IDEMPOTENCY_KEY_HEADER)?.trim() ?? '';
  if (
    !UUID_PATTERN.test(idempotencyKey) ||
    FORBIDDEN_IDEMPOTENCY_KEYS.has(idempotencyKey.toLowerCase())
  ) {
    return NextResponse.json(
      { error: `A valid UUID ${IDEMPOTENCY_KEY_HEADER} header is required.` },
      { status: 400 }
    );
  }

  let body: CheckoutRequestBody;
  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch (error) {
    console.error('[tickets/checkout] Failed to parse request body:', error);
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!isValidCheckoutBody(body)) {
    return NextResponse.json(
      { error: 'showId, ticketType, attendeeName, and a valid attendeeEmail are required.' },
      { status: 400 }
    );
  }

  const { showId, ticketType, attendeeName, attendeeEmail } = body;

  if (!client) {
    console.error('[tickets/checkout] Sanity client is not configured (missing project id).');
    return NextResponse.json({ error: 'CMS is not configured.' }, { status: 500 });
  }

  // Payment security boundary: sales-open is a functional gate checked server-side on
  // every direct POST, not just hidden in the UI. Amount is ALWAYS derived below from a
  // fresh Sanity ticketType lookup — never from the client — this is the second half of
  // that same boundary.
  let salesOpen: SanityNationalShowSales | null;
  try {
    salesOpen = await client.fetch<SanityNationalShowSales | null>(nationalShowSalesQuery);
  } catch (error) {
    console.error('[tickets/checkout] Failed to fetch nationalShow sales state:', error);
    return NextResponse.json(
      { error: 'Unable to verify ticket sales state. Please try again.' },
      { status: 500 }
    );
  }
  if (salesOpen?.salesOpen !== true) {
    return NextResponse.json({ error: 'Ticket sales are currently closed.' }, { status: 403 });
  }

  let ticketTypeDoc: SanityTicketType | null;
  try {
    ticketTypeDoc = await client.fetch<SanityTicketType | null>(ticketTypeBySlugQuery, {
      slug: ticketType,
    });
  } catch (error) {
    console.error('[tickets/checkout] Failed to fetch ticketType from Sanity:', error);
    return NextResponse.json(
      { error: 'Unable to look up ticket pricing. Please try again.' },
      { status: 500 }
    );
  }
  if (!ticketTypeDoc) {
    return NextResponse.json({ error: `Unknown ticketType: ${ticketType}` }, { status: 400 });
  }

  // 500, not 400: the request was well-formed and the CMS document is misconfigured, so
  // a 4xx would tell the buyer to fix something they cannot see.
  const { capacity, price } = ticketTypeDoc;
  if (!isUsableAmount(capacity)) return unusableTicketType(ticketType, 'capacity');
  if (!isUsableAmount(price)) return unusableTicketType(ticketType, 'price');

  // F1 (ticketing-foundation): additive active-show gate, same failure shape as the
  // capacity/price checks above. resolveActiveShow() fails closed to null, so a stale
  // ticket type (or a ticket type predating the `show` reference field) is refused
  // rather than silently sold against the wrong show.
  let allShows: { _id: string; active: boolean | null }[];
  try {
    allShows = (await client.fetch<{ _id: string; active: boolean | null }[]>(
      allShowActivationQuery
    )) ?? [];
  } catch (error) {
    console.error('[tickets/checkout] Failed to fetch show activation state:', error);
    return NextResponse.json(
      { error: 'Unable to verify ticket sales state. Please try again.' },
      { status: 500 }
    );
  }
  const activeShowId = resolveActiveShow(allShows);
  if (!ticketTypeMatchesActiveShow(ticketTypeDoc, activeShowId)) {
    return unusableTicketType(ticketType, 'show');
  }

  const merchantId = process.env.PAYFAST_SANDBOX_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_SANDBOX_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_SANDBOX_PASSPHRASE;

  if (!merchantId || !merchantKey) {
    console.error(
      '[tickets/checkout] Missing PAYFAST_SANDBOX_MERCHANT_ID or PAYFAST_SANDBOX_MERCHANT_KEY env var.'
    );
    return NextResponse.json(
      { error: 'Payment gateway is not configured. Please try again later.' },
      { status: 500 }
    );
  }

  let outcome: ReservationOutcome;
  try {
    outcome = await reserveTicket({
      showId,
      ticketType,
      attendeeName: attendeeName.trim(),
      attendeeEmail: attendeeEmail.trim().toLowerCase(),
      amount: price,
      capacity,
      idempotencyKey,
    });
  } catch (error) {
    console.error('[tickets/checkout] Failed to reserve ticket:', error);
    return NextResponse.json(
      { error: 'Failed to reserve ticket. Please try again.' },
      { status: 500 }
    );
  }

  if (outcome.kind === 'over-capacity') {
    return NextResponse.json({ error: await fetchSoldOutMessage() }, { status: 409 });
  }

  // Refusals carry no bookingRef and no PayFast fields: leaking the original buyer's
  // reference is the whole defect, and a 409 that still echoes it fixes nothing.
  if (outcome.kind === 'key-payload-mismatch') {
    return NextResponse.json(
      { error: `This ${IDEMPOTENCY_KEY_HEADER} was already used for a different purchase.` },
      { status: 409 }
    );
  }
  if (outcome.kind === 'key-not-payable') {
    return NextResponse.json(
      {
        error:
          outcome.reason === 'expired'
            ? 'This reservation expired. Please start again.'
            : 'This ticket has already been paid for.',
      },
      { status: 409 }
    );
  }

  // A replay is re-signed here from the STORED, server-derived amount — never from a
  // stored signature and never from the request body.
  const { bookingRef, amount } = outcome;
  const amountFormatted = amount.toFixed(2);

  // Field order matters — it IS the signature base string order (PayFast spec: attribute
  // order, not alphabetical). Compute the signature last, once all other fields are set.
  const siteUrl = resolveSiteUrl();
  const signedFields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${siteUrl}/tickets/confirmation?ref=${bookingRef}`,
    cancel_url: `${siteUrl}/tickets/cancelled?ref=${bookingRef}`,
    notify_url: `${siteUrl}/api/tickets/itn`,
    m_payment_id: bookingRef,
    amount: amountFormatted,
    item_name: ITEM_NAME,
  };
  const signature = generateSignature(signedFields, passphrase);

  return NextResponse.json(
    {
      bookingRef,
      processUrl: PAYFAST_SANDBOX_PROCESS_URL,
      fields: { ...signedFields, signature },
    },
    // A fresh reservation is 201, an idempotent replay is 200, so the two remain
    // distinguishable to a client that wants to know whether it actually created one.
    { status: outcome.kind === 'created' ? 201 : 200 }
  );
}
