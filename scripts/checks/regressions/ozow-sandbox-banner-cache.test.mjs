// Regression test: the public sandbox banner flag read goes through a 60 second tagged cache that
// the admin toggle route expires, while every payment decision keeps reading the flag live.
//   node --test scripts/checks/regressions/ozow-sandbox-banner-cache.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

function runTranspiled(file, stubs, extraGlobals = {}) {
  const code = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const resolve = (name) => {
    assert.ok(Object.hasOwn(stubs, name), `Unapproved module: ${name}`);
    return stubs[name];
  };
  vm.runInNewContext(
    code,
    { module: loaded, exports: loaded.exports, require: resolve, Object, Promise, Error, console, ...extraGlobals },
    { filename: file, timeout: 5000 },
  );
  return loaded.exports;
}

// `getImpl` decides what each Firestore read does. `memoize` makes unstable_cache behave like the
// real one: a resolved value is stored and served until revalidated; a rejection is not stored.
function loadHelper({ memoize = false, getImpl } = {}) {
  const cacheCalls = [];
  const reads = { count: 0 };
  const defaultGet = async () => ({ exists: true, data: () => ({ enabled: true }) });
  const stubs = {
    'firebase-admin/firestore': {
      getFirestore: () => ({
        collection: () => ({
          doc: () => ({
            get: async () => {
              reads.count += 1;
              return (getImpl ?? defaultGet)(reads.count);
            },
          }),
        }),
      }),
    },
    'next/cache': {
      unstable_cache: (fn, keyParts, options) => {
        cacheCalls.push({ keyParts, options });
        if (!memoize) return fn;
        let stored;
        let hasStored = false;
        return async (...args) => {
          if (hasStored) return stored;
          stored = await fn(...args);
          hasStored = true;
          return stored;
        };
      },
    },
    '@/lib/firebase-admin': { initAdmin: () => ({}) },
    '@/lib/ozow-sandbox-test-mode-shared': {
      OZOW_SANDBOX_TEST_MODE_COLLECTION: 'adminSettings',
      OZOW_SANDBOX_TEST_MODE_DOC_ID: 'ozowSandboxTestMode',
    },
    './ozow-sandbox-test-mode-shared': {},
  };
  const exports = runTranspiled('lib/ozow-sandbox-test-mode.ts', stubs, {
    __exportStar: () => {},
    __createBinding: () => {},
  });
  return { exports, cacheCalls, reads };
}

test('the banner read is registered with a 60 second revalidate and its own tag', () => {
  const { exports, cacheCalls } = loadHelper();
  assert.equal(cacheCalls.length, 1);
  assert.equal(cacheCalls[0].options.revalidate, 60);
  assert.deepEqual([...cacheCalls[0].options.tags], ['ozow-sandbox-banner']);
  assert.equal(exports.OZOW_SANDBOX_BANNER_CACHE_TAG, 'ozow-sandbox-banner');
});

test('the cached display read reads the live flag', async () => {
  const { exports, reads } = loadHelper();
  assert.equal(await exports.getCachedOzowSandboxTestModeForDisplay(), true);
  assert.equal(reads.count, 1);
});

test('a failed read is never cached: the next good read returns the real value', async () => {
  const { exports, reads } = loadHelper({
    memoize: true,
    getImpl: async (call) => {
      if (call === 1) throw new Error('firestore unavailable');
      return { exists: true, data: () => ({ enabled: true }) };
    },
  });
  // First call fails closed to false for that request only.
  assert.equal(await exports.getCachedOzowSandboxTestModeForDisplay(), false);
  // Nothing was stored, so the second call reads again and sees the true value.
  assert.equal(await exports.getCachedOzowSandboxTestModeForDisplay(), true);
  assert.equal(reads.count, 2);
  // A good value is then served from the cache without another read.
  assert.equal(await exports.getCachedOzowSandboxTestModeForDisplay(), true);
  assert.equal(reads.count, 2);
});

