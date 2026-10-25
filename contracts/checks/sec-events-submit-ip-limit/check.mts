// Usage: pnpm exec tsx --experimental-test-module-mocks contracts/checks/sec-events-submit-ip-limit/check.mts
// POST /api/events/submit must cap submissions per client IP across throwaway accounts (uids are
// free to mint) WITHOUT letting unauthenticated callers spend an address's allowance.
// Firebase is mocked: a token "uid-<n>" verifies as that uid. A valid body ends the request at
// 500 "CMS not configured" (no Sanity token), which is after both limiters and before any write;
// an invalid body ends at 400, before the IP limiter.
import { mock } from 'node:test';
import { NextRequest } from 'next/server';

delete process.env.SANITY_API_TOKEN;

mock.module('firebase-admin/auth', {
  exports: {
    getAuth: () => ({
      verifyIdToken: async (token: string) => {
        if (!token.startsWith('uid-')) throw new Error('bad token');
        return { uid: token, email_verified: true };
      },
    }),
  },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => undefined },
});

const { POST } = await import('../../../app/api/events/submit/route.ts');
const { PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS: MAX } = await import(
  '../../../lib/public-form-rate-limit.ts'
);

const HTTP_BAD_REQUEST = 400;
const HTTP_COUNTED = 500; // valid body, stopped by the missing CMS token
const WINDOW_SECONDS = 3600;
const FUTURE_DATE = '2999-01-01T10:00:00Z';
const VALID_BODY = JSON.stringify({
  title: 'Spring show',
  kind: 'show',
  date: FUTURE_DATE,
  venue: 'Town hall',
  location: 'Cape Town',
  description: 'A description that is comfortably long enough.',
});
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;

// x-forwarded-for on App Hosting reads "<client-supplied...>, <client ip>, <lb ip>".
function post(
  realIp: string,
  token: string | null,
  spoofedFirstHop = '198.51.100.1',
  body = VALID_BODY,
): Promise<Response> {
  const headers: Record<string, string> = { 'x-forwarded-for': `${spoofedFirstHop}, ${realIp}, 10.0.0.1` };
  if (token) headers.authorization = `Bearer ${token}`;
  return POST(new NextRequest('http://localhost/api/events/submit', { method: 'POST', headers, body }));
}

const fails: string[] = [];
const expectStatus = async (label: string, res: Promise<Response>, want: number) => {
  const got = (await res).status;
  if (got !== want) fails.push(`${label}: expected ${want}, got ${got}`);
};

// 1. Unauthenticated traffic must not spend the address's allowance (shared NAT, verified users).
for (let i = 1; i <= MAX + 3; i += 1) {
  await expectStatus(`unauthenticated #${i}`, post('203.0.113.1', null), HTTP_UNAUTHORIZED);
}
for (let i = 1; i <= MAX + 3; i += 1) {
  // Invalid bodies from distinct verified users must not spend the address's allowance either.
  await expectStatus(`invalid body #${i}`, post('203.0.113.1', `uid-bad${i}`, undefined, 'not json'), HTTP_BAD_REQUEST);
}
await expectStatus('verified user behind the same address', post('203.0.113.1', 'uid-nat'), HTTP_COUNTED);

// 2. Throwaway accounts from one address (forged first hop each time) hit the per-IP cap.
for (let i = 1; i <= MAX; i += 1) {
  await expectStatus(`throwaway #${i}`, post('203.0.113.2', `uid-t${i}`, `192.0.2.${i}`), HTTP_COUNTED);
}
const tripped = await post('203.0.113.2', 'uid-t99', '192.0.2.99');
if (tripped.status !== HTTP_TOO_MANY_REQUESTS) {
  fails.push(`throwaway #${MAX + 1}: expected 429, got ${tripped.status}`);
} else {
  const retryAfter = Number(tripped.headers.get('Retry-After'));
  if (!Number.isInteger(retryAfter) || retryAfter < 1 || retryAfter > WINDOW_SECONDS) {
    fails.push(`IP 429 Retry-After must be an integer in 1..${WINDOW_SECONDS}, got ${tripped.headers.get('Retry-After')}`);
  }
}
await expectStatus('other address unaffected', post('203.0.113.3', 'uid-other'), HTTP_COUNTED);

// 3. The per-uid limit still holds across addresses.
for (let i = 1; i <= MAX; i += 1) {
  await expectStatus(`same uid #${i}`, post(`203.0.113.${10 + i}`, 'uid-same'), HTTP_COUNTED);
}
await expectStatus('same uid over cap', post('203.0.113.99', 'uid-same'), HTTP_TOO_MANY_REQUESTS);

if (fails.length > 0) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('PASS sec-events-submit-ip-limit');
