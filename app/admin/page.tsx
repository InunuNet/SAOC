import { redirect } from 'next/navigation';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import type { Ticket, TicketType, TicketStatus } from '@/types/index';

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
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
    };
  });

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Ticket Admin</h1>
      <p>
        <a href="/api/admin/export-csv">Download CSV</a>
      </p>
      <table border={1} cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Booking Ref</th>
            <th>Attendee Name</th>
            <th>Attendee Email</th>
            <th>Ticket Type</th>
            <th>Status</th>
            <th>Purchased At</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.bookingRef}</td>
              <td>{ticket.attendeeName}</td>
              <td>{ticket.attendeeEmail}</td>
              <td>{ticket.ticketType}</td>
              <td>{ticket.status}</td>
              <td>
                {ticket.purchasedAt
                  ? new Date(ticket.purchasedAt.toMillis()).toISOString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
