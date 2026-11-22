import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Source-level guard: every script under scripts/ that calls a Sanity write must gate it
// on an explicit --apply flag (safe by default). It reads source text only; nothing runs.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scriptsDir = path.join(root, 'scripts');
const SCRIPT_EXT = /\.(ts|mts|mjs|js)$/;
const WRITE_CALL = /\.(commit|create|createOrReplace|createIfNotExists|patch|delete)\(/;
const APPLY_FLAG = /['"]--apply['"]|\bapply:\s*\{/; // argv.includes('--apply') or parseArgs option
const SANITY_CLIENT = /@sanity\/client|from\s+['"][^'"]*sanity[^'"]*['"]/;
const DRY_RUN_ONLY = /argv\.includes\(\s*['"]--dry-run['"]\s*\)\s*;/;

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

function listScripts(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'checks' ? [] : listScripts(full);
    return SCRIPT_EXT.test(entry.name) ? [full] : [];
  });
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const scripts = listScripts(scriptsDir).map((file) => ({
  rel: path.relative(root, file),
  code: stripComments(readFileSync(file, 'utf8')),
}));
const writers = scripts.filter(
  ({ code }) => SANITY_CLIENT.test(code) && WRITE_CALL.test(code),
);

test('scripts directory has write-capable scripts to check', () => {
  assert.ok(writers.length > 0);
});

test('every script that calls a write gates it on --apply', () => {
  const ungated = writers
    .filter(({ rel, code }) => !APPLY_FLAG.test(code) && !KNOWN_UNGATED.has(rel))
    .map(({ rel }) => rel);
  assert.deepEqual(ungated, [], `Writes not gated on --apply: ${ungated.join(', ')}`);
});

test('no script treats --dry-run as the only gate (write by default)', () => {
  const bad = writers
    .filter(({ code }) => DRY_RUN_ONLY.test(code) && !APPLY_FLAG.test(code))
    .map(({ rel }) => rel);
  assert.deepEqual(bad, []);
});

test('KNOWN_UNGATED entries are still ungated (remove them once fixed)', () => {
  const gated = [...KNOWN_UNGATED].filter((rel) => {
    const hit = writers.find((s) => s.rel === rel);
    return !hit || APPLY_FLAG.test(hit.code);
  });
  assert.deepEqual(gated, []);
});
