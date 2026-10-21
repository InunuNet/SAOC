import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

/**
 * nos-critique-r19 F1 — the one tickets-by-bookingRef status lookup, shared by
 * /api/tickets/status (the poller) and /tickets/confirmation (the server-side not-found
 * decision), so the two can never disagree about "not found".
 *
 * Resolves the ticket's status, or `null` when there is no ticket for `ref` or it has no
 * status. Throws on a Firestore error; callers decide what an error means.
 */
export async function getTicketStatus(ref: string): Promise<string | null> {
  initAdmin();
  const db = getFirestore();
  const snapshot = await db.collection('tickets').where('bookingRef', '==', ref).limit(1).get();

  if (snapshot.empty) return null;

  const status = snapshot.docs[0]?.data()['status'] as string | undefined;
  return status ? status : null;
}
