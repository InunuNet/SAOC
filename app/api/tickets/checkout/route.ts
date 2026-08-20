import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { generateBookingRef } from '@/lib/booking-ref';
import {
  aggregateRequestedQuantities,
  buildMultiReservationDocs,
  effectiveCapacity,
  isNamedAttendeeSatisfied,
  isWithinEarlyBirdWindow,
  lineItemsMatchExistingPositions,
  planCapacity,
  resolveChosenDayForPosition,
  writeMultiReservationPair,
  type CheckoutLineItemInputLike,
  type LineItemPlan,
} from '@/lib/checkout-reservation';
import { initAdmin } from '@/lib/firebase-admin';
import { ORDERS_COLLECTION } from '@/lib/orders';
import { paymentProvider } from '@/lib/payments';
import type { ProviderReadiness } from '@/lib/payments';
import { mintRecoveryToken } from '@/lib/recovery-token';
import { buildShowWindow, isValidChosenDay } from '@/lib/show-window-lookup';
import { client } from '@/sanity/lib/client';
import {
  activeShowWindowQuery,
  nationalShowSalesQuery,
  ticketTypeBySlugQuery,
  ticketsPageQuery,
} from '@/sanity/queries';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { resolveActiveShow } from '@/lib/show-resolution';
import { MAX_LINE_ITEMS, NATIONAL_SHOW_ID, RESERVATION_TTL_MINUTES } from '@/lib/tickets-constants';

// Re-exported (not just imported) so contracts/checks/ticketing-multi-line-item-cart/
// check-parse-line-items-cap.mjs, which imports MAX_LINE_ITEMS from this route module,
// keeps working — the single source of truth is still lib/tickets-constants.ts.
export { MAX_LINE_ITEMS };

/**
 * Canonical production origin. Used only as the fallback when `SITE_URL` is unset.
 * Sandbox testing MUST override it — `saoc.co.za` still resolves to the old Joomla
 * site, so a sandbox notification callback built on this origin would be delivered
 * there and never reach this app. Set `SITE_URL` to the App Hosting origin instead.
 */
const DEFAULT_SITE_URL = 'https://saoc.co.za';
const TICKET_ITEM_LABEL = 'SAOC 2027 National Show Ticket';

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
  releasedQuantity: unknown;
  earlyBirdCutoff: unknown;
  requiresDaySelection: unknown;
  requiresAttendeeNames: unknown;
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

// F4 (multi-line-item-cart, M2): `releasedQuantity` is optional and 0 is a real value — this
// narrows `unknown` to `number | null` (never `undefined`, which effectiveCapacity() also
// accepts, but Sanity's GROQ response uses `null` for an absent field). Same
// typeof-load-bearing-twice reasoning as isUsableAmount() above: reject a stray string before
// it reaches effectiveCapacity().
function isUsableReleasedQuantity(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// F4: `earlyBirdCutoff` is optional — null/undefined means no early-bird restriction.
function isUsableEarlyBirdCutoff(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 500, not 400: the request was well-formed and the CMS document is misconfigured, so a
 * 4xx would tell the buyer to fix something they cannot see.
 */
function unusableTicketType(
  slug: string,
  field: 'capacity' | 'price' | 'show' | 'releasedQuantity' | 'earlyBirdCutoff' | 'showWindow'
): NextResponse {
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
  showId: unknown;
  lineItems: unknown;
}

export interface CheckoutLineItemInput {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  /** F5 (ticketing-f5-day-attendees) — absent is fine for any type; when present, must
   *  match CHOSEN_DAY_PATTERN or the whole cart is rejected. */
  chosenDay?: string;
}

const CHOSEN_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pure — no Firestore, no Sanity, no network. Returns null for: not an array; length 0;
 * length > MAX_LINE_ITEMS; or ANY single item failing the per-field rules (non-empty
 * ticketType, non-empty attendeeName, EMAIL_PATTERN-valid attendeeEmail, and — when
 * present — CHOSEN_DAY_PATTERN-valid chosenDay) — one bad item rejects the WHOLE cart,
 * never silently drops it and proceeds with the rest.
 */
export function parseLineItems(raw: unknown): CheckoutLineItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINE_ITEMS) {
    return null;
  }

  const lineItems: CheckoutLineItemInput[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return null;
    const candidate = entry as Record<string, unknown>;
    const { ticketType, attendeeName, attendeeEmail, chosenDay } = candidate;
    if (
      typeof ticketType !== 'string' ||
      ticketType.trim().length === 0 ||
      typeof attendeeName !== 'string' ||
      attendeeName.trim().length === 0 ||
      typeof attendeeEmail !== 'string' ||
      !EMAIL_PATTERN.test(attendeeEmail)
    ) {
      return null;
    }
    if (chosenDay !== undefined && (typeof chosenDay !== 'string' || !CHOSEN_DAY_PATTERN.test(chosenDay))) {
      return null;
    }
    lineItems.push(
      chosenDay === undefined
        ? { ticketType, attendeeName, attendeeEmail }
        : { ticketType, attendeeName, attendeeEmail, chosenDay }
    );
  }
  return lineItems;
}

