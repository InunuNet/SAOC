// A-ALLOW-01 — the gate must not simply refuse everyone. Proves a genuinely
// allowlisted, claim-bearing, verified identity can still: exchange a session, load
// the ticket list, download the CSV, load the admin page, and load the door scanner.
//
// PRECONDITION: the email in ALLOWLISTED_FIXTURE_EMAIL (default
// admin-auth-check-allowlisted@saoc.co.za, override with
// ADMIN_AUTH_CHECK_ALLOWLISTED_EMAIL) must already be present in the RUNNING SERVER's
// ADMIN_EMAIL_ALLOWLIST env var. This check cannot set that itself — see
// contracts/golden/admin-auth-hardening/README.md "Fixture accounts". If this
// precondition is not met, every assertion below fails with a 403 and the failure
// message says so explicitly rather than reporting a silent skip.

import {
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  postSession,
  getAdminPage,
  getDoorPage,
  getTicketsApi,
  getExportCsvApi,
  ALLOWLISTED_FIXTURE_EMAIL,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('A-ALLOW-01 allowlisted identity succeeds everywhere', async (r) => {
  await warmUp([
    { path: '/api/admin/session', method: 'POST' },
    '/admin',
    '/admin/door',
    '/api/admin/tickets',
    '/api/admin/export-csv',
  ]);

  const fixture = await createAllowlistedFixtureUser();
  try {
    const session = await postSession(fixture.idToken);
    const preconditionHint = session.status === 403
      ? ` — is ${ALLOWLISTED_FIXTURE_EMAIL} actually present in the server's ADMIN_EMAIL_ALLOWLIST?`
      : '';
    r.check(session.status === 200, 'POST /api/admin/session succeeds for allowlisted identity', `got ${session.status}${preconditionHint}`);
    r.check(Boolean(session.cookie), 'POST /api/admin/session issues a session cookie for allowlisted identity');

    if (!session.cookie) {
      r.fail('remaining A-ALLOW-01 checks skipped — no cookie to use', 'session mint failed above; see precondition hint');
      return;
    }

    const admin = await getAdminPage(session.cookie);
    r.check(admin.status === 200, '/admin renders (200) for allowlisted identity', `got ${admin.status}`);

    const door = await getDoorPage(session.cookie);
    r.check(door.status === 200, '/admin/door renders (200) for allowlisted identity', `got ${door.status}`);
    r.check(door.body.includes('qr-reader'), '/admin/door response includes the scanner markup for allowlisted identity');

    const tickets = await getTicketsApi(session.cookie);
    r.check(tickets.status === 200, '/api/admin/tickets returns 200 for allowlisted identity', `got ${tickets.status}`);

    const csv = await getExportCsvApi(session.cookie);
    r.check(csv.status === 200, '/api/admin/export-csv returns 200 for allowlisted identity', `got ${csv.status}`);
  } finally {
    await deleteAllowlistedFixtureUser(fixture.uid);
  }
});
