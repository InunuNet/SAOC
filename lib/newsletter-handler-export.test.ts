import assert from 'node:assert/strict';
import test from 'node:test';

import type { DecodedIdToken } from 'firebase-admin/auth';

import { handleNewsletterExport, type ExportDeps } from './newsletter-handler';

const TOKEN = { uid: 'staff' } as DecodedIdToken; // minimal token; the handler only forwards it

function deps(overrides: Partial<ExportDeps>): ExportDeps {
  return {
    getSession: async () => ({ ok: true, decodedToken: TOKEN }),
    hasCapability: async () => true,
    origin: () => 'https://saoc.test',
    list: 'all',
    listSubscribers: async () => [],
    ...overrides,
  };
}

test('export is refused 403 for a signed-in admin without the capability', async () => {
  let listed = false;
  const result = await handleNewsletterExport(
    deps({
      hasCapability: async () => false,
      listSubscribers: async () => {
        listed = true;
        return [];
      },
    })
  );
  assert.equal(result.status, 403);
  assert.equal(result.body, 'Forbidden');
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(listed, false, 'subscribers must not be read before the capability passes');
});

test('export succeeds for an admin holding the capability', async () => {
  const result = await handleNewsletterExport(deps({}));
  assert.equal(result.status, 200);
  assert.match(result.headers['Content-Type'], /^text\/csv/);
});

test('an unauthenticated session is still 401', async () => {
  const result = await handleNewsletterExport(
    deps({ getSession: async () => ({ ok: false, reason: 'no-session' }) })
  );
  assert.equal(result.status, 401);
});
