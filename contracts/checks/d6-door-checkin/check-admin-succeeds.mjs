// D6-13 / D6-16 replacement, plus the necessary positive control for D6-11/D6-12: a
// genuine admin session (real Firebase Auth user, admin:true claim, minted the same way
// every other admin-auth-hardening check mints one, through the real
// /api/admin/session route) succeeds at the door, and the REAL OBSERABLE OUTCOME is
// asserted — the actual HTTP response AND the actual Firestore document read back after
// the call — rather than two literals ("tickets"/"bookingRef", or "checked-in"/"status")
// merely co-occurring somewhere in the route's source. This is also the required
// positive control for D6-11 and D6-12: without it, a route that refused EVERY caller
// unconditionally would satisfy both of those checks by accident.

import {
  runId,
  createPaidTicketFixture,
  readTicketByBookingRef,
  deleteTicketFixture,
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  postSession,
  postCheckinApi,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('D6-13/D6-16 a genuine admin session actually checks a ticket in', async (r) => {
  await warmUp([{ path: '/api/admin/session', method: 'POST' }, '/api/admin/checkin']);

  const bookingRef = `D6-ADMIN-${runId()}`;
  await createPaidTicketFixture(bookingRef);
  const fixture = await createAllowlistedFixtureUser();
  try {
    const session = await postSession(fixture.idToken);
    r.check(session.status === 200 && Boolean(session.cookie), 'a real admin session mints successfully', `got ${session.status}`);
    if (!session.cookie) return;

    const before = await readTicketByBookingRef(bookingRef);
    r.check(before?.status === 'paid' && before?.checkedInAt == null, 'sanity: fixture ticket starts paid, not checked in');

    const res = await postCheckinApi(session.cookie, bookingRef);
    r.check(res.status === 200, 'checkin succeeds 200 for a genuine admin session', `got ${res.status} — ${res.body.slice(0, 300)}`);

    let parsed = null;
    try { parsed = JSON.parse(res.body); } catch { /* leave null, checked below */ }
    r.check(parsed?.success === true, 'response body reports success: true', res.body.slice(0, 300));

    const after = await readTicketByBookingRef(bookingRef);
    r.check(
      after?.status === 'checked-in',
      'the REAL Firestore document status is actually set to checked-in (not just the literal present in source)',
      `status=${after?.status}`,
    );
    r.check(after?.checkedInAt != null, 'the REAL Firestore document has a checkedInAt timestamp actually written');

    // Double-scan: the route must refuse a second check-in of the SAME already-admitted
    // ticket, proving the write is real state the route itself reads back, not a
    // stateless "always succeed" response.
    const second = await postCheckinApi(session.cookie, bookingRef);
    r.check(second.status === 409, 'a second check-in of the same now-checked-in ticket is refused (proves the first write was real, persisted state)', `got ${second.status}`);
  } finally {
    await deleteTicketFixture(bookingRef);
    await deleteAllowlistedFixtureUser(fixture.uid);
  }
});
