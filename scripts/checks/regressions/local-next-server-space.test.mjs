// Regression test for the NOS Site finding folded into PR #160: local-next-server.mjs put the
// preload path into NODE_OPTIONS unquoted, so a checkout whose path holds a space handed Node a
// truncated `--import` (ERR_UNSUPPORTED_DIR_IMPORT) and every spawned server died at boot.
// LOCAL_NEXT_SERVER_SOURCE overrides the helper under test (used to show a pre-fix copy fails).
//   node --test 'scripts/checks/regressions/*.test.mjs'
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SANDBOX = resolve(REPO_ROOT, '.tmp/sandbox/f4 space regress');
const HELPER_SOURCE = process.env.LOCAL_NEXT_SERVER_SOURCE ?? resolve(REPO_ROOT, 'scripts/checks/lib/local-next-server.mjs');
const COPIES = {
  'scripts/checks/lib/local-next-server.mjs': HELPER_SOURCE,
  'scripts/checks/lib/groq-fingerprint.mjs': resolve(REPO_ROOT, 'scripts/checks/lib/groq-fingerprint.mjs'),
  'scripts/checks/sanity-count-preload.mjs': resolve(REPO_ROOT, 'scripts/checks/sanity-count-preload.mjs'),
};
const SANITY_URL = 'https://fakeproj.apicdn.sanity.io/v2024-01-01/data/query/production?query=*';
const STUB_PORT = 3299;

after(() => {
  execFileSync('python3', ['execution/safe_delete.py', SANDBOX], { cwd: REPO_ROOT });
});

test('the counting preload loads from a checkout path containing a space', async () => {
  const checkout = resolve(SANDBOX, 'repo with space');
  for (const [target, source] of Object.entries(COPIES)) {
    mkdirSync(dirname(resolve(checkout, target)), { recursive: true });
    copyFileSync(source, resolve(checkout, target));
  }
  const countLog = resolve(checkout, 'count.log');
  writeFileSync(countLog, '');
  const helper = await import(pathToFileURL(resolve(checkout, 'scripts/checks/lib/local-next-server.mjs')).href);
  const env = helper.stubbedEnv(STUB_PORT, countLog);
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await fetch(${JSON.stringify(SANITY_URL)});`],
    { cwd: checkout, env, encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr);
  const lines = readFileSync(countLog, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'the stubbed Sanity request was counted by the preload');
});
