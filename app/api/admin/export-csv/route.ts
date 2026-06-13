import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

const CSV_HEADER = 'bookingRef,attendeeName,attendeeEmail,ticketType,status,purchasedAt';

function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return new Response('Unauthorized', { status: 401 });
  }

  let decodedToken: Awaited<ReturnType<ReturnType<typeof getAuth>['verifySessionCookie']>>;
  try {
    decodedToken = await getAuth(initAdmin()).verifySessionCookie(sessionCookie, true);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const isAdmin =
    decodedToken.admin === true ||
    (decodedToken as Record<string, unknown>)['role'] === 'admin';

  if (!isAdmin) {
    return new Response('Forbidden', { status: 403 });
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
