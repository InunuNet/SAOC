// Regression tests for the Codex post-merge findings on PR #154 (m3-f4-gate-hardening).
//   node --test 'scripts/checks/regressions/*.test.mjs'
// Covers buy-path-live-reads.mts (P1), the --live-reads positive control (P2) and the
// Cache-Control classifier (P2). The triad linter (P2) has its own test_triad_classifier.py.
// BUY_PATH_CHECKER overrides the checker under test (used to show a pre-fix copy fails).
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { classify } from '../lib/cache-classify.mjs';
import { judgeCachedControl } from '../lib/live-reads-control.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CHECKER = process.env.BUY_PATH_CHECKER ?? resolve(REPO_ROOT, 'scripts/checks/buy-path-live-reads.mts');
const SANDBOX = resolve(REPO_ROOT, '.tmp/sandbox/f4-codex-regress');
const COVERED = 'app/covered.ts';
const EXPECTATIONS = resolve(
  REPO_ROOT,
  '.agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/cache-header-expectations.json',
);
const EXIT_CLEAN = 0;
const EXIT_VIOLATION = 1;

const FETCH_IMPORT = `import { sanityFetch } from '@/sanity/lib/fetch';\n`;
const QUERIES_IMPORT = `import { ticketsPageQuery } from '@/sanity/queries';\n`;
const ALLOWED = ['ticketsPageQuery'];

