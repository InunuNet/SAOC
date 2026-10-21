import { redirect } from 'next/navigation';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { TicketsTable, type TicketRow } from '@/components/admin/TicketsTable';
import { getAdminSession } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';

// Firestore is read at request time only; see app/admin/(shell)/page.tsx.
export const dynamic = 'force-dynamic';

export default async function AdminTicketsPage() {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const tickets = await fetchTickets();

  return (
    <PageShell>
      <PageHeader title="Tickets" />
      <TicketsTable tickets={tickets} />
    </PageShell>
  );
}

// Newest purchase first, ordered by Firestore: an unordered .get() returns auto-ID order, which
// is how a fresh record ends up buried. The table never re-sorts.
async function fetchTickets(): Promise<TicketRow[]> {
  const db = getFirestore(initAdmin());
  const snapshot = await db.collection('tickets').orderBy('purchasedAt', 'desc').get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    // DocumentData is untyped; purchasedAt is written as a Timestamp or null (lib/orders.ts).
    const purchasedAt = data['purchasedAt'] as Timestamp | null | undefined;
    return {
      id: doc.id,
      bookingRef: data['bookingRef'] as string,
      attendeeName: data['attendeeName'] as string,
      attendeeEmail: data['attendeeEmail'] as string,
      ticketType: data['ticketType'] as string,
      status: data['status'] as string,
      purchasedAt: purchasedAt ? new Date(purchasedAt.toMillis()).toISOString() : null,
    };
  });
}
