import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { csvField } from '@/lib/csv-field';
import { initAdmin } from '@/lib/firebase-admin';

const CSV_HEADER = 'bookingRef,attendeeName,attendeeEmail,ticketType,status,purchasedAt';

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
      csvField(String(data['bookingRef'] ?? '')),
      csvField(String(data['attendeeName'] ?? '')),
      csvField(String(data['attendeeEmail'] ?? '')),
      csvField(String(data['ticketType'] ?? '')),
      csvField(String(data['status'] ?? '')),
      csvField(purchasedAt),
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
