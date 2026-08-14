// A-PROBE-01 — the adversarial proof the mission exists to produce.
//
// Reproduces the original attack exactly: an unauthenticated POST to
// identitytoolkit.googleapis.com/v1/accounts:signUp using the PUBLIC web API key,
// attempts the session exchange, then attempts every admin surface — asserting refusal
// and NO data leak at each one. Deletes the probe account afterwards and asserts it is
// gone, even if an assertion above failed.

import {
  signUpProbeAccount,
  deleteAccountByIdToken,
  assertAccountGone,
  postSession,
  getAdminPage,
  getDoorPage,
  getTicketsApi,
  getExportCsvApi,
  postCheckinApi,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('A-PROBE-01 probe account refused everywhere', async (r) => {
  // Warm-up runs before ANY assertion below and has its own timeout budget — a cold
  // connection here must never eat into the assertions' timeout_seconds.
  await warmUp([
    { path: '/api/admin/session', method: 'POST' },
    '/admin',
    '/admin/door',
    '/api/admin/tickets',
    '/api/admin/export-csv',
    { path: '/api/admin/checkin', method: 'POST' },
  ]);

  const probe = await signUpProbeAccount();
  try {
    // 1. session exchange must be refused, and must NOT set a cookie.
    const session = await postSession(probe.idToken);
    r.check(session.status === 403, 'POST /api/admin/session returns 403 for probe account', `got ${session.status}`);
    r.check(!session.setCookieHeaderPresent, 'POST /api/admin/session sets no Set-Cookie header for probe account');

    // No cookie was issued, so every surface below is hit with NO cookie at all —
    // the state a refused attacker is actually left in.
    const noCookie = undefined;

    const admin = await getAdminPage(noCookie);
    r.check(admin.status === 307 || admin.status === 302, '/admin redirects (no data rendered) for probe account', `got ${admin.status}`);
    r.check(
      Boolean(admin.location && admin.location.includes('/admin/login')),
      '/admin redirect target is /admin/login for probe account',
      `got location=${admin.location}`,
    );

    const door = await getDoorPage(noCookie);
    r.check(door.status === 307 || door.status === 302, '/admin/door redirects (no scanner UI) for probe account', `got ${door.status}`);
    r.check(
      Boolean(door.location && door.location.includes('/admin/login')),
      '/admin/door redirect target is /admin/login for probe account',
    );
    r.check(!door.body.includes('qr-reader'), '/admin/door response body carries no scanner markup for probe account');

    const tickets = await getTicketsApi(noCookie);
    r.check(tickets.status === 401 || tickets.status === 403, '/api/admin/tickets refuses probe account', `got ${tickets.status}`);
    r.check(!tickets.body.includes('bookingRef'), '/api/admin/tickets response leaks no ticket data to probe account');

    const csv = await getExportCsvApi(noCookie);
    r.check(csv.status === 401 || csv.status === 403, '/api/admin/export-csv refuses probe account', `got ${csv.status}`);
    r.check(!csv.body.includes('bookingRef'), '/api/admin/export-csv response leaks no CSV data to probe account');

    const checkin = await postCheckinApi(noCookie);
    r.check(checkin.status === 401 || checkin.status === 403, '/api/admin/checkin refuses probe account', `got ${checkin.status}`);
  } finally {
    // Cleanup runs whether assertions passed or failed — a leaked probe account is
    // unacceptable regardless of the check's outcome.
    await deleteAccountByIdToken(probe.idToken);
    await assertAccountGone(probe.idToken).then(
      () => r.check(true, 'probe account no longer resolves after deletion'),
      (err) => r.fail('probe account no longer resolves after deletion', err.message),
    );
  }
});
