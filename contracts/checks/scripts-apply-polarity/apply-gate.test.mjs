import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// This is a source-pattern tripwire, not a data-flow proof: it cannot show that a write
// is unreachable without --apply. Review of a new script's write path is still required.
//
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
// Name-agnostic old polarity: any declaration assigning from includes('--dry-run') whose
// own statement does not also reference --apply.
const DRY_RUN_DECL = /\b(?:const|let|var)\s+\w+[^=;]*=[^;]*includes\(\s*['"]--dry-run['"]\s*\)[^;]*;?/g;
function hasOldPolarity(code) {
  return (code.match(DRY_RUN_DECL) ?? []).some((stmt) => !stmt.includes('--apply'));
}

// Known gaps, left unchanged on purpose and reported in the PR. Empty now: every writer is
// gated. An entry that starts passing must be removed from this list (asserted below), so
// the list only shrinks.
const KNOWN_UNGATED = new Set([]);

// Reviewed by hand and safe, though they trip the rule: both declare
// `const dry = argv.includes('--dry-run')` in a statement of its own, but parseMode()
// returns null when neither or both of --dry-run/--apply are given (usage error, exit),
// and writes only run in 'apply' mode. Entries must still exist and still trip the rule.
const REVIEWED_SAFE = new Set([
  'scripts/unpublish-invented-events.ts',
  'scripts/unpublish-invented-shows.ts',
]);

// Remove block comments, full-line comments and trailing // comments (not inside a URL).
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function isGated(code) {
  return APPLY_GATE.test(code) && !hasOldPolarity(code);
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
    .filter(
      ({ rel, code }) => !isGated(code) && !KNOWN_UNGATED.has(rel) && !REVIEWED_SAFE.has(rel),
    )
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

test('REVIEWED_SAFE entries still exist and still trip the rule (remove if not)', () => {
  const stale = [...REVIEWED_SAFE].filter((rel) => {
    const hit = writers.find((s) => s.rel === rel);
    return !hit || isGated(hit.code);
  });
  assert.deepEqual(stale, []);
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

test('self-test: dry-run flag under another name, with --apply unused, fails', () => {
  const code = stripComments(
    [
      "const APPLY = process.argv.includes('--apply');",
      "const dryRun = process.argv.includes('--dry-run');",
      'if (!dryRun) await client.create(doc);',
    ].join('\n'),
  );
  assert.equal(isGated(code), false);
});

test('self-test: the correct forms pass', () => {
  const dry = "const DRY_RUN = !process.argv.includes('--apply') || process.argv.includes('--dry-run');";
  assert.equal(isGated(stripComments(dry)), true);
  assert.equal(isGated(stripComments("const APPLY = process.argv.includes('--apply');")), true);
});
