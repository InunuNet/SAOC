// Run only via check-route-matrix.sh under `firebase emulators:exec --only auth`.
// Drives the real POST handler of /api/events/submit with real emulator-issued ID tokens and
// compares each case to the golden matrix. Never sends a valid body, so nothing reaches Sanity.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const GOLDEN = new URL(
  '../../../.agent/memory/project/specs/nos-security-tiered-access/sec-03/goldens/route-auth-matrix.golden.json',
  import.meta.url,
);
const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host) throw new Error('FIREBASE_AUTH_EMULATOR_HOST is not set; run via check-route-matrix.sh');

const allowlisted = [];
process.env.ADMIN_EMAIL_ALLOWLIST = '';
process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??= 'sec03fixture';
process.env.NEXT_PUBLIC_SANITY_DATASET ??= 'production';

// initAdmin() returns the first existing app, so the emulator app below is what the route uses.
const app = initializeApp({ projectId: 'demo-saoc-webapp' });
const auth = getAuth(app);
const { POST } = await import('../../../app/api/events/submit/route.ts');
const { NextRequest } = await import('next/server');

const PASSWORD = 'throwaway-fixture-password-1';
const created = [];

async function makeUser(label, { emailVerified, claims, listed = false }) {
  const addr = `sec03-${label}-${Date.now()}@example-fixture.invalid`;
  if (listed) {
    allowlisted.push(addr);
    process.env.ADMIN_EMAIL_ALLOWLIST = allowlisted.join(',');
  }
  const user = await auth.createUser({ email: addr, password: PASSWORD, emailVerified });
  created.push(user.uid);
  if (claims) await auth.setCustomUserClaims(user.uid, claims);
  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addr, password: PASSWORD, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`signInWithPassword failed for ${label}: ${JSON.stringify(body)}`);
  return { uid: user.uid, token: body.idToken };
}

async function call(token) {
  const headers = { 'content-type': 'application/json', 'content-length': '2' };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const res = await POST(
    new NextRequest('http://localhost/api/events/submit', { method: 'POST', headers, body: '{}' }),
  );
  let json = {};
  try {
    json = await res.json();
  } catch {
    // non-JSON body: leave json empty, the status comparison below still decides
  }
  return { status: res.status, error: json.error };
}

const builders = {
  'no-token': async () => null,
  'garbage-token': async () => 'not-a-jwt',
  'unverified-no-claim': async () => (await makeUser('unv', { emailVerified: false })).token,
  'verified-non-admin': async () => (await makeUser('nonadmin', { emailVerified: true })).token,
  'claim-unverified': async () =>
    (await makeUser('claimunv', { emailVerified: false, claims: { admin: true }, listed: true })).token,
  'claim-verified-not-allowlisted': async () =>
    (await makeUser('notlisted', { emailVerified: true, claims: { admin: true } })).token,
  'deleted-user': async () => {
    const u = await makeUser('deleted', { emailVerified: true, claims: { admin: true }, listed: true });
    await auth.deleteUser(u.uid);
    return u.token;
  },
  'disabled-user': async () => {
    const u = await makeUser('disabled', { emailVerified: true, claims: { admin: true }, listed: true });
    await auth.updateUser(u.uid, { disabled: true });
    return u.token;
  },
  'revoked-token': async () => {
    const u = await makeUser('revoked', { emailVerified: true, claims: { admin: true }, listed: true });
    await new Promise((r) => setTimeout(r, 1100)); // revocation compares whole seconds: auth_time must be strictly earlier
    await auth.revokeRefreshTokens(u.uid);
    return u.token;
  },
  'admin-passes-gate': async () =>
    (await makeUser('admin', { emailVerified: true, claims: { admin: true }, listed: true })).token,
};

let failures = 0;
try {
  for (const c of golden.cases) {
    const build = builders[c.id];
    if (!build) throw new Error(`golden case ${c.id} has no builder`);
    const result = await call(await build());
    const statusOk = result.status === c.status;
    const copyOk = c.error === undefined || result.error === c.error;
    console.log(`${statusOk && copyOk ? 'PASS' : 'FAIL'} ${c.id}: got ${result.status} ${result.error ?? ''}, want ${c.status} ${c.error ?? ''}`);
    if (!statusOk || !copyOk) failures += 1;
  }
} finally {
  for (const uid of created) await auth.deleteUser(uid).catch(() => {});
}
process.exit(failures === 0 ? 0 : 1);
