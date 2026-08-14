// A-NEGCTL-01 — negative control. Proves this contract's core probe-and-assert logic
// (A-PROBE-01's session-mint assertion) is capable of reporting a FAILURE, by running
// it against a fixture server that deliberately reproduces the PRE-FIX defect (mints a
// cookie for any idToken, no allowlist check) instead of the real app. If this check
// ever reports PASS, the probe logic itself is broken and every green result elsewhere
// in this contract is suspect — an assertion that cannot fail proves nothing.
//
// Self-contained: starts its own fixture server on a scratch port, never touches the
// real dev server, safe to run in the same phase as everything else.

import { signUpProbeAccount, deleteAccountByIdToken, runCheck } from './_shared.mjs';
import { startWeakenedFixture } from './_weakened-fixture.mjs';

const FIXTURE_PORT = 8933;

await runCheck('A-NEGCTL-01 negative control — probe logic detects a weakened gate', async (r) => {
  const server = await startWeakenedFixture(FIXTURE_PORT);
  const probe = await signUpProbeAccount();
  try {
    const res = await fetch(`http://127.0.0.1:${FIXTURE_PORT}/api/admin/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: probe.idToken }),
    });
    const setCookie = res.headers.get('set-cookie');

    // This is the INVERSE of A-PROBE-01's assertion: against the weakened fixture, the
    // probe MUST succeed (200 + cookie), because that is the defect being reproduced.
    // If this fails, the probe logic cannot tell a weak gate from a strong one.
    r.check(
      res.status === 200 && Boolean(setCookie),
      'probe-and-assert logic correctly identifies the weakened fixture as vulnerable (200 + cookie issued)',
      `got status=${res.status}, setCookie=${Boolean(setCookie)}`,
    );
  } finally {
    await deleteAccountByIdToken(probe.idToken);
    await new Promise((resolve) => server.close(resolve));
  }
});