/**
 * showId must be the known pinned nationalShow singleton id, not merely "a non-empty
 * string" — getSoldCountsByTicketType(showId) scopes its capacity ledger by this exact
 * value, so an unvalidated showId lets a spoofed value pick a fresh, always-empty ledger
 * and bypass the capacity gate entirely. Same posture as amount/salesOpen: the request
 * body is never the authority.
 */
function isValidShowId(showId: unknown): showId is string {
  return typeof showId === 'string' && showId === NATIONAL_SHOW_ID;
}

/**
 * Outcome of the reservation transaction. `over-capacity` is an ordinary business
 * outcome, so it comes back as a sentinel rather than a thrown error — the caller needs
 * to fetch Sanity copy for the 409, and Sanity must never be called from inside a
 * transaction body that Firestore may retry.
 */
type ReservationPosition = { bookingRef: string; ticketType: string };

type ReservationOutcome =
  | { kind: 'created'; reference: string; amount: number; positions: ReservationPosition[] }
  | { kind: 'replayed'; reference: string; amount: number; positions: ReservationPosition[] }
  | { kind: 'over-capacity'; ticketTypes: string[] }
  | { kind: 'key-payload-mismatch' }
  | { kind: 'key-not-payable'; reason: 'status' | 'expired' };

interface ReservationInput {
  showId: string;
  lineItems: CheckoutLineItemInputLike[];
  amountByType: Record<string, number>;
  capacityByType: Record<string, number>;
  idempotencyKey: string;
  recoveryTokenSecret: string;
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

  if (!isValidShowId(body.showId)) {
    return NextResponse.json(
      { error: 'showId, lineItems (1-20 valid line items) are required.' },
      { status: 400 }
    );
  }
  const showId = body.showId;

  const lineItems = parseLineItems(body.lineItems);
  if (!lineItems) {
    return NextResponse.json(
      { error: 'showId, lineItems (1-20 valid line items) are required.' },
      { status: 400 }
    );
  }

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

  // F1 (ticketing-foundation): additive active-show gate, same failure shape as the
  // capacity/price checks below. resolveActiveShow() fails closed to null, so a stale
  // ticket type (or a ticket type predating the `show` reference field) is refused
  // rather than silently sold against the wrong show.
  // F5 (ticketing-f5-day-attendees): activeShowWindowQuery replaces allShowActivationQuery
  // — same activation fields PLUS startDate/endDate, so this is one Sanity round-trip for
  // show-activation state, not two. resolveActiveShow() itself is unchanged.
  let allShows: { _id: string; active: boolean | null; startDate?: unknown; endDate?: unknown }[];
  try {
    allShows =
      (await client.fetch<
        { _id: string; active: boolean | null; startDate?: unknown; endDate?: unknown }[]
      >(activeShowWindowQuery)) ?? [];
  } catch (error) {
    console.error('[tickets/checkout] Failed to fetch show activation state:', error);
    return NextResponse.json(
      { error: 'Unable to verify ticket sales state. Please try again.' },
      { status: 500 }
    );
  }
  const activeShowId = resolveActiveShow(allShows);
  const activeShowDoc = activeShowId ? allShows.find((show) => show._id === activeShowId) : null;
  const showWindow = buildShowWindow(activeShowDoc ?? null);

