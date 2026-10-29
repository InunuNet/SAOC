// Golden for lib/app-check.ts (D7): server-side Firebase App Check on POST checkout.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/app-check.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');
const headers = (token: string | null) => ({ get: (name: string) => (name.toLowerCase() === 'x-firebase-appcheck' ? token : null) });
// Error shapes copied from firebase-admin 14 (lib/app-check/token-verifier.js: codes are prefixed 'app-check/').
const sdkError = (code: string) => Object.assign(new Error(code), { code });

async function main() {
  const mod = await import(path.join(ROOT, 'lib/app-check.ts'));
  const { isAppCheckEnforced, requireCheckoutAppCheck, APP_CHECK_HEADER, APP_CHECK_ENFORCE_ENV } = mod;

  assert.equal(APP_CHECK_HEADER, 'x-firebase-appcheck');
  assert.equal(APP_CHECK_ENFORCE_ENV, 'APP_CHECK_ENFORCE_CHECKOUT');

  // 1. The flag: unset or an explicit off value is off; ANY other set value enforces (fail closed on typos).
  for (const off of [undefined, '', '  ', 'false', 'FALSE', '0', 'off', 'No']) {
    assert.equal(isAppCheckEnforced(off), false, `off for ${JSON.stringify(off)}`);
  }
  for (const on of ['true', 'TRUE', '1', 'yes', 'on', 'tru', 'enabled', 'garbage']) {
    assert.equal(isAppCheckEnforced(on), true, `enforced for ${JSON.stringify(on)}`);
  }

  // 2. Flag off: behaviour is today's. The verifier is never called and a token is never consumed.
  {
    let calls = 0;
    const verify = async () => { calls += 1; return {}; };
    assert.deepEqual(await requireCheckoutAppCheck(headers(null), { env: {}, verify }), { ok: true, enforced: false });
    assert.deepEqual(await requireCheckoutAppCheck(headers('some-token'), { env: { APP_CHECK_ENFORCE_CHECKOUT: 'false' }, verify }), { ok: true, enforced: false });
    assert.equal(calls, 0, 'flag off: no verification, no network, no consumed token');
  }

  const on = { APP_CHECK_ENFORCE_CHECKOUT: 'true' };

  // 3. Flag on, valid token: verified once, with the exact token.
  {
    const seen: string[] = [];
    const result = await requireCheckoutAppCheck(headers('good-token'), { env: on, verify: async (t: string) => { seen.push(t); return { alreadyConsumed: false }; } });
    assert.deepEqual(result, { ok: true, enforced: true });
    assert.deepEqual(seen, ['good-token']);
  }

  // 4. Missing header (absent, empty, whitespace): refused without calling the verifier.
  for (const missing of [null, '', '   ']) {
    let calls = 0;
    const result = await requireCheckoutAppCheck(headers(missing), { env: on, verify: async () => { calls += 1; return {}; } });
    assert.deepEqual(result, { ok: false, reason: 'missing' });
    assert.equal(calls, 0);
  }

  // 5. Invalid or expired token (SDK codes app-check/invalid-argument, app-check/app-check-token-expired).
  for (const code of ['app-check/invalid-argument', 'app-check/app-check-token-expired']) {
    const result = await requireCheckoutAppCheck(headers('bad'), { env: on, verify: async () => { throw sdkError(code); } });
    assert.deepEqual(result, { ok: false, reason: 'invalid' }, code);
  }

  // 6. Replayed limited-use token (verifyToken(token, { consume: true }) reports alreadyConsumed).
  assert.deepEqual(
    await requireCheckoutAppCheck(headers('used'), { env: on, verify: async () => ({ alreadyConsumed: true }) }),
    { ok: false, reason: 'replayed' },
  );

  // 7. The App Check backend failing is NOT a pass: any other error refuses as unavailable (fail closed).
  for (const error of [sdkError('app-check/internal-error'), sdkError('app-check/unknown-error'), new Error('ECONNRESET')]) {
    assert.deepEqual(await requireCheckoutAppCheck(headers('t'), { env: on, verify: async () => { throw error; } }), { ok: false, reason: 'unavailable' });
  }

  // 8. The flag is read per call, never captured at module load (RUNTIME-only env on App Hosting).
  {
    const verify = async () => ({});
    delete process.env.APP_CHECK_ENFORCE_CHECKOUT;
    assert.deepEqual(await requireCheckoutAppCheck(headers(null), { verify }), { ok: true, enforced: false });
    process.env.APP_CHECK_ENFORCE_CHECKOUT = 'true';
    assert.deepEqual(await requireCheckoutAppCheck(headers(null), { verify }), { ok: false, reason: 'missing' });
    delete process.env.APP_CHECK_ENFORCE_CHECKOUT;
  }

  console.log('app-check golden: PASS');
}

main().catch((error) => {
  console.error('app-check golden: FAIL');
  console.error(error);
  process.exit(1);
});
