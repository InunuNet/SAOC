// D6-11 — the door check-in route's OWN admin-claim enforcement, proved independently of
// the /api/admin/session mint route's separate enforcement of the same rule. A real,
// verified, non-admin Firebase Auth user is given a GENUINELY VALID session cookie
// (minted directly via Admin SDK createSessionCookie, bypassing the app's session route
// entirely) and POSTs it to /api/admin/checkin against a real paid ticket. Must be
// refused 403, and the ticket must be untouched. This is the exact regression the audit
// flagged: a route that verifies a session cookie but never checks the admin claim would
// previously still satisfy the old grep-only assertion.

import {
  runId,
  sentinelEmail,
  createPaidTicketFixture,
  readTicketByBookingRef,
  deleteTicketFixture,
  mintNonAdminSessionCookie,
  deleteAuthUserByEmail,
  randomNonAdminFixtureEmail,
  postCheckinApi,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('D6-11 non-admin authenticated session is refused at the door', async (r) => {
  await warmUp(['/api/admin/checkin']);

  const bookingRef = `D6-NONADMIN-${runId()}`;
  const email = randomNonAdminFixtureEmail();
  await createPaidTicketFixture(bookingRef);
  try {
    const { uid, cookie } = await mintNonAdminSessionCookie(email);
    r.check(Boolean(cookie), 'a valid session cookie was minted for the non-admin fixture user');

    const res = await postCheckinApi(cookie, bookingRef);
    r.check(res.status === 403, 'checkin is refused 403 for a valid session belonging to a non-admin user', `got ${res.status} — ${res.body.slice(0, 300)}`);

    const after = await readTicketByBookingRef(bookingRef);
    r.check(
      after?.status === 'paid' && after?.checkedInAt == null,
      'the ticket was NOT mutated by the refused non-admin request',
      `status=${after?.status}, checkedInAt=${JSON.stringify(after?.checkedInAt)}`,
    );

    await deleteAuthUserByEmail(email);
    void uid;
  } finally {
    await deleteTicketFixture(bookingRef);
    await deleteAuthUserByEmail(email);
  }
  void sentinelEmail;
});
