// A1 — a RESERVED (unpaid) ticket is refused at the door, and Firestore proves nothing
// was written. This is the highest-severity defect: a reservation doc exists from the
// moment a checkout is initiated, so today anyone who starts and abandons a checkout
// holds a working door code.

import { loadCheckin, shared } from './_checkin-harness.mts';

const s = await shared();

await s.withCleanup('A1 reserved (unpaid) ticket is refused and left untouched', async () => {
  const { checkInByBookingRef } = await loadCheckin();
  const id = s.runId();
  const bookingRef = `HARDEN-RESERVED-${id}`;
  const ref = await s.createTicketDoc({
    bookingRef,
    attendeeEmail: s.sentinelEmail(`reserved-${id}`),
    status: 'reserved',
  });

  const result = await checkInByBookingRef(bookingRef);
  s.assert(
    result.ok === false,
    `an unpaid (reserved) ticket was ADMITTED — result: ${JSON.stringify(result)}`
  );
  s.assert(
    result.code === 'unpaid' && result.httpStatus === 403,
    `expected refusal code 'unpaid' / HTTP 403, got '${result.code}' / ${result.httpStatus}`
  );

  const after = await s.readTicketById(ref.id);
  s.assert(
    after?.status === 'reserved',
    `Firestore read-back: refused check-in still mutated status to '${after?.status}'`
  );
  s.assert(
    after?.checkedInAt == null,
    'Firestore read-back: refused check-in still stamped checkedInAt'
  );
});
