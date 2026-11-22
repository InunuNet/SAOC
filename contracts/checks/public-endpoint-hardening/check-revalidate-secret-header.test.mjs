// Public-endpoint hardening F12: POST /api/revalidate takes its secret from the
// `x-sanity-secret` header (the form docs/launch-checklist.md section 4 configures for the Sanity
// webhook), compared in constant time, and still accepts the legacy `?secret=` query form so a
// webhook configured that way keeps working. Wrong, missing and empty secrets are all 401.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/public-endpoint-hardening/check-revalidate-secret-header.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';

const SECRET = 'test-revalidate-secret-0123456789abcdef';
process.env.SANITY_REVALIDATE_SECRET = SECRET;
delete process.env.SAOC_APP_SECRETS;

const revalidated = [];
mock.module('next/cache', {
  exports: { revalidateTag: (tag) => revalidated.push(tag) },
});

const { POST } = await import('../../../app/api/revalidate/route.ts');

function call({ headers = {}, query = '' } = {}) {
  return POST(
    new NextRequest(`http://localhost/api/revalidate${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ _type: 'event' }),
    }),
  );
}

test('header secret: accepted, revalidates the global and per-type tags', async () => {
  revalidated.length = 0;
  const res = await call({ headers: { 'x-sanity-secret': SECRET } });
  assert.equal(res.status, 200);
  assert.deepEqual(revalidated, ['sanity', 'event']);
});

test('legacy query secret: still accepted so existing webhooks keep working', async () => {
  revalidated.length = 0;
  const res = await call({ query: `?secret=${SECRET}` });
  assert.equal(res.status, 200);
  assert.deepEqual(revalidated, ['sanity', 'event']);
});

test('wrong, wrong-length, empty and missing secrets are all 401 and revalidate nothing', async () => {
  revalidated.length = 0;
  const attempts = [
    { headers: { 'x-sanity-secret': 'wrong' } },
    { headers: { 'x-sanity-secret': `${SECRET}x` } },
    { headers: { 'x-sanity-secret': '' } },
    { query: '?secret=wrong' },
    { query: '?secret=' },
    {},
  ];
  for (const attempt of attempts) {
    const res = await call(attempt);
    assert.equal(res.status, 401, JSON.stringify(attempt));
    assert.deepEqual(await res.json(), { ok: false, error: 'Invalid secret' });
  }
  assert.deepEqual(revalidated, []);
});

test('a wrong header is not rescued by a correct query secret on the same request', async () => {
  const res = await call({ headers: { 'x-sanity-secret': 'wrong' }, query: `?secret=${SECRET}` });
  assert.equal(res.status, 401);
});

test('no configured secret: fails closed even for an empty provided secret', async () => {
  const saved = process.env.SANITY_REVALIDATE_SECRET;
  delete process.env.SANITY_REVALIDATE_SECRET;
  try {
    const res = await call({ headers: { 'x-sanity-secret': '' } });
    assert.equal(res.status, 401);
  } finally {
    process.env.SANITY_REVALIDATE_SECRET = saved;
  }
});
