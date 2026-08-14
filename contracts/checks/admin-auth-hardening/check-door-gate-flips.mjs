// A-DOOR-01 — the one confirmed defect this contract must flip from red to green:
// /admin/door currently returns 200 with the scanner UI to anyone, unauthenticated.
// Checked with NO cookie (the simplest case) — the probe-account variant lives inside
// A-PROBE-01 alongside the rest of that account's journey.

import { getDoorPage, warmUp, runCheck } from './_shared.mjs';

await runCheck('A-DOOR-01 /admin/door gated for unauthenticated visitor', async (r) => {
  await warmUp(['/admin/door']);

  const door = await getDoorPage(undefined);
  r.check(
    door.status === 307 || door.status === 302,
    '/admin/door redirects unauthenticated (was 200 in the 2026-08-14 baseline)',
    `got ${door.status}`,
  );
  r.check(
    Boolean(door.location && door.location.includes('/admin/login')),
    '/admin/door redirect target is /admin/login',
    `got location=${door.location}`,
  );
  r.check(!door.body.includes('qr-reader'), '/admin/door response carries no scanner markup unauthenticated');
});