  // ticketing-multi-line-item-cart (F2): one Sanity fetch PER DISTINCT ticketType the cart
  // references (dedupe by slug — two line items of the same type fetch its Sanity doc
  // once, not twice), same capacity/price/show validation as before, applied per type. Any
  // one bad type refuses the WHOLE request before any Firestore write.
  const distinctTicketTypes = [...new Set(lineItems.map((lineItem) => lineItem.ticketType))];
  const amountByType: Record<string, number> = {};
  const capacityByType: Record<string, number> = {};
  // F5 (ticketing-f5-day-attendees): captured per distinct type, enforced per LINE item below
  // (a line item's own chosenDay is what's being validated, not the type as a whole).
  const requiresDaySelectionByType: Record<string, boolean> = {};
  const requiresAttendeeNamesByType: Record<string, boolean> = {};

  for (const slug of distinctTicketTypes) {
    let ticketTypeDoc: SanityTicketType | null;
    try {
      ticketTypeDoc = await client.fetch<SanityTicketType | null>(ticketTypeBySlugQuery, {
        slug,
      });
    } catch (error) {
      console.error('[tickets/checkout] Failed to fetch ticketType from Sanity:', error);
      return NextResponse.json(
        { error: 'Unable to look up ticket pricing. Please try again.' },
        { status: 500 }
      );
    }
    if (!ticketTypeDoc) {
      return NextResponse.json({ error: `Unknown ticketType: ${slug}` }, { status: 400 });
    }

    // 500, not 400: the request was well-formed and the CMS document is misconfigured, so
    // a 4xx would tell the buyer to fix something they cannot see.
    const { capacity, price, releasedQuantity, earlyBirdCutoff } = ticketTypeDoc;
    if (!isUsableAmount(capacity)) return unusableTicketType(slug, 'capacity');
    if (!isUsableAmount(price)) return unusableTicketType(slug, 'price');
    if (!ticketTypeMatchesActiveShow(ticketTypeDoc, activeShowId)) {
      return unusableTicketType(slug, 'show');
    }
    if (!isUsableReleasedQuantity(releasedQuantity)) {
      return unusableTicketType(slug, 'releasedQuantity');
    }
    if (!isUsableEarlyBirdCutoff(earlyBirdCutoff)) {
      return unusableTicketType(slug, 'earlyBirdCutoff');
    }

    // F4: a released quantity greater than physical capacity never raises the ceiling — see
    // lib/checkout-reservation.ts's effectiveCapacity(). This is the entire integration point
    // with planCapacity()/aggregateRequestedQuantities(), neither of which changes.
    amountByType[slug] = price;
    capacityByType[slug] = effectiveCapacity(capacity, releasedQuantity);
    requiresDaySelectionByType[slug] = ticketTypeDoc.requiresDaySelection === true;
    requiresAttendeeNamesByType[slug] = ticketTypeDoc.requiresAttendeeNames === true;

    // F4: a closed early-bird window refuses the WHOLE cart, same "any one bad type refuses
    // the whole request" posture as the capacity/price/show checks above — with a 409 (a
    // legitimate, time-based business state, not a 500 misconfiguration and not a 400 client
    // error), before any Firestore write is attempted.
    if (earlyBirdCutoff !== null && !isWithinEarlyBirdWindow(new Date(), earlyBirdCutoff)) {
      return NextResponse.json(
        { error: 'Early-bird pricing for this ticket type has closed.' },
        { status: 409 }
      );
    }
  }

  // F5 (ticketing-f5-day-attendees): a NEW per-LINE-ITEM validation pass — every line item,
  // not just distinct types, since each line item may carry its own chosenDay — ahead of the
  // reservation attempt below. A stored-but-ignored requiresDaySelection/requiresAttendeeNames
  // flag is the same failure mode F4's non-negotiable #4 already ruled out for this route.
  for (const lineItem of lineItems) {
    if (requiresDaySelectionByType[lineItem.ticketType]) {
      if (!lineItem.chosenDay) {
        return NextResponse.json(
          { error: 'A day selection is required for this ticket type.' },
          { status: 400 }
        );
      }
      if (!showWindow) {
        return unusableTicketType(lineItem.ticketType, 'showWindow');
      }
      if (!isValidChosenDay(lineItem.chosenDay, showWindow)) {
        return NextResponse.json(
          { error: 'The chosen day is outside the show dates.' },
          { status: 400 }
        );
      }
    }
    if (requiresAttendeeNamesByType[lineItem.ticketType]) {
      if (!isNamedAttendeeSatisfied(true, lineItem.attendeeName)) {
        return NextResponse.json(
          { error: 'An attendee name is required for this ticket type.' },
          { status: 400 }
        );
      }
    }
  }