test('the live reader still fails closed on a read error', async () => {
  const { exports } = loadHelper({ getImpl: async () => { throw new Error('boom'); } });
  assert.equal(await exports.isOzowSandboxTestModeEnabled(), false);
});

test('only the public banner route uses the cached read', () => {
  assert.match(read('app/api/tickets/ozow-sandbox-test-mode/route.ts'), /getCachedOzowSandboxTestModeForDisplay\(\)/);
  const liveReaders = [
    'app/api/tickets/checkout/route.ts',
    'app/api/vendors/stand-payment/initiate/route.ts',
    'app/api/admin/settings/ozow-sandbox-test-mode/route.ts',
    'app/admin/(shell)/payments/page.tsx',
  ];
  for (const file of liveReaders) {
    const src = read(file);
    assert.match(src, /await isOzowSandboxTestModeEnabled\(\)|isOzowSandboxTestModeEnabled\(\),/, `${file} reads live`);
    assert.doesNotMatch(src, /getCachedOzowSandboxTestModeForDisplay/, `${file} must never use the display cache`);
  }
});

function loadAdminRoute({ revalidateThrows }) {
  const calls = { writes: 0, revalidations: 0, warnings: 0 };
  const stubs = {
    'next/cache': {
      revalidateTag: () => {
        calls.revalidations += 1;
        if (revalidateThrows) throw new Error('revalidate unavailable');
      },
    },
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } },
    'firebase-admin/firestore': { getFirestore: () => ({}) },
    '@/lib/admin-auth': {
      getAdminSession: async () => ({ ok: true, decodedToken: { uid: 'u1', email: 'a@example.com' } }),
      hasCapability: () => true,
    },
    '@/lib/firebase-admin': { initAdmin: () => ({}) },
    '@/lib/ozow-sandbox-test-mode': {
      isOzowSandboxTestModeEnabled: async () => false,
      OZOW_SANDBOX_BANNER_CACHE_TAG: 'ozow-sandbox-banner',
    },
    '@/lib/payment-settings-audit': {
      writeAuditedSettingChange: async () => {
        calls.writes += 1;
        return { changed: true };
      },
    },
    '@/lib/show-window-lookup': { resolveShowWindowLookup: async () => () => null },
    '@/lib/tickets-constants': { NATIONAL_SHOW_ID: 'show' },
  };
  const quietConsole = { error: () => {}, warn: () => { calls.warnings += 1; }, log: () => {} };
  const exports = runTranspiled('app/api/admin/settings/ozow-sandbox-test-mode/route.ts', stubs, {
    Date,
    console: quietConsole,
  });
  return { exports, calls };
}

const putRequest = { json: async () => ({ enabled: true }) };

test('a revalidateTag failure still returns success after the write saved once', async () => {
  const { exports, calls } = loadAdminRoute({ revalidateThrows: true });
  const response = await exports.PUT(putRequest);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(response.body)), { enabled: true, changed: true });
  assert.equal(calls.writes, 1);
  assert.equal(calls.revalidations, 1);
  assert.equal(calls.warnings, 1);
});

test('a normal toggle writes once and expires the banner cache once', async () => {
  const { exports, calls } = loadAdminRoute({ revalidateThrows: false });
  const response = await exports.PUT(putRequest);
  assert.equal(response.status, 200);
  assert.equal(calls.writes, 1);
  assert.equal(calls.revalidations, 1);
  assert.equal(calls.warnings, 0);
});

test('the admin toggle route expires the banner cache only after the audited write', () => {
  const src = read('app/api/admin/settings/ozow-sandbox-test-mode/route.ts');
  const write = src.indexOf('writeAuditedSettingChange(');
  const expire = src.indexOf('revalidateTag(OZOW_SANDBOX_BANNER_CACHE_TAG');
  assert.ok(write > 0 && expire > write, 'revalidateTag must follow the write');
});
