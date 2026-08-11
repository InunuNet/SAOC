import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

// F2 (ticketing-pages): server-only helper — imports firebase-admin, so it must only
// ever be called from Server Components or Route Handlers, never from a 'use client'
// file. Used by /tickets to compute per-type "sold out" state (page-states.golden.md).
const RESERVED_OR_PAID = ['reserved', 'paid'] as const;

/**
 * Count reserved + paid tickets for `showId`, grouped by ticket type slug. A ticket
 * counts toward capacity the moment it's reserved (not only once paid) — otherwise
 * two buyers mid-checkout for the last seat could both be shown an available type.
 */
export async function getSoldCountsByTicketType(showId: string): Promise<Record<string, number>> {
  const db = getFirestore(initAdmin());
  const counts: Record<string, number> = {};

  await Promise.all(
    RESERVED_OR_PAID.map(async (status) => {
      const snapshot = await db
        .collection('tickets')
        .where('showId', '==', showId)
        .where('status', '==', status)
        .get();

      for (const doc of snapshot.docs) {
        const ticketType = doc.data()['ticketType'] as string;
        counts[ticketType] = (counts[ticketType] ?? 0) + 1;
      }
    })
  );

  return counts;
}
