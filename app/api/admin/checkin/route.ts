import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { checkInByBookingRef, type CheckinRefusalCode } from '@/lib/checkin';
import {
  logAuditWriteFailure,
  recordCheckinAttempt,
  type CheckinAttemptOutcome,
} from '@/lib/checkin-audit';
import { createFirestoreCheckinAttemptsStore } from '@/lib/checkin-audit-store';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * Door check-in endpoint. Auth only — every admission rule lives in lib/checkin.ts
 * (contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md), so the
 * decision table cannot drift between the scanner and anything else that admits a
 * ticket. Nothing is read from or written to Firestore before auth passes.
 *
 * F7 (ticketing-foundation) adds an append-only checkinAttempts audit record for every
 * outcome below (contracts/golden/ticketing-f7-checkin-audit/README.md). Deliberately NOT
 * wired here: a hard `scan-checkin` capability refusal via `hasCapability()`. The golden
 * README's own "Judgement call 3" flags that live enforcement as unsafe to ship before
 * `scripts/admin-migrate-roles.ts --apply` has run — today it hasn't, zero accounts hold a
 * `roles` claim, and switching this on would refuse every door scanner, including Brad's, with
 * no gate to catch it. The `'not-authorized'` outcome exists in the type and is proven
 * end-to-end against the pure module (see contract A3); it simply has no live trigger in this
 * route yet. See the README's "Hard prerequisite" before adding one.
 */

/** Maps lib/checkin.ts's five-member CheckinRefusalCode onto F7's honestly-wider outcome
 *  enum — 'bad-request' becomes 'malformed' (see golden README "Judgement call 1"); every
 *  other name is unchanged. */
const REFUSAL_CODE_TO_OUTCOME: Record<CheckinRefusalCode, CheckinAttemptOutcome> = {
  'bad-request': 'malformed',
  'not-found': 'not-found',
  'wrong-show': 'wrong-show',
  unpaid: 'unpaid',
  'already-checked-in': 'already-checked-in',
};

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
  }

  const scannedByUid = session.decodedToken.uid;
  const store = createFirestoreCheckinAttemptsStore();

  /** Writes one audit record OUTSIDE the checkin transaction (golden README "Judgement call
   *  2") and never blocks the response on it — a failed write is logged loudly, never thrown. */
  async function audit(
    outcome: CheckinAttemptOutcome,
    bookingRef: string | null,
    showId: string | null,
    orderId: string | null,
    refusalReason: string | null
  ): Promise<void> {
    const auditResult = await recordCheckinAttempt(store, {
      bookingRef,
      showId,
      orderId,
      outcome,
      refusalReason,
      scannedByUid,
      now: new Date(),
    });
    if (!auditResult.recorded) {
      logAuditWriteFailure({ bookingRef, showId, outcome, error: auditResult.error });
    }
  }

  let body: { bookingRef?: unknown };
  try {
    body = (await request.json()) as { bookingRef?: unknown };
  } catch (error) {
    console.error('[admin/checkin] Failed to parse request body:', error);
    await audit('malformed', null, null, null, 'Invalid request body.');
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const bookingRef = typeof body.bookingRef === 'string' ? body.bookingRef.trim() : null;

  let result: Awaited<ReturnType<typeof checkInByBookingRef>>;
  try {
    result = await checkInByBookingRef(body.bookingRef);
  } catch (error) {
    console.error('[admin/checkin] Check-in failed:', error);
    // 'infra-error' (golden README "A third addition") — checkInByBookingRef() threw for a
    // reason unrelated to any admission decision (e.g. a Firestore outage mid-transaction).
    // bookingRef and showId are both known here (parsed above, scoped to the only show this
    // door ever checks in for); orderId is null — the throw happened before any position could
    // be resolved. Wrapped in its own try/catch, on top of recordCheckinAttempt()'s own
    // never-throws guarantee (A6): a logging fault here must never stop this 500 from being
    // sent to a door scanner that is already failing.
    try {
      await audit('infra-error', bookingRef, NATIONAL_SHOW_ID, null, 'Check-in failed. Please try again.');
    } catch (auditError) {
      console.error('[admin/checkin] Unexpected audit failure on infra-error path:', auditError);
    }
    return NextResponse.json(
      { success: false, error: 'Check-in failed. Please try again.' },
      { status: 500 }
    );
  }

  if (!result.ok) {
    const outcome = REFUSAL_CODE_TO_OUTCOME[result.code];
    // Nothing beyond the refusal code itself is resolvable here without widening
    // lib/checkin.ts's CheckinResult shape (out of F7's minimal scope): the show a
    // 'wrong-show'/'unpaid'/'already-checked-in' refusal was decided against is always
    // NATIONAL_SHOW_ID (the only show this door ever checks in for); 'not-found' and
    // 'malformed' never resolved a ticket at all, so showId stays null.
    const showId = outcome === 'not-found' || outcome === 'malformed' ? null : NATIONAL_SHOW_ID;
    await audit(outcome, bookingRef, showId, null, result.error);
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.httpStatus }
    );
  }

  await audit(
    'admit',
    result.ticket.bookingRef,
    result.ticket.showId,
    result.ticket.orderId,
    null
  );
  return NextResponse.json({ success: true, ticket: result.ticket });
}
