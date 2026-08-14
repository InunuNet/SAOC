// A-REGRESS-01 — the four surfaces the mission's baseline already measured correct
// must STAY correct. A fix that breaks a working gate is a regression, not a fix.
// Run with NO cookie at all (the simplest unauthenticated case, distinct from the probe
// account covered by A-PROBE-01) so this check is meaningful even if the probe-account
// check above is ever skipped or changed.

import { getAdminPage, getTicketsApi, getExportCsvApi, warmUp, runCheck } from './_shared.mjs';

await runCheck('A-REGRESS-01 baseline-correct surfaces stay correct, unauthenticated', async (r) => {
  await warmUp(['/admin', '/api/admin/tickets', '/api/admin/export-csv']);

  const admin = await getAdminPage(undefined);
  r.check(admin.status === 307 || admin.status === 302, '/admin still redirects unauthenticated', `got ${admin.status}`);
  r.check(
    Boolean(admin.location && admin.location.includes('/admin/login')),
    '/admin still redirects to /admin/login unauthenticated',
  );

  const tickets = await getTicketsApi(undefined);
  r.check(tickets.status === 401 || tickets.status === 403, '/api/admin/tickets still refuses unauthenticated', `got ${tickets.status}`);

  const csv = await getExportCsvApi(undefined);
  r.check(csv.status === 401 || csv.status === 403, '/api/admin/export-csv still refuses unauthenticated', `got ${csv.status}`);
});
