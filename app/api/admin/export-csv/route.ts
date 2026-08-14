import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';

const CSV_HEADER = 'bookingRef,attendeeName,attendeeEmail,ticketType,status,purchasedAt';

function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return new Response(status === 401 ? 'Unauthorized' : 'Forbidden', { status });
  }

  const db = getFirestore(initAdmin());
  const snapshot = await db.collection('tickets').get();

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    const purchasedAt = data['purchasedAt']
      ? new Date((data['purchasedAt'] as { toMillis(): number }).toMillis()).toISOString()
      : '';

    return [
      escapeField(String(data['bookingRef'] ?? '')),
      escapeField(String(data['attendeeName'] ?? '')),
      escapeField(String(data['attendeeEmail'] ?? '')),
      escapeField(String(data['ticketType'] ?? '')),
      escapeField(String(data['status'] ?? '')),
      escapeField(purchasedAt),
    ].join(',');
  });

  const csv = [CSV_HEADER, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="tickets.csv"',
    },
  });
}
