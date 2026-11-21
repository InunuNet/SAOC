import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { adminHasCapability } from '@/lib/admin-capability-gate';
import { csvField } from '@/lib/csv-field';
import { initAdmin } from '@/lib/firebase-admin';
import { formatDietary } from '@/lib/registration';

const CSV_HEADER = 'bookingRef,attendeeName,attendeeEmail,ticketType,status,purchasedAt,dietary,mobile,societies,attendeeNumber,attending,judgeAccredited,judgeOrganisation,judgeAvailable,judgeDate,judgeCommunication,judgeForum';
const SOCIETY_SEPARATOR = '; ';

export async function GET() {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return new Response(status === 401 ? 'Unauthorized' : 'Forbidden', {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!(await adminHasCapability(session.decodedToken, 'export-buyer-data'))) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const db = getFirestore(initAdmin());
  const snapshot = await db.collection('tickets').get();

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    const purchasedAt = data['purchasedAt']
      ? new Date((data['purchasedAt'] as { toMillis(): number }).toMillis()).toISOString()
      : '';

    // Empty for a ticket with no registration; societies are joined.
    const registration = (data['registration'] ?? {}) as Record<string, unknown>; // buildRegistrationDoc map
    const societies = Array.isArray(registration['societies'])
      ? registration['societies'].map(String).join(SOCIETY_SEPARATOR)
      : '';

    return [
      csvField(String(data['bookingRef'] ?? '')),
      csvField(String(data['attendeeName'] ?? '')),
      csvField(String(data['attendeeEmail'] ?? '')),
      csvField(String(data['ticketType'] ?? '')),
      csvField(String(data['status'] ?? '')),
      csvField(purchasedAt),
      csvField(formatDietary({ dietary: String(registration['dietary'] ?? ''), dietaryOther: typeof registration['dietaryOther'] === 'string' ? registration['dietaryOther'] : null })),
      csvField(String(registration['mobile'] ?? '')),
      csvField(societies),
      csvField(String(registration['attendeeNumber'] ?? '')),
      csvField(String(registration['attending'] ?? '')),
      csvField(String(registration['judgeAccredited'] ?? '')),
      csvField(String(registration['judgeOrganisation'] ?? '')),
      csvField(String(registration['judgeAvailable'] ?? '')),
      csvField(String(registration['judgeDate'] ?? '')),
      csvField(String(registration['judgeCommunication'] ?? '')),
      csvField(String(registration['judgeForum'] ?? '')),
    ].join(',');
  });

  const csv = [CSV_HEADER, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="tickets.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
