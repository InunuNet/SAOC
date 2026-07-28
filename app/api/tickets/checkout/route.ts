import { randomInt } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { generateSignature, PAYFAST_SANDBOX_PROCESS_URL } from '@/lib/payfast';
import type { TicketType } from '@/types/index';

const SITE_URL = 'https://saoc.co.za';
const RETURN_URL = `${SITE_URL}/tickets/confirmation`;
const CANCEL_URL = `${SITE_URL}/tickets/cancelled`;
const NOTIFY_URL = `${SITE_URL}/api/tickets/itn`;
const ITEM_NAME = 'SAOC 2027 National Show Ticket';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOOKING_REF_SUFFIX_MAX = 1_000_000;

// PLACEHOLDER PRICING — real 2027 Adult/Pensioner/Child/Member/Exhibitor tier prices
// are not yet confirmed by Brad (flagged in .agent/memory/project/needs-human.md).
// Amount is ALWAYS derived server-side from this map — never trust a client-supplied
// amount, that is a payment security boundary.
const PLACEHOLDER_TICKET_PRICES: Record<TicketType, number> = {
  general: 150.0,
  member: 100.0,
  vip: 300.0,
};

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
    typeof body.showId === 'string' &&
    body.showId.trim().length > 0 &&
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

  const amount = PLACEHOLDER_TICKET_PRICES[ticketType as TicketType];
  if (amount === undefined) {
    return NextResponse.json({ error: `Unknown ticketType: ${ticketType}` }, { status: 400 });
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
      ticketType: ticketType as TicketType,
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
  const signedFields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: RETURN_URL,
    cancel_url: CANCEL_URL,
    notify_url: NOTIFY_URL,
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
