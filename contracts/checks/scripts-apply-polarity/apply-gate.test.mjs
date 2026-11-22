import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Source-level guard: every script under scripts/ that calls a Sanity write must derive its
// dry-run flag from an explicit --apply flag (safe by default). It reads source text only;
// nothing runs.
//
// Known limit: a script counts as Sanity-writing only if it imports `@sanity/client` or a
// module whose path contains "sanity". A client obtained through a helper whose path lacks
// "sanity" is not detected. Deliberately not solved here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scriptsDir = path.join(root, 'scripts');
const SCRIPT_EXT = /\.(ts|mts|mjs|js)$/;
const WRITE_CALL =
  /\.(commit|create|createOrReplace|createIfNotExists|patch|delete|mutate)\(|\.assets\.upload\(/;
const SANITY_CLIENT = /@sanity\/client|from\s+['"][^'"]*sanity[^'"]*['"]/;
// Accepted gate: real code (comments stripped) that reads the flag from argv, i.e.
// `!argv.includes('--apply')` / `APPLY = argv.includes('--apply')` (also inline, or via an
// APPLY_FLAG constant), or a parseArgs option named apply. A mention of --apply in a log
// string or error message does not match.
const APPLY_GATE =
  /argv[\w.]*\.includes\(\s*(?:['"]--apply['"]|APPLY_FLAG)\s*\)|\bapply:\s*\{\s*type:\s*['"]boolean['"]/;
const OLD_POLARITY = /DRY_RUN\s*=\s*[\w.]*argv[\w.]*\.includes\(\s*['"]--dry-run['"]\s*\)/;

// Known gaps, left unchanged on purpose and reported in the PR. An entry that starts
// passing must be removed from this list (asserted below), so the list only shrinks.
const KNOWN_UNGATED = new Set([
  'scripts/_tmp_empty_array_test.ts',
  'scripts/backfill-award-fields.ts',
  'scripts/patch-tickets-terms-note.ts',
  'scripts/seed-event-slugs.mjs',
  'scripts/seed-page-singletons.ts',
  'scripts/seed-province-order.ts',
  'scripts/seed-qa-fixture-ticket-type.ts',
  'scripts/seed-sanity.ts',
  'scripts/seed-show-exhibitor-info.ts',
  'scripts/seed-show-visitor-info.ts',
  'scripts/seed-ticketing.ts',
  'scripts/update-about-judging-copy.ts',
]);

// Remove block comments, full-line comments and trailing // comments (not inside a URL).
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function isGated(code) {
  return APPLY_GATE.test(code) && !OLD_POLARITY.test(code);
}

function listScripts(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'checks' ? [] : listScripts(full);
    return SCRIPT_EXT.test(entry.name) ? [full] : [];
  });
}

const scripts = listScripts(scriptsDir).map((file) => ({
  rel: path.relative(root, file),
  code: stripComments(readFileSync(file, 'utf8')),
}));
const writers = scripts.filter(({ code }) => SANITY_CLIENT.test(code) && WRITE_CALL.test(code));

test('scripts directory has write-capable scripts to check', () => {
  assert.ok(writers.length > 0);
});

test('every Sanity-writing script defines its dry-run flag from --apply', () => {
  const ungated = writers
    .filter(({ rel, code }) => !isGated(code) && !KNOWN_UNGATED.has(rel))
    .map(({ rel }) => rel);
  assert.deepEqual(ungated, [], `Writes not gated on --apply: ${ungated.join(', ')}`);
});

test('KNOWN_UNGATED entries are still ungated (remove them once fixed)', () => {
  const gated = [...KNOWN_UNGATED].filter((rel) => {
    const hit = writers.find((s) => s.rel === rel);
    return !hit || isGated(hit.code);
  });
  assert.deepEqual(gated, []);
});

test('self-test: old polarity fails', () => {
  const code = stripComments("const DRY_RUN = process.argv.includes('--dry-run');\n");
  assert.equal(isGated(code), false);
});

test('self-test: --apply only in a log string or comment fails', () => {
  const code = stripComments(
    [
      "console.log('re-run with --apply to write');",
      "const DRY_RUN = process.argv.includes('--dry-run'); // pass '--apply' later",
    ].join('\n'),
  );
  assert.equal(isGated(code), false);
  assert.equal(isGated(stripComments("console.log('use --apply');")), false);
});

test('self-test: the correct forms pass', () => {
  const dry = "const DRY_RUN = !process.argv.includes('--apply') || process.argv.includes('--dry-run');";
  assert.equal(isGated(stripComments(dry)), true);
  assert.equal(isGated(stripComments("const APPLY = process.argv.includes('--apply');")), true);
});
