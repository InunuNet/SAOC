import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';

import { checkInByBookingRef } from '@/lib/checkin';
import { initAdmin } from '@/lib/firebase-admin';

/**
 * Door check-in endpoint. Auth only — every admission rule lives in lib/checkin.ts
 * (contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md), so the
 * decision table cannot drift between the scanner and anything else that admits a
 * ticket. Nothing is read from or written to Firestore before auth passes.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let decodedToken: Awaited<ReturnType<ReturnType<typeof getAuth>['verifySessionCookie']>>;
  try {
    decodedToken = await getAuth(initAdmin()).verifySessionCookie(sessionCookie, true);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin =
    decodedToken.admin === true || (decodedToken as Record<string, unknown>)['role'] === 'admin';
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
