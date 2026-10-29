// Regression tests for the Codex re-review of PR #160, finding P3: the --live-reads positive control
// matched ticketsPageQuery by the substring `_type == "ticketsPage"`, so it passed vacuously if that
// query disappeared and any other cached query contained the same text. Reads are now matched by
// the hash of their exact query text, read from sanity/queries.ts.
//   node --test 'scripts/checks/regressions/*.test.mjs'
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { countQuery, formatCountLine, queryFingerprint } from '../lib/groq-fingerprint.mjs';
import { exportedQueryText, goldenReadQuery } from '../lib/live-reads-control.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const QUERIES = resolve(REPO_ROOT, 'sanity/queries.ts');
const LIVE_READS = resolve(
  REPO_ROOT,
  '.agent/memory/project/specs/backlog-wave-1028/m3-f4-gate-hardening/goldens/live-reads-behaviour.json',
);
const SANDBOX = resolve(REPO_ROOT, '.tmp/sandbox/f4-fingerprint-regress');
const SANITY_URL = 'https://fakeproj.apicdn.sanity.io/v2024-01-01/data/query/production';
const DECOY_QUERY = '*[_type == "ticketsPage"][0]{ title }';
const CONTROL = { name: 'ticketsPageQuery', fingerprint: '_type == "ticketsPage"' };

const logLineFor = (query) => formatCountLine(`${SANITY_URL}?query=${encodeURIComponent(query)}&returnQuery=false`, 1);

after(() => {
  execFileSync('python3', ['execution/safe_delete.py', SANDBOX], { cwd: REPO_ROOT });
});

describe('live-reads control identifies ticketsPageQuery exactly (PR 160 P3)', () => {
  const ticketsPage = goldenReadQuery(QUERIES, CONTROL);
  const fingerprint = queryFingerprint(ticketsPage);

  test('a different query containing the ticketsPage substring is not counted', () => {
    const lines = [logLineFor(DECOY_QUERY)];
    assert.ok(lines[0].includes(CONTROL.fingerprint), 'the decoy matches the old substring fingerprint');
    assert.equal(countQuery(lines, fingerprint), 0);
  });

  test('the real ticketsPageQuery request is counted once', () => {
    const lines = [logLineFor(DECOY_QUERY), logLineFor(ticketsPage)];
    assert.equal(countQuery(lines, fingerprint), 1);
  });

  test('indentation differences do not change the identity', () => {
    const reindented = ticketsPage.replace(/\n\s*/g, '\n        ');
    assert.equal(countQuery([logLineFor(reindented)], fingerprint), 1);
  });

  test('a renamed or removed control query is a setup error, not a vacuous pass', () => {
    assert.throws(() => exportedQueryText(QUERIES, 'ticketsPageQueryRenamed'), /no exported ticketsPageQueryRenamed/);
  });

  test('an interpolated query cannot be identified and is a setup error', () => {
    mkdirSync(SANDBOX, { recursive: true });
    const queriesModule = resolve(SANDBOX, 'queries.ts');
    writeFileSync(queriesModule, 'const t = "ticketsPage";\nexport const ticketsPageQuery = defineQuery(`*[_type == "${t}"]`);\n');
    assert.throws(() => exportedQueryText(queriesModule, 'ticketsPageQuery'), /not defineQuery\(\) of one plain string/);
  });

  test('a golden fingerprint that drifts from the source query is a setup error', () => {
    assert.throws(() => goldenReadQuery(QUERIES, { name: 'ticketsPageQuery', fingerprint: '_type == "other"' }));
  });

  test('every golden read names an exported query that holds its fingerprint', () => {
    const golden = JSON.parse(readFileSync(LIVE_READS, 'utf8'));
    for (const read of [...golden.second_request_must_contain, ...golden.second_request_must_not_contain]) {
      assert.doesNotThrow(() => goldenReadQuery(QUERIES, read), read.name);
    }
  });
});
