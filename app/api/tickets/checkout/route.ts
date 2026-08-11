import { randomInt } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { generateSignature, PAYFAST_SANDBOX_PROCESS_URL } from '@/lib/payfast';
import { client } from '@/sanity/lib/client';
import { nationalShowSalesQuery, ticketTypeBySlugQuery, ticketsPageQuery } from '@/sanity/queries';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

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
const BOOKING_REF_SUFFIX_MAX = 1_000_000;

interface SanityTicketType {
  _id: string;
  name: string;
  price: number;
  capacity: number;
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

function generateBookingRef(): string {
  const suffix = randomInt(0, BOOKING_REF_SUFFIX_MAX).toString().padStart(6, '0');
  return `SAOC-2027-${suffix}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
  const amount = ticketTypeDoc.price;

  // Capacity is enforced server-side, the same way price and sales-open are — the
  // "sold out" badge on /tickets (app/(marketing)/tickets/page.tsx) is cosmetic on its
  // own; without this check a direct POST past capacity would still return a real
  // signed PayFast payload. Reuses the same counting helper /tickets uses (never a
  // second counting path). One checkout request reserves exactly one seat — there is
  // no multi-ticket-per-request field today — but the comparison is written in terms
  // of the requested quantity so it stays correct if that's ever added.
  const REQUESTED_QUANTITY = 1;
  let soldCounts: Record<string, number>;
  try {
    soldCounts = await getSoldCountsByTicketType(showId);
  } catch (error) {
    console.error('[tickets/checkout] Failed to count sold tickets:', error);
    return NextResponse.json(
      { error: 'Unable to verify ticket availability. Please try again.' },
      { status: 500 }
    );
  }
  const alreadySold = soldCounts[ticketType] ?? 0;
  if (alreadySold + REQUESTED_QUANTITY > ticketTypeDoc.capacity) {
    // Visitor-facing copy comes from Sanity (ticketsPage.soldOutMessage), same field
    // /tickets already uses for the cosmetic badge — not a new hardcoded string.
    let soldOutMessage = 'Sold out.';
    try {
      const copy = await client.fetch<{ soldOutMessage?: string | null } | null>(ticketsPageQuery);
      if (copy?.soldOutMessage) soldOutMessage = copy.soldOutMessage;
    } catch (error) {
      console.error('[tickets/checkout] Failed to fetch soldOutMessage, using fallback:', error);
    }
    return NextResponse.json({ error: soldOutMessage }, { status: 409 });
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

  const bookingRef = generateBookingRef();
  const amountFormatted = amount.toFixed(2);

  try {
    initAdmin();
    const db = getFirestore();
    await db.collection('tickets').add({
      bookingRef,
      showId,
      attendeeName: attendeeName.trim(),
      attendeeEmail: attendeeEmail.trim().toLowerCase(),
      ticketType,
      status: 'reserved',
      amount,
      purchasedAt: null,
      checkedInAt: null,
      m_payment_id: bookingRef,
      pf_payment_id: null,
    });
  } catch (error) {
    console.error('[tickets/checkout] Failed to create reserved ticket doc:', error);
    return NextResponse.json(
      { error: 'Failed to reserve ticket. Please try again.' },
      { status: 500 }
    );
  }

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
    { status: 201 }
  );
}
