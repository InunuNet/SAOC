// Golden for lib/app-check-client.ts (D7 client half): with no site key nothing is loaded or sent.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/app-check-client.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');

async function main() {
  const mod = await import(path.join(ROOT, 'lib/app-check-client.ts'));
  const { getCheckoutAppCheckToken } = mod;

  let fetches = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { fetches += 1; throw new Error('network must not be used'); }) as typeof fetch;
  try {
    // 1. No site key (flag off): null, the SDK loader is never called, nothing touches the network.
    for (const siteKey of [undefined, '', '   ']) {
      let loads = 0;
      const token = await getCheckoutAppCheckToken({ siteKey, load: async () => { loads += 1; return { getLimitedUseToken: async () => 't' }; } });
      assert.equal(token, null);
      assert.equal(loads, 0, `no SDK load for site key ${JSON.stringify(siteKey)}`);
    }
    assert.equal(fetches, 0);
    // The default path (no deps, env unset in this process) is the flag-off path too.
    delete process.env.NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY;
    assert.equal(await getCheckoutAppCheckToken(), null);

    // 2. Site key set: a fresh limited-use token per call, passed the site key.
    {
      const keys: string[] = [];
      let n = 0;
      const load = async () => ({ getLimitedUseToken: async (k: string) => { keys.push(k); return `tok-${++n}`; } });
      assert.equal(await getCheckoutAppCheckToken({ siteKey: 'site-key', load }), 'tok-1');
      assert.equal(await getCheckoutAppCheckToken({ siteKey: 'site-key', load }), 'tok-2', 'never cache a limited-use token');
      assert.deepEqual(keys, ['site-key', 'site-key']);
    }

    // 3. Any failure yields null (never throws into the checkout submit); the server decides.
    assert.equal(await getCheckoutAppCheckToken({ siteKey: 'k', load: async () => { throw new Error('script blocked'); } }), null);
    assert.equal(await getCheckoutAppCheckToken({ siteKey: 'k', load: async () => ({ getLimitedUseToken: async () => { throw new Error('attestation failed'); } }) }), null);
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log('app-check-client golden: PASS');
}

main().catch((error) => {
  console.error('app-check-client golden: FAIL');
  console.error(error);
  process.exit(1);
});
