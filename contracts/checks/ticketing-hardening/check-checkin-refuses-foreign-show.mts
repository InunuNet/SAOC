// A3 — a PAID ticket belonging to a different show is refused. The scanner must scope
// admission to this show; a ticket doc written with any other showId (a future show, or
// a spoofed value from an era before the checkout route validated showId) must not open
// the door at the 2027 National Show.

import { loadCheckin, shared } from './_checkin-harness.mts';

const FOREIGN_SHOW_ID = 'nationalShow-2029-not-this-one';

const s = await shared();

await s.withCleanup('A3 paid ticket for another show is refused and left untouched', async () => {
  const { checkInByBookingRef } = await loadCheckin();
  const id = s.runId();
  const bookingRef = `HARDEN-FOREIGN-${id}`;
  const ref = await s.createTicketDoc({
    bookingRef,
    attendeeEmail: s.sentinelEmail(`foreign-${id}`),
    showId: FOREIGN_SHOW_ID,
    status: 'paid',
    purchasedAt: new Date(),
  });

  const result = await checkInByBookingRef(bookingRef);
  s.assert(
    result.ok === false,
    `a ticket for showId '${FOREIGN_SHOW_ID}' was ADMITTED — result: ${JSON.stringify(result)}`
  );
  s.assert(
    result.code === 'wrong-show' && result.httpStatus === 403,
    `expected refusal code 'wrong-show' / HTTP 403, got '${result.code}' / ${result.httpStatus}`
  );

  const after = await s.readTicketById(ref.id);
  s.assert(
    after?.status === 'paid' && after?.checkedInAt == null,
    `Firestore read-back: refused check-in mutated the doc (status '${after?.status}', checkedInAt ${String(after?.checkedInAt)})`
  );
});
