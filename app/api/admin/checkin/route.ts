import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import type { Ticket, TicketType, TicketStatus } from '@/types/index';

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
    decodedToken.admin === true ||
    (decodedToken as Record<string, unknown>)['role'] === 'admin';
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { bookingRef } = (await request.json()) as { bookingRef: string };
  const db = getFirestore(initAdmin());

  const snap = await db.collection('tickets').where('bookingRef', '==', bookingRef).limit(1).get();
  if (snap.empty)
    return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

  const docRef = snap.docs[0].ref;
  const data = snap.docs[0].data();

  if ((data['status'] as TicketStatus) === 'checked-in') {
    return NextResponse.json({ success: false, error: 'Already checked in' }, { status: 409 });
  }

  await docRef.update({ checkedInAt: Timestamp.now(), status: 'checked-in' });

  const ticket: Ticket = {
    id: docRef.id,
    bookingRef: data['bookingRef'] as string,
    showId: data['showId'] as string,
    attendeeName: data['attendeeName'] as string,
    attendeeEmail: data['attendeeEmail'] as string,
    ticketType: data['ticketType'] as TicketType,
    status: 'checked-in',
    purchasedAt: (data['purchasedAt'] as Timestamp) ?? null,
    checkedInAt: Timestamp.now(),
    stripePaymentIntentId: (data['stripePaymentIntentId'] as string) ?? null,
  };

  return NextResponse.json({ success: true, ticket });
}
