import { NextResponse } from 'next/server';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { generateBookingRef } from '@/lib/booking-ref';
import { buildCompOrderInput } from '@/lib/comp-tickets';
import { createOrderWithPosition } from '@/lib/orders';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * F8 (ticketing-foundation) — comp-ticket issuance endpoint (spec §4.5). Gated on
 * `getAdminSession()` FIRST (401/403 on session failure, identical shape to the existing
 * checkin route), THEN `hasCapability(decoded, showId, 'issue-comp', ...)` (403 on
 * capability failure) — a missing capability is checked as a distinct step from session
 * validity, not collapsed into it. On success: `buildCompOrderInput()` then
 * `createOrderWithPosition()`, with no `deps` override — production always uses the real
 * Firestore default. See contracts/golden/ticketing-f8-comp-tickets/README.md.
 *
 * Body validation (showId/attendeeName/attendeeEmail/ticketType) is this route's own
 * responsibility, mirroring checkout's `isValidCheckoutBody` discipline
 * (app/api/tickets/checkout/route.ts) — it is not separately contract-tested beyond A8's
 * fail-closed HTTP round trip.
 *
 * Never imports, calls, or modifies app/api/tickets/itn/route.ts — amount-0 never enters
 * it (spec §4.5, mission Decision 2).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CompRequestBody {
  showId?: unknown;
  attendeeName?: unknown;
  attendeeEmail?: unknown;
  ticketType?: unknown;
}

function isValidCompBody(
  body: CompRequestBody
): body is { showId: string; attendeeName: string; attendeeEmail: string; ticketType: string } {
  return (
    // showId must be the known pinned nationalShow singleton id — same posture as
    // checkout's isValidCheckoutBody, since hasCapability() below scopes its per-show
    // grant lookup by this exact value.
    typeof body.showId === 'string' &&
    body.showId === NATIONAL_SHOW_ID &&
    typeof body.attendeeName === 'string' &&
    body.attendeeName.trim().length > 0 &&
    typeof body.attendeeEmail === 'string' &&
    EMAIL_PATTERN.test(body.attendeeEmail) &&
    typeof body.ticketType === 'string' &&
    body.ticketType.trim().length > 0
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
  }

  let body: CompRequestBody;
  try {
    body = (await request.json()) as CompRequestBody;
  } catch (error) {
    console.error('[admin/tickets/comp] Failed to parse request body:', error);
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!isValidCompBody(body)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // A missing capability is checked as a distinct step from session validity, not
  // collapsed into it — a signed-in admin with no 'issue-comp' grant is refused here,
  // never earlier.
  if (!hasCapability(session.decodedToken, body.showId, 'issue-comp')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const issuedByEmail = session.decodedToken.email;
  if (!issuedByEmail) {
    // Every real admin session already requires a verified email (isAdminToken), so this
    // is unreachable in production — fail closed rather than attribute a comp to nobody.
    console.error('[admin/tickets/comp] Admin session has no email; refusing to attribute a comp.');
    return NextResponse.json({ error: 'Unable to attribute this comp.' }, { status: 500 });
  }

  const built = buildCompOrderInput({
    showId: body.showId,
    attendeeName: body.attendeeName,
    attendeeEmail: body.attendeeEmail,
    ticketType: body.ticketType,
    issuedByEmail,
    bookingRef: generateBookingRef(),
    now: new Date(),
  });

  try {
    const result = await createOrderWithPosition(built);
    return NextResponse.json(
      { success: true, orderId: result.orderId, bookingRef: built.bookingRef },
      { status: 201 }
    );
  } catch (error) {
    console.error('[admin/tickets/comp] Failed to write comp order/position pair:', error);
    return NextResponse.json({ error: 'Failed to issue comp ticket. Please try again.' }, { status: 500 });
  }
}