  // The gateway credential guard, BEFORE any Firestore write — the position
  // contracts/golden/payment-seam-f1/fail-closed-guards.golden.md pins. initiate() cannot serve
  // here: it needs the booking reference and the server-derived amount, which only exist after
  // reserveTicket(), so refusing there would already have burned a seat that nobody can pay for
  // until its TTL expires. readiness('initiate') asks the same question with nothing but config,
  // so the route refuses early without ever reading a gateway credential itself.
  //
  // Wrapped, because the wrong answer to "is the gateway configured?" is an optimistic one: an
  // adapter that throws must mean REFUSE, never "assume fine".
  let gatewayReadiness: ProviderReadiness;
  try {
    gatewayReadiness = paymentProvider.readiness('initiate');
  } catch (error) {
    console.error('[tickets/checkout] Payment provider readiness probe threw:', error);
    gatewayReadiness = { ready: false, reason: 'not-configured', missing: [] };
  }
  if (!gatewayReadiness.ready) {
    console.error('[tickets/checkout] Payment gateway is not configured.', {
      reason: gatewayReadiness.reason,
      missing: gatewayReadiness.missing,
    });
    return NextResponse.json(
      { error: 'Payment gateway is not configured. Please try again later.' },
      { status: 500 }
    );
  }

  const recoveryTokenSecret = process.env.RECOVERY_TOKEN_SECRET;

  // Fail closed, same posture as the gateway credential refusal above: an unset secret must
  // refuse the purchase before any Firestore write, never silently mint a never-verifiable-
  // again recovery token. See contracts/golden/ticketing-checkout-orders/README.md, section
  // "recoveryToken minting", for the full reasoning. This guard deliberately stays HERE, ahead
  // of the reservation write, where
  // contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh proves it by
  // source position.
  if (!recoveryTokenSecret) {
    console.error('[tickets/checkout] Missing RECOVERY_TOKEN_SECRET env var.');
    return NextResponse.json(
      { error: 'Ticket recovery is not configured. Please try again later.' },
      { status: 500 }
    );
  }

  let outcome: ReservationOutcome;
  try {
    outcome = await reserveTicket({
      showId,
      lineItems: lineItems.map((lineItem) => ({
        ticketType: lineItem.ticketType,
        attendeeName: lineItem.attendeeName.trim(),
        attendeeEmail: lineItem.attendeeEmail.trim().toLowerCase(),
        chosenDay: resolveChosenDayForPosition(
          lineItem.chosenDay,
          requiresDaySelectionByType[lineItem.ticketType]
        ),
      })),
      amountByType,
      capacityByType,
      idempotencyKey,
      recoveryTokenSecret,
    });
  } catch (error) {
    console.error('[tickets/checkout] Failed to reserve ticket:', error);
    return NextResponse.json(
      { error: 'Failed to reserve ticket. Please try again.' },
      { status: 500 }
    );
  }

  if (outcome.kind === 'over-capacity') {
    console.error('[tickets/checkout] over-capacity for types:', outcome.ticketTypes);
    return NextResponse.json({ error: await fetchSoldOutMessage() }, { status: 409 });
  }

  // Refusals carry no bookingRef and no hand-off fields: leaking the original buyer's
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

  // A replay is re-authenticated here from the STORED, server-derived amount — never from a
  // stored hand-off payload and never from the request body.
  const { reference, amount, positions } = outcome;
  const amountFormatted = amount.toFixed(2);

  // F2 (payment-provider-seam): this route no longer knows which gateway it is handing off to.
  // Assembling the fields, ordering them and authenticating them all belong to the provider
  // (lib/payments/); what stays here is the reference, the server-derived amount and our own
  // callback URLs. Nothing below may reach for a gateway-specific field name again.
  const siteUrl = resolveSiteUrl();
  const initiation = await paymentProvider.initiate({
    reference,
    amountFormatted,
    itemName: TICKET_ITEM_LABEL,
    returnUrl: `${siteUrl}/tickets/confirmation?ref=${reference}`,
    cancelUrl: `${siteUrl}/tickets/cancelled?ref=${reference}`,
    notifyUrl: `${siteUrl}/api/tickets/itn`,
  });