// `body` is the sanityFetch options object inside a default fixture; `source` replaces the whole
// covered file after the sanityFetch import.
function runChecker(name, body, { allow = [], source } = {}) {
  const root = resolve(SANDBOX, name);
  mkdirSync(resolve(root, 'app'), { recursive: true });
  writeFileSync(
    resolve(root, COVERED),
    FETCH_IMPORT +
      (source ??
        QUERIES_IMPORT +
          `export async function load(q: string, opts: object, live: boolean) {\n` +
          `  return sanityFetch(${body});\n}\n`),
  );
  const manifestPath = resolve(root, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify({
      files_every_sanityfetch_must_be_live: [COVERED],
      allow_not_live: allow.map((query_identifier) => ({ file: COVERED, query_identifier, reason: 'test' })),
      callers_must_pass_live_true: [],
      minimum_sites_found: { [COVERED]: { sanityFetch: 1 } },
    }),
  );
  return spawnSync('pnpm', ['exec', 'tsx', CHECKER, '--root', root, '--manifest', manifestPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

after(() => {
  execFileSync('python3', ['execution/safe_delete.py', SANDBOX], { cwd: REPO_ROOT });
});

describe('buy-path-live-reads options objects (P1)', () => {
  test('computed key that overwrites live is a violation', () => {
    const result = runChecker('computed', '{ query: q, live: true, ["li" + "ve"]: false }');
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
    assert.match(result.stdout, /computed property key/);
  });

  test('duplicate live key is a violation', () => {
    const result = runChecker('duplicate', '{ query: q, live: true, live: false }');
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
    assert.match(result.stdout, /repeats the live key/);
  });

  test('string-literal duplicate live key is a violation', () => {
    const result = runChecker('string-dup', `{ query: q, live: true, 'live': false }`);
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
  });

  test('spread after live is a violation', () => {
    const result = runChecker('spread', '{ query: q, live: true, ...opts }');
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
    assert.match(result.stdout, /spreads an unknown value/);
  });

  test('accessor named live is a violation', () => {
    const result = runChecker('accessor', '{ query: q, live: true, get live() { return false; } }');
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
  });

  test('clean live: true passes', () => {
    const result = runChecker('clean', '{ query: q, live: true }');
    assert.equal(result.status, EXIT_CLEAN, result.stdout + result.stderr);
  });

  test('clean live parameter passes', () => {
    const result = runChecker('clean-param', '{ query: q, live }');
    assert.equal(result.status, EXIT_CLEAN, result.stdout + result.stderr);
  });

  test('allowlisted query passes without live', () => {
    const result = runChecker('allowed', '{ query: ticketsPageQuery, tags: [] }', { allow: ALLOWED });
    assert.equal(result.status, EXIT_CLEAN, result.stdout + result.stderr);
  });
});

// PR #160 re-review: an allowlisted `query` was exempt even when a spread or computed key could
// replace it at runtime with a non-allowlisted query.
describe('buy-path-live-reads allowlist cannot be forged (PR 160 P1)', () => {
  test('spread after an allowlisted query is a violation', () => {
    const result = runChecker('allowed-spread', '{ query: ticketsPageQuery, ...opts }', { allow: ALLOWED });
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
    assert.match(result.stdout, /spreads an unknown value/);
  });

  test('spread before an allowlisted query is a violation', () => {
    const result = runChecker('allowed-spread-first', '{ ...opts, query: ticketsPageQuery }', { allow: ALLOWED });
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
  });

  test('computed key that overwrites an allowlisted query is a violation', () => {
    const result = runChecker('allowed-computed', '{ query: ticketsPageQuery, ["qu" + "ery"]: other }', {
      allow: ALLOWED,
    });
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
    assert.match(result.stdout, /computed property key/);
  });

  test('accessor beside an allowlisted query is a violation', () => {
    const result = runChecker('allowed-accessor', '{ query: ticketsPageQuery, get query() { return other; } }', {
      allow: ALLOWED,
    });
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
  });
});

// PR #160 second re-review: the allowlist matched the identifier's spelling, so a parameter or
// local named ticketsPageQuery could carry any query past it without live: true.
describe('buy-path-live-reads allowlist resolves the binding (PR 160 round 2 P1)', () => {
  const expectShadowed = (name, source) => {
    const result = runChecker(name, null, { allow: ALLOWED, source });
    assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
    assert.match(result.stdout, /not bound only by its sanity\/queries import/);
  };

  test('a parameter shadowing the imported query is a violation', () => {
    expectShadowed(
      'shadow-param',
      QUERIES_IMPORT +
        `export async function load(ticketsPageQuery: string) {\n` +
        `  return sanityFetch({ query: ticketsPageQuery });\n}\n`,
    );
  });

  test('a destructured parameter shadowing the imported query is a violation', () => {
    expectShadowed(
      'shadow-destructured',
      QUERIES_IMPORT +
        `export async function load({ ticketsPageQuery }: { ticketsPageQuery: string }) {\n` +
        `  return sanityFetch({ query: ticketsPageQuery });\n}\n`,
    );
  });

  test('a local const shadowing the imported query is a violation', () => {
    expectShadowed(
      'shadow-local',
      `import { ticketsPageQuery, nationalShowSalesQuery } from '@/sanity/queries';\n` +
        `export async function load() {\n` +
        `  const ticketsPageQuery = nationalShowSalesQuery;\n` +
        `  return sanityFetch({ query: ticketsPageQuery });\n}\n`,
    );
  });

  test('a module const with no import is a violation', () => {
    expectShadowed(
      'no-import',
      `import { nationalShowSalesQuery } from '@/sanity/queries';\n` +
        `const ticketsPageQuery = nationalShowSalesQuery;\n` +
        `export const load = () => sanityFetch({ query: ticketsPageQuery });\n`,
    );
  });

  test('an aliased import under the allowlisted name is a violation', () => {
    expectShadowed(
      'aliased',
      `import { nationalShowSalesQuery as ticketsPageQuery } from '@/sanity/queries';\n` +
        `export const load = () => sanityFetch({ query: ticketsPageQuery });\n`,
    );
  });

  test('an import from another module is a violation', () => {
    expectShadowed(
      'other-module',
      `import { ticketsPageQuery } from './my-queries';\n` +
        `export const load = () => sanityFetch({ query: ticketsPageQuery });\n`,
    );
  });

  test('the real import, used directly and as shorthand, passes', () => {
    const result = runChecker('real-import', null, {
      allow: ALLOWED,
      source:
        QUERIES_IMPORT +
        `export const load = () => sanityFetch({ query: ticketsPageQuery });\n` +
        `export const again = (query = ticketsPageQuery) => sanityFetch({ query, live: true });\n`,
    });
    assert.equal(result.status, EXIT_CLEAN, result.stdout + result.stderr);
  });
});

// PR #160 third re-review: the import check matched a suffix, so a barrel at
// `@/evil/sanity/queries` could re-export any query under an allowlisted name.
describe('buy-path-live-reads allowlist resolves the module path (PR 160 round 3 P1)', () => {
  const runWith = (name, specifier) =>
    runChecker(name, null, {
      allow: ALLOWED,
      source:
        `import { ticketsPageQuery } from '${specifier}';\n` +
        `export const load = () => sanityFetch({ query: ticketsPageQuery });\n`,
    });

  for (const [name, specifier] of [
    ['barrel-alias', '@/evil/sanity/queries'],
    ['barrel-relative', './sanity/queries'],
    ['barrel-package', 'sanity/queries'],
    ['barrel-directory', '@/sanity/queries/'],
  ]) {
    test(`an import from ${specifier} is a violation`, () => {
      const result = runWith(name, specifier);
      assert.equal(result.status, EXIT_VIOLATION, result.stdout + result.stderr);
      assert.match(result.stdout, /not bound only by its sanity\/queries import/);
    });
  }

  for (const [name, specifier] of [
    ['relative-real', '../sanity/queries'],
    ['relative-real-ts', '../sanity/queries.ts'],
  ]) {
    test(`an import from ${specifier} (the real module) passes`, () => {
      const result = runWith(name, specifier);
      assert.equal(result.status, EXIT_CLEAN, result.stdout + result.stderr);
    });
  }
});

describe('sanity-request-count positive control (P2)', () => {
  test('present then absent passes', () => {
    assert.deepEqual(judgeCachedControl('ticketsPageQuery', 1, 0), []);
  });

  test('absent then absent fails (vacuous control)', () => {
    const failures = judgeCachedControl('ticketsPageQuery', 0, 0);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /never appeared on the first request/);
  });

  test('present then present fails (not cached)', () => {
    const failures = judgeCachedControl('ticketsPageQuery', 1, 1);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /from cache/);
  });
});

describe('cache-headers classify is case-insensitive (P2)', () => {
  const modes = JSON.parse(readFileSync(EXPECTATIONS, 'utf8')).modes;
  const walled = modes.walled.all;
  const { static: staticRule } = modes.launched;

  test('walled rejects an Immutable directive in any case', () => {
    assert.equal(classify(walled, 'private, no-store, max-age=0, Immutable'), false);
    assert.equal(classify(walled, 'private, no-store, max-age=0, IMMUTABLE'), false);
  });

  test('walled still accepts the exact header', () => {
    assert.equal(classify(walled, 'private, no-store, max-age=0'), true);
  });

  test('static rule still accepts the immutable asset header', () => {
    assert.equal(classify(staticRule, 'public, max-age=31536000, immutable'), true);
  });

  test('a missing header never passes', () => {
    assert.equal(classify(walled, null), false);
  });
});
