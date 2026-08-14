import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { checkInByBookingRef } from '@/lib/checkin';

/**
 * Door check-in endpoint. Auth only — every admission rule lives in lib/checkin.ts
 * (contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md), so the
 * decision table cannot drift between the scanner and anything else that admits a
 * ticket. Nothing is read from or written to Firestore before auth passes.
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
  }

  let body: { bookingRef?: unknown };
  try {
    body = (await request.json()) as { bookingRef?: unknown };
  } catch (error) {
    console.error('[admin/checkin] Failed to parse request body:', error);
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof checkInByBookingRef>>;
  try {
    result = await checkInByBookingRef(body.bookingRef);
  } catch (error) {
    console.error('[admin/checkin] Check-in failed:', error);
    return NextResponse.json(
      { success: false, error: 'Check-in failed. Please try again.' },
      { status: 500 }
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({ success: true, ticket: result.ticket });
}
