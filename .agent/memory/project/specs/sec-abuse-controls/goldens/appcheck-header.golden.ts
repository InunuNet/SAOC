// Golden for components/tickets/appCheckHeader.ts (D7 client half, Codex QA round 4): the header
// the cart hook adds to the checkout POST. An attestation or SDK-load failure of ANY kind must
// send the request tokenless, never skip the request: the server decides whether to accept it.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/appcheck-header.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');
const HEADER = 'X-Firebase-AppCheck';

async function main() {
  const { appCheckHeaders } = await import(path.join(ROOT, 'components/tickets/appCheckHeader.ts'));

  // No loader (flag off, nothing built in): no header, nothing loaded.
  assert.deepEqual(await appCheckHeaders(undefined), {});

  // A token is sent under the exact header the server reads (lib/app-check.ts APP_CHECK_HEADER).
  assert.deepEqual(await appCheckHeaders(async () => ({ getCheckoutAppCheckToken: async () => 'tok-1' })), { [HEADER]: 'tok-1' });

  // A null token (client returned nothing) sends no header.
  assert.deepEqual(await appCheckHeaders(async () => ({ getCheckoutAppCheckToken: async () => null })), {});
  assert.deepEqual(await appCheckHeaders(async () => ({ getCheckoutAppCheckToken: async () => '' })), {});

  // Every failure yields no header and never throws: the dynamic import rejecting (chunk blocked,
  // offline), the loader throwing synchronously, and the token fetch rejecting or throwing.
  assert.deepEqual(await appCheckHeaders(async () => { throw new Error('chunk failed to load'); }), {}, 'a rejected import sends the request tokenless');
  assert.deepEqual(await appCheckHeaders(() => { throw new Error('sync failure'); }), {}, 'a synchronous loader failure sends the request tokenless');
  assert.deepEqual(await appCheckHeaders(async () => ({ getCheckoutAppCheckToken: async () => { throw new Error('attestation failed'); } })), {}, 'a failed attestation sends the request tokenless');
  assert.deepEqual(await appCheckHeaders(async () => ({ getCheckoutAppCheckToken: () => { throw new Error('sync throw'); } })), {});

  // A fresh token per call (the client never caches a limited-use token).
  let n = 0;
  const loader = async () => ({ getCheckoutAppCheckToken: async () => `tok-${++n}` });
  assert.deepEqual(await appCheckHeaders(loader), { [HEADER]: 'tok-1' });
  assert.deepEqual(await appCheckHeaders(loader), { [HEADER]: 'tok-2' });

  console.log('appcheck-header golden: PASS');
}

main().catch((error) => {
  console.error('appcheck-header golden: FAIL');
  console.error(error);
  process.exit(1);
});
