// A2 — a genuinely PAID ticket for this show is still admitted, and Firestore really
// flips to 'checked-in'. This is the regression guard that stops A1/A3/A4 being
// satisfied by a scanner that has simply learned to refuse everything.

import { loadCheckin, shared } from './_checkin-harness.mts';

const s = await shared();

await s.withCleanup('A2 paid ticket is admitted and Firestore flips to checked-in', async () => {
  const { checkInByBookingRef } = await loadCheckin();
  const id = s.runId();
  const bookingRef = `HARDEN-PAID-${id}`;
  const ref = await s.createTicketDoc({
    bookingRef,
    attendeeEmail: s.sentinelEmail(`paid-${id}`),
    status: 'paid',
    purchasedAt: new Date(),
  });

  const result = await checkInByBookingRef(bookingRef);
  s.assert(
    result.ok === true,
    `a paid ticket for this show was REFUSED — result: ${JSON.stringify(result)}`
  );

  const after = await s.readTicketById(ref.id);
  s.assert(
    after?.status === 'checked-in',
    `Firestore read-back: expected status 'checked-in', got '${after?.status}'`
  );
  s.assert(after?.checkedInAt != null, 'Firestore read-back: checkedInAt was not stamped');
});