  // The gateway credential guard again, and this is DEFENCE IN DEPTH rather than redundancy:
  // config is read per call by design, so it can genuinely change between the readiness probe
  // above and this hand-off. 500 and not 4xx is deliberate: the request was well-formed and the
  // misconfiguration is ours, so a 4xx would tell the buyer to fix something they cannot see.
  // Status and message are byte-identical to the pre-F2 refusal
  // (contracts/golden/payment-seam-f1/fail-closed-guards.golden.md).
  if (!initiation.ok) {
    // Compile-time exhaustiveness, not decoration: 'not-configured' is the only refusal the
    // interface can currently produce, and this annotation breaks the build if it ever grows
    // another — forcing this route to decide what that new refusal means rather than silently
    // folding it into the same 500.
    const refusal: 'not-configured' = initiation.reason;
    console.error('[tickets/checkout] Payment provider refused the hand-off', {
      reference,
      reason: refusal,
    });
    return NextResponse.json(
      { error: 'Payment gateway is not configured. Please try again later.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      // Kept as the top-level field name/semantics — it is what the confirmation page's
      // `?ref=` param and the PayFast hand-off already key on, and (per the order-reference
      // decision, see README) it resolves to a REAL position document for N=1, byte-identical
      // to today. `positions` is purely additive.
      bookingRef: reference,
      positions,
      processUrl: initiation.processUrl,
      fields: initiation.fields,
    },
    // A fresh reservation is 201, an idempotent replay is 200, so the two remain
    // distinguishable to a client that wants to know whether it actually created one.
    { status: outcome.kind === 'created' ? 201 : 200 }
  );
}

/**
 * Count, idempotency probe and reservation write in ONE transaction. Previously these
 * were an unguarded read-then-write: @qa reproduced 5 concurrent POSTs for the last seat
 * all returning 201, ending at 54 seats held against a capacity of 50.
 *
 * Firestore requires every read before any write, so both reads happen up front and the
 * decision is taken afterwards. Nothing but Firestore is touched in here — the body is
 * retried on contention, and an external call would be re-issued with it.
 *
 * Declared AFTER POST() (a hoisted function declaration, so POST() can still call it) so
 * that POST()'s `if (!recoveryTokenSecret)` fail-closed guard appears, textually, before
 * the order/position pair-write call below — see
 * contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh, which
 * proves the guard by source position alone.
 */
async function reserveTicket(input: ReservationInput): Promise<ReservationOutcome> {
  const db = getFirestore(initAdmin());
  const tickets = db.collection(TICKETS_COLLECTION);
  const orders = db.collection(ORDERS_COLLECTION);

  return db.runTransaction(
    async (transaction): Promise<ReservationOutcome> => {
      const soldCounts = await getSoldCountsByTicketType(input.showId, transaction);

      // ticketing-multi-line-item-cart (F2): `.limit(1)` removed. Once one idempotency key
      // can produce N positions, `.limit(1)` here would silently see only one of them — see
      // README "Why .limit(1) must go".
      const duplicate = await transaction.get(
        tickets.where('idempotencyKey', '==', input.idempotencyKey)
      );

      if (!duplicate.empty) {
        const requested = input.lineItems.map((lineItem) => ({
          ticketType: lineItem.ticketType,
          attendeeEmail: lineItem.attendeeEmail,
          chosenDay: lineItem.chosenDay,
        }));
        const existing = duplicate.docs.map((doc) => {
          const data = doc.data();
          return {
            ticketType: data['ticketType'] as string,
            attendeeEmail: data['attendeeEmail'] as string,
            chosenDay: (data['chosenDay'] as string | null | undefined) ?? null,
          };
        });

        // Rule 1: the key is bound to the payload it first created. Matching on the key
        // alone handed a replaying stranger the original buyer's bookingRef — which is the
        // door code — and re-signed a payment at the original ticket type's price.
        // attendeeName is deliberately excluded: correcting a typo in your own name on a
        // retry is a legitimate replay, and the name is not a security boundary. Compared
        // as a full order-independent multiset, not just the first line item — see README
        // "Order becomes the state authority for replay".
        if (!lineItemsMatchExistingPositions(requested, existing)) {
          return { kind: 'key-payload-mismatch' };
        }

        // Rule 2: the replay branch hands back a live, authenticated payment hand-off, so it
        // may only run while the reservation can still be paid for. State authority for
        // replay is the ORDER, not an arbitrary position — see README "Order becomes the
        // state authority for replay".
        const orderId = duplicate.docs[0].data()['orderId'] as string | undefined;
        const orderDoc = orderId ? await transaction.get(orders.doc(orderId)) : null;
        const orderData = orderDoc?.exists ? orderDoc.data() : undefined;
        if (!orderData) return { kind: 'key-not-payable', reason: 'status' };

        if (orderData['status'] !== RESERVED_STATUS) {
          return { kind: 'key-not-payable', reason: 'status' };
        }
        const orderExpiresAt = orderData['expiresAt'];
        if (orderExpiresAt instanceof Timestamp && orderExpiresAt.toMillis() <= Date.now()) {
          return { kind: 'key-not-payable', reason: 'expired' };
        }

        return {
          kind: 'replayed',
          reference: orderData['m_payment_id'] as string,
          amount: orderData['amount'] as number,
          positions: duplicate.docs.map((doc) => ({
            bookingRef: doc.id,
            ticketType: doc.data()['ticketType'] as string,
          })),
        };
      }

      const requestedQtyByType = aggregateRequestedQuantities(input.lineItems);
      const capacityResult = planCapacity({
        requestedQtyByType,
        soldCountsByType: soldCounts,
        capacityByType: input.capacityByType,
      });
      if (capacityResult.kind === 'over-capacity') {
        return { kind: 'over-capacity', ticketTypes: capacityResult.ticketTypes };
      }

      // Every line item mints its own, independent bookingRef (own door code) — the
      // document id is derived from it, so a collision fails the create instead of
      // silently issuing a duplicate door code. The order-level reference is the FIRST
      // line item's own bookingRef, never a newly invented identifier — see README "Why
      // the order reference is the first line item's own bookingRef, not a new identifier".
      const lineItemPlans: LineItemPlan[] = input.lineItems.map((lineItem) => ({
        ticketType: lineItem.ticketType,
        attendeeName: lineItem.attendeeName,
        attendeeEmail: lineItem.attendeeEmail,
        amount: input.amountByType[lineItem.ticketType],
        bookingRef: generateBookingRef(),
        chosenDay: lineItem.chosenDay,
      }));
      const reference = lineItemPlans[0].bookingRef;

      const orderRef = orders.doc();
      const positionRefs = lineItemPlans.map((lineItemPlan) => tickets.doc(lineItemPlan.bookingRef));

      // One `now` shared by the reservation expiry and the recovery-token mint — see
      // contracts/golden/ticketing-checkout-orders/README.md F2 "mint the recovery token
      // via ... the same Date used for expiresAt below".
      const now = new Date();
      const expiresAt = Timestamp.fromMillis(
        now.getTime() + RESERVATION_TTL_MINUTES * 60_000
      );
      const minted = mintRecoveryToken({
        orderId: orderRef.id,
        secret: input.recoveryTokenSecret,
        now,
      });

      const docs = buildMultiReservationDocs({
        orderId: orderRef.id,
        reference,
        showId: input.showId,
        lineItems: lineItemPlans,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
        recoveryToken: minted.token,
        recoveryTokenExpiresAt: Timestamp.fromDate(minted.expiresAt),
        now: Timestamp.fromDate(now),
      });

      writeMultiReservationPair(transaction, { orderRef, positionRefs }, docs);

      const totalAmount = lineItemPlans.reduce((sum, lineItemPlan) => sum + lineItemPlan.amount, 0);
      return {
        kind: 'created',
        reference,
        amount: totalAmount,
        positions: lineItemPlans.map((lineItemPlan) => ({
          bookingRef: lineItemPlan.bookingRef,
          ticketType: lineItemPlan.ticketType,
        })),
      };
    },
    { maxAttempts: TRANSACTION_MAX_ATTEMPTS }
  );
}
