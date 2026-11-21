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

function loadHelper() {
  const cacheCalls = [];
  const reads = { count: 0 };
  const stubs = {
    'firebase-admin/firestore': {
      getFirestore: () => ({
        collection: () => ({
          doc: () => ({
            get: async () => {
              reads.count += 1;
              return { exists: true, data: () => ({ enabled: true }) };
            },
          }),
        }),
      }),
    },
    'next/cache': {
      unstable_cache: (fn, keyParts, options) => {
        cacheCalls.push({ keyParts, options });
        return fn;
      },
    },
    '@/lib/firebase-admin': { initAdmin: () => ({}) },
    '@/lib/ozow-sandbox-test-mode-shared': {
      OZOW_SANDBOX_TEST_MODE_COLLECTION: 'adminSettings',
      OZOW_SANDBOX_TEST_MODE_DOC_ID: 'ozowSandboxTestMode',
    },
    './ozow-sandbox-test-mode-shared': {},
  };
  const code = ts.transpileModule(read('lib/ozow-sandbox-test-mode.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const resolve = (name) => {
    assert.ok(Object.hasOwn(stubs, name), `Unapproved module: ${name}`);
    return stubs[name];
  };
  const helpers = { __exportStar: () => {}, __createBinding: () => {} };
  vm.runInNewContext(
    code,
    { module: loaded, exports: loaded.exports, require: resolve, Object, Promise, console, ...helpers },
    { filename: 'lib/ozow-sandbox-test-mode.ts', timeout: 5000 },
  );
  return { exports: loaded.exports, cacheCalls, reads };
}

test('the banner read is registered with a 60 second revalidate and its own tag', () => {
  const { exports, cacheCalls } = loadHelper();
  assert.equal(cacheCalls.length, 1);
  assert.equal(cacheCalls[0].options.revalidate, 60);
  assert.deepEqual([...cacheCalls[0].options.tags], ['ozow-sandbox-banner']);
  assert.equal(exports.OZOW_SANDBOX_BANNER_CACHE_TAG, 'ozow-sandbox-banner');
});

test('the cached display read delegates to the live fail-closed read', async () => {
  const { exports, reads } = loadHelper();
  assert.equal(await exports.getCachedOzowSandboxTestModeForDisplay(), true);
  assert.equal(reads.count, 1);
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

test('the admin toggle route expires the banner cache after the audited write', () => {
  const src = read('app/api/admin/settings/ozow-sandbox-test-mode/route.ts');
  const write = src.indexOf('writeAuditedSettingChange(');
  const expire = src.indexOf('revalidateTag(OZOW_SANDBOX_BANNER_CACHE_TAG');
  assert.ok(write > 0 && expire > write, 'revalidateTag must follow the write');
});
