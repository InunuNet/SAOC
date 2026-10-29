import { getFirestore, type Transaction } from 'firebase-admin/firestore';

// F6 (conference-workshop-tickets, M4) — changed from the `@/lib/firebase-admin` alias to
// a relative, explicit-`.ts`-extension specifier (zero behaviour change; Next.js resolves
// both identically). lib/view-models/load-ticket-card.ts statically imports
// lib/data/pool-remaining.ts, which statically imports THIS file — under this feature's
// own contracts/checks/*.mjs harness (a bare tsx/esm/api register(), no tsconfig option;
// see lib/data/pool-remaining.ts's own header comment on the same limitation), resolving a
// deep, fully-static `@/...` import chain in one linking pass fails with
// `Cannot find module '@/lib/firebase-admin'` — this was never exercised end-to-end before
// (every prior check against this file's import chain was a source-text check, never a
// real `import()`). Scoped to this one file/line, not the other 35 call sites still using
// the alias elsewhere in the codebase.
import { initAdmin } from '../firebase-admin.ts';
import { stillHoldsSeat } from '@/lib/seat-holds';

// F2 (ticketing-pages): server-only helper — imports firebase-admin, so it must only
// ever be called from Server Components or Route Handlers, never from a 'use client'
// file. Used by /tickets to compute per-type "sold out" state (page-states.golden.md).
const RESERVED_OR_PAID = ['reserved', 'paid'] as const;

/**
 * An abandoned checkout must not hold its seat forever (S1). Expiry is LAZY and lives in one
 * pure rule, lib/seat-holds.ts, shared with the checkout hold budget: a reservation carries an
 * `expiresAt` Timestamp written at creation and simply stops counting the instant that time
 * passes. No sweeper, no cron, no status write; see that module for why.
 *
 * Filtered in memory, not with `.where('expiresAt', '>', now)`: a range filter alongside
 * the two existing equality filters needs a composite index this project does not deploy.
 */

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
      if (!stillHoldsSeat(data, Date.now())) continue;
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

/**
 * F4 (conference-workshop-tickets, M2) — day-qualified sibling to
 * getSoldCountsByTicketType() above, for TRUE per-day capacity caps (e.g. Day Visitor's
 * 1000-per-day pool). Reuses the EXACT SAME query shape (tickets collection, showId
 * equality, reserved/paid status, stillHoldsSeat() filter) — this is intentionally not a
 * second, differently-constructed query. For each matching document whose `ticketType`
 * is a member of `dayQualifiedTypes` AND which carries a `chosenDay`, the count is keyed
 * `${ticketType}::${chosenDay}` instead of plain `ticketType`; every other document
 * (either a non-day-qualified type, or a day-qualified type with no chosenDay recorded)
 * keeps a plain `ticketType` key. This means the two functions' outputs can be merged
 * with `Object.assign()` with no key collision — a day-qualified document never produces
 * the same key as a plain one. See
 * .agent/memory/project/specs/conference-workshop-tickets/goldens/f4-capacity-pricing-engine.golden.md
 * §2.
 */
export async function getSoldCountsByTicketTypeAndDay(
  showId: string,
  dayQualifiedTypes: Set<string>,
  transaction?: Transaction
): Promise<Record<string, number>> {
  const db = getFirestore(initAdmin());
  const counts: Record<string, number> = {};

  const queries = RESERVED_OR_PAID.map((status) =>
    db.collection('tickets').where('showId', '==', showId).where('status', '==', status)
  );

  const snapshots = transaction
    ? await sequentialGet(transaction, queries)
    : await Promise.all(queries.map((query) => query.get()));

  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!stillHoldsSeat(data, Date.now())) continue;
      const ticketType = data['ticketType'] as string;
      const chosenDay = data['chosenDay'] as string | null | undefined;
      const key =
        dayQualifiedTypes.has(ticketType) && chosenDay ? `${ticketType}::${chosenDay}` : ticketType;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return counts;
}
