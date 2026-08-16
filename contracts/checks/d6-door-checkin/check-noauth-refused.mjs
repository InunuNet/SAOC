// D6-12 — no session cookie, and a syntactically-invalid session cookie, must both be
// refused 401 by the checkin route, mutating nothing. Unlike the old grep for the digits
// "401" or "403" anywhere in the file (which a 403 on an unrelated validation error would
// also satisfy), this is a real HTTP round-trip against a real paid ticket with a real
// Firestore read-back proving no mutation occurred.

import {
  runId,
  createPaidTicketFixture,
  readTicketByBookingRef,
  deleteTicketFixture,
  postCheckinApi,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('D6-12 unauthenticated / invalid-cookie requests are refused 401', async (r) => {
  await warmUp(['/api/admin/checkin']);

  const bookingRef = `D6-NOAUTH-${runId()}`;
  await createPaidTicketFixture(bookingRef);
  try {
    const noCookie = await postCheckinApi(null, bookingRef);
    r.check(noCookie.status === 401, 'no session cookie is refused 401', `got ${noCookie.status}`);

    const forged = await postCheckinApi('session=not-a-real-session-cookie', bookingRef);
    r.check(forged.status === 401, 'a syntactically invalid session cookie is refused 401', `got ${forged.status}`);

    const after = await readTicketByBookingRef(bookingRef);
    r.check(
      after?.status === 'paid' && after?.checkedInAt == null,
      'the ticket was NOT mutated by either refused unauthenticated request',
      `status=${after?.status}, checkedInAt=${JSON.stringify(after?.checkedInAt)}`,
    );
  } finally {
    await deleteTicketFixture(bookingRef);
  }
});
