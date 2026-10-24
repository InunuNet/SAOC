import { getFirestore, Timestamp, type Transaction } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { decideTestTicketAdmission } from '@/lib/checkin-test-ticket-guard';
import { decideDayAdmission, sastDay } from '@/lib/checkin-day-policy';
import { getCheckinContext, type CheckinContext } from '@/lib/checkin-context';
import { isTicketingTestMode } from '@/lib/ticketing-test-mode';
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
  | 'test_ticket'
  | 'unpaid'
  | 'already-checked-in'
  | 'not_show_day'
  | 'wrong_day';

export type CheckinResult =
  | { ok: true; ticket: Ticket; firstAdmission: boolean }
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
  test_ticket: { httpStatus: 403, error: 'Test ticket — not valid for entry' },
  unpaid: { httpStatus: 403, error: 'This ticket has not been paid for.' },
  'already-checked-in': { httpStatus: 409, error: 'Already checked in' },
  not_show_day: { httpStatus: 403, error: 'The show is not open today.' },
  wrong_day: { httpStatus: 403, error: 'This ticket has no valid selected day. Please contact the ticket desk.' },
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
    ...(data['chosenDay'] !== undefined ? { chosenDay: data['chosenDay'] as string | null } : {}),
    ...(data['checkIns'] !== undefined ? { checkIns: data['checkIns'] as Record<string, Timestamp> } : {}),
    m_payment_id: (data['m_payment_id'] as string) ?? null,
    pf_payment_id: (data['pf_payment_id'] as string) ?? null,
    orderId: (data['orderId'] as string) ?? null,
  };
}

async function admit(transaction: Transaction, bookingRef: string, now: Date, context: CheckinContext | null, contextError: unknown): Promise<CheckinResult> {
  const db = getFirestore(initAdmin());
  const snapshot = await transaction.get(
    db.collection(TICKETS_COLLECTION).where('bookingRef', '==', bookingRef).limit(1)
  );
  if (snapshot.empty) return refuse('not-found');

  const doc = snapshot.docs[0];
  const data = doc.data();

  if ((data['showId'] as string) !== NATIONAL_SHOW_ID) return refuse('wrong-show');

  if (decideTestTicketAdmission({
    issuedInTestMode: data['issuedInTestMode'],
    liveMode: !isTicketingTestMode(),
  }) === 'reject_test_ticket') return refuse('test_ticket');

  if (contextError) throw contextError;
  if (!context) throw new Error('Check-in context unavailable');
  const firstStamp = data['checkedInAt'];
  const firstDate = firstStamp && typeof firstStamp.toDate === 'function' ? firstStamp.toDate() : null;
  const decision = decideDayAdmission({
    ticket: {
      ticketType: data['ticketType'], status: data['status'], chosenDay: data['chosenDay'],
      checkIns: data['checkIns'], checkedInAt: firstDate,
    },
    now, window: context.window,
    requiresDaySelection: context.daySelectionTypes.includes(data['ticketType'] as string),
  });
  if (!decision.ok) return decision;

  const checkedInAt = firstDate && Number.isFinite(firstDate.getTime()) ? firstStamp as Timestamp : Timestamp.fromDate(now);
  const previous = data['checkIns'];
  const checkIns: Record<string, Timestamp> = previous && typeof previous === 'object' && !Array.isArray(previous)
    ? { ...previous } : {};
  if (firstDate && Number.isFinite(firstDate.getTime())) {
    const firstDay = sastDay(firstDate);
    if (!Object.prototype.hasOwnProperty.call(checkIns, firstDay)) checkIns[firstDay] = checkedInAt;
  }
  checkIns[decision.day] = Timestamp.fromDate(now);
  transaction.update(doc.ref, { status: 'checked-in', checkedInAt, checkIns });

  return { ok: true, firstAdmission: decision.firstAdmission,
    ticket: { ...toTicket(doc.id, data), status: 'checked-in', checkedInAt, checkIns } };
}

/**
 * Admit a ticket at the door, exactly once. The fresh read, the decision and the write
 * all happen inside one transaction, so two concurrent scans of the same paid ticket
 * admit once: the loser re-runs against committed state and reports 'already-checked-in'
 * without touching the winner's timestamp. No network calls other than Firestore happen
 * inside the transaction — Firestore retries the body.
 */
export async function checkInByBookingRef(
  bookingRef: unknown,
  deps?: { now?: () => Date; getContext?: (now: Date) => Promise<CheckinContext> }
): Promise<CheckinResult> {
  if (typeof bookingRef !== 'string' || bookingRef.trim().length === 0) {
    return refuse('bad-request');
  }

  const now = deps?.now?.() ?? new Date();
  let context: CheckinContext | null = null;
  let contextError: unknown = null;
  try {
    context = await (deps?.getContext ?? getCheckinContext)(now);
  } catch (error) {
    contextError = error;
  }
  const db = getFirestore(initAdmin());
  return db.runTransaction((transaction) => admit(transaction, bookingRef.trim(), now, context, contextError));
}
