import { redirect } from 'next/navigation';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import {
  TicketsTable,
  type TicketRegistrationView,
  type TicketRow,
} from '@/components/admin/TicketsTable';
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

// The ticket's `registration` map (lib/registration.ts buildRegistrationDoc), or null when the
// ticket has none. Only the fields the admin drawer shows leave the server.
function registrationView(raw: unknown): TicketRegistrationView | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const map = raw as Record<string, unknown>; // written by buildRegistrationDoc; narrowed below
  const text = (key: string) => (typeof map[key] === 'string' ? map[key] : '');
  return {
    attendeeNumber: typeof map['attendeeNumber'] === 'number' ? map['attendeeNumber'] : null,
    mobile: text('mobile'),
    societies: Array.isArray(map['societies']) ? map['societies'].map(String) : null,
    attending: text('attending'),
    judgeAccredited: text('judgeAccredited'),
    judgeOrganisation: text('judgeOrganisation'),
    judgeAvailable: text('judgeAvailable'),
    judgeDate: text('judgeDate'),
    judgeCommunication: text('judgeCommunication'),
    judgeForum: text('judgeForum'),
    dietary: text('dietary'),
  };
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
      registration: registrationView(data['registration']),
    };
  });
}
