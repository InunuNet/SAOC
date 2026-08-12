import { getFirestore, Timestamp, type Transaction } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import type { Ticket, TicketStatus, TicketType } from '@/types/index';

/**
 * F1 (ticketing-hardening) — server-only door-admission service.
 *
 * Extracted out of app/api/admin/checkin/route.ts for two reasons:
 *  1. the route only ever checked "already checked in", so a merely `reserved` ticket —
 *     created the instant a checkout is initiated, before PayFast confirms anything —
 *     opened the door, as did a paid ticket belonging to a different show;
 *  2. Firebase Auth is not provisioned on `saoc-webapp`, so no admin session cookie can
 *     be minted and the rules cannot be proved through the authenticated HTTP path.
 *     Callable without a session, they are proved directly against real Firestore.
 *
 * Decision table and ordering: contracts/golden/ticketing-hardening/
 * checkin-admission-rules.golden.md.
 */

const TICKETS_COLLECTION = 'tickets';

export type CheckinRefusalCode =
  | 'bad-request'
  | 'not-found'
  | 'wrong-show'
  | 'unpaid'
  | 'already-checked-in';

export type CheckinResult =
  | { ok: true; ticket: Ticket }
  | { ok: false; code: CheckinRefusalCode; httpStatus: number; error: string };

interface RefusalSpec {
  httpStatus: number;
  error: string;
}

/**
 * Short, plain door-staff copy — deliberately not Sanity-sourced. These strings are
 * read off a scanner screen in a queue, not authored content.
 */
const REFUSALS: Record<CheckinRefusalCode, RefusalSpec> = {
  'bad-request': { httpStatus: 400, error: 'A booking reference is required.' },
  'not-found': { httpStatus: 404, error: 'Ticket not found' },
  'wrong-show': { httpStatus: 403, error: 'This ticket is not for this show.' },
  unpaid: { httpStatus: 403, error: 'This ticket has not been paid for.' },
  'already-checked-in': { httpStatus: 409, error: 'Already checked in' },
};

function refuse(code: CheckinRefusalCode): CheckinResult {
  return { ok: false, code, ...REFUSALS[code] };
}

function toTicket(id: string, data: FirebaseFirestore.DocumentData): Ticket {
  return {
    id,
    bookingRef: data['bookingRef'] as string,
    showId: data['showId'] as string,
    attendeeName: data['attendeeName'] as string,
    attendeeEmail: data['attendeeEmail'] as string,
    ticketType: data['ticketType'] as TicketType,
    status: data['status'] as TicketStatus,
    amount: data['amount'] as number,
    purchasedAt: (data['purchasedAt'] as Timestamp) ?? null,
    checkedInAt: (data['checkedInAt'] as Timestamp) ?? null,
    m_payment_id: (data['m_payment_id'] as string) ?? null,
    pf_payment_id: (data['pf_payment_id'] as string) ?? null,
  };
}

async function admit(transaction: Transaction, bookingRef: string): Promise<CheckinResult> {
  const db = getFirestore(initAdmin());
  const snapshot = await transaction.get(
    db.collection(TICKETS_COLLECTION).where('bookingRef', '==', bookingRef).limit(1)
  );
  if (snapshot.empty) return refuse('not-found');

  const doc = snapshot.docs[0];
  const data = doc.data();

  if ((data['showId'] as string) !== NATIONAL_SHOW_ID) return refuse('wrong-show');

  // Ordered before the paid check on purpose: a checked-in ticket is by definition no
  // longer 'paid', and door staff must be told what actually happened. The existing
  // checkedInAt is the audit record of when that person walked in — never overwritten.
  if ((data['status'] as TicketStatus) === 'checked-in') return refuse('already-checked-in');

  if ((data['status'] as TicketStatus) !== 'paid') return refuse('unpaid');

  const checkedInAt = Timestamp.now();
  transaction.update(doc.ref, { status: 'checked-in', checkedInAt });

  return { ok: true, ticket: { ...toTicket(doc.id, data), status: 'checked-in', checkedInAt } };
}

/**
 * Admit a ticket at the door, exactly once. The fresh read, the decision and the write
 * all happen inside one transaction, so two concurrent scans of the same paid ticket
 * admit once: the loser re-runs against committed state and reports 'already-checked-in'
 * without touching the winner's timestamp. No network calls other than Firestore happen
 * inside the transaction — Firestore retries the body.
 */
export async function checkInByBookingRef(bookingRef: unknown): Promise<CheckinResult> {
  if (typeof bookingRef !== 'string' || bookingRef.trim().length === 0) {
    return refuse('bad-request');
  }

  const db = getFirestore(initAdmin());
  return db.runTransaction((transaction) => admit(transaction, bookingRef.trim()));
}
