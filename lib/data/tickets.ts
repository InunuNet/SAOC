import { getFirestore, Timestamp, type Transaction } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

// F2 (ticketing-pages): server-only helper — imports firebase-admin, so it must only
// ever be called from Server Components or Route Handlers, never from a 'use client'
// file. Used by /tickets to compute per-type "sold out" state (page-states.golden.md).
const RESERVED_OR_PAID = ['reserved', 'paid'] as const;

const RESERVED_STATUS = 'reserved';

/**
 * An abandoned checkout must not hold its seat forever (S1). Expiry is LAZY: a
 * reservation carries an `expiresAt` Timestamp written at creation, and it simply stops
 * counting the instant that time passes. No sweeper, no cron, no status write — a
 * background writer flipping `reserved -> cancelled` would race the ITN and is the
 * obvious way to cancel a seat somebody has paid for.
 *
 * `paid` is never filtered: a payment that lands after the reservation window still wins
 * its seat. A `reserved` document with no `expiresAt` still counts — fails closed, so a
 * writer that forgets the field cannot silently release seats (A24 catches that writer).
 *
 * Filtered in memory, not with `.where('expiresAt', '>', now)`: a range filter alongside
 * the two existing equality filters needs a composite index this project does not deploy.
 */
function stillHoldsSeat(data: FirebaseFirestore.DocumentData): boolean {
  if (data['status'] !== RESERVED_STATUS) return true;
  const expiresAt = data['expiresAt'];
  if (!(expiresAt instanceof Timestamp)) return true;
  return expiresAt.toMillis() > Date.now();
}

/**
 * Count reserved + paid tickets for `showId`, grouped by ticket type slug. A ticket
 * counts toward capacity the moment it's reserved (not only once paid) — otherwise
 * two buyers mid-checkout for the last seat could both be shown an available type.
 *
 * Pass `transaction` from the checkout route so the count is a transactional read and
 * the reservation write that follows it cannot race another buyer
 * (contracts/golden/ticketing-hardening/capacity-transaction.golden.md). This stays the
 * single counting path: /tickets uses it for its sold-out badges, and a second,
 * divergent counter is how badge and gate drift apart.
 */
export async function getSoldCountsByTicketType(
  showId: string,
  transaction?: Transaction
): Promise<Record<string, number>> {
  const db = getFirestore(initAdmin());
  const counts: Record<string, number> = {};

  const queries = RESERVED_OR_PAID.map((status) =>
    db.collection('tickets').where('showId', '==', showId).where('status', '==', status)
  );

  // Reads inside a transaction are issued sequentially: they take read locks, and
  // interleaving them with anything else in the same transaction risks a deadlock.
  const snapshots = transaction
    ? await sequentialGet(transaction, queries)
    : await Promise.all(queries.map((query) => query.get()));

  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!stillHoldsSeat(data)) continue;
      const ticketType = data['ticketType'] as string;
      counts[ticketType] = (counts[ticketType] ?? 0) + 1;
    }
  }

  return counts;
}

async function sequentialGet(
  transaction: Transaction,
  queries: FirebaseFirestore.Query[]
): Promise<FirebaseFirestore.QuerySnapshot[]> {
  const snapshots: FirebaseFirestore.QuerySnapshot[] = [];
  for (const query of queries) {
    snapshots.push(await transaction.get(query));
  }
  return snapshots;
}
