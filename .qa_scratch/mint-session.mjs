// QA scratch: mint a real admin session cookie for the door-checkin-success-feedback
// visual pass, reusing contracts/checks/admin-auth-hardening/_shared.mjs's exact
// fixture-user pattern (createAllowlistedFixtureUser -> real POST /api/admin/session).
// Targets https://dev.saoc.co.za:3334 (pnpm dev:secure), not the isolated build-server
// harness, because we need the actual dev-mode client bundle rendering, not a prod build.
import { createAllowlistedFixtureUser } from '../contracts/checks/admin-auth-hardening/_shared.mjs';

const BASE_URL = 'https://dev.saoc.co.za:3334';

const { uid, email, idToken } = await createAllowlistedFixtureUser();

const res = await fetch(`${BASE_URL}/api/admin/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ idToken }),
});

if (!res.ok) {
  console.error('FAIL', res.status, await res.text());
  process.exit(1);
}

const setCookie = res.headers.get('set-cookie');
const match = setCookie?.match(/session=([^;]+)/);
if (!match) {
  console.error('FAIL: no session cookie in response', setCookie);
  process.exit(1);
}

console.log(JSON.stringify({ uid, email, sessionCookie: match[1] }));
