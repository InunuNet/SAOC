import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import type { Ticket, TicketType, TicketStatus } from '@/types/index';

export async function GET() {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
  }

  const db = getFirestore(initAdmin());
  const snapshot = await db.collection('tickets').get();

  const tickets: Ticket[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      bookingRef: data['bookingRef'] as string,
      showId: data['showId'] as string,
      attendeeName: data['attendeeName'] as string,
      attendeeEmail: data['attendeeEmail'] as string,
      ticketType: data['ticketType'] as TicketType,
      status: data['status'] as TicketStatus,
      amount: data['amount'] as number,
      purchasedAt: data['purchasedAt'] ?? null,
      checkedInAt: data['checkedInAt'] ?? null,
      m_payment_id: data['m_payment_id'] ?? null,
      pf_payment_id: data['pf_payment_id'] ?? null,
      orderId: data['orderId'] ?? null,
    };
  });

  return NextResponse.json(tickets);
}
