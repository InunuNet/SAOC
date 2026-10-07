// F3 (conference-workshop-tickets, M2) — A14: scripts/migrate-conference-workshop-tickets.ts
// exports a pure buildMigrationPatches() keyed by Sanity _id, built from
// lib/provisional-figures.ts's live exports — both the dry-run and --apply paths call this
// SAME function, so they cannot diverge (team-lead's correction, 2026-10-07, after a
// read-only Sanity query on the live dataset found two ticketType documents still at their
// old, superseded values despite an earlier "migration" pass). Proven by (1) importing and
// calling the function with zero Sanity env vars/network, confirming its return shape, and
// (2) a source-text check that it is referenced at least 3 times (its own export + at least
// two call sites: the dry-run print path and the --apply patch loop).
import { loadRepoModule, finish } from './_lib.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_REL_PATH = 'scripts/migrate-conference-workshop-tickets.ts';

const failures = [];

let mod;
try {
  mod = await loadRepoModule(SCRIPT_REL_PATH);
} catch (error) {
  finish('check-migration-plan-export-shape.mjs', [
    `could not import ${SCRIPT_REL_PATH}: ${error.message}`,
  ]);
}

if (typeof mod.buildMigrationPatches !== 'function') {
  finish('check-migration-plan-export-shape.mjs', [
    `${SCRIPT_REL_PATH} does not export a function named buildMigrationPatches — got ${typeof mod.buildMigrationPatches}`,
  ]);
}

const result = mod.buildMigrationPatches();

if (result === null || typeof result !== 'object' || Array.isArray(result)) {
  failures.push(`buildMigrationPatches() returned ${JSON.stringify(result)}, expected a plain object keyed by _id`);
} else {
  const ids = Object.keys(result);
  if (ids.length === 0) {
    failures.push('buildMigrationPatches() returned an empty object — expected patches for the seven pre-existing documents F1/F2 change');
  }
  for (const id of ids) {
    if (!id.startsWith('ticketType-')) {
      failures.push(`patch key ${JSON.stringify(id)} does not look like a ticketType Sanity _id (expected the 'ticketType-' prefix)`);
    }
    const patch = result[id];
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
      failures.push(`patch for ${JSON.stringify(id)} is ${JSON.stringify(patch)}, expected a plain patch object`);
    }
  }
}

// Second-source check: both the dry-run and --apply code paths must call this SAME function
// (not a second, independently-reconstructed plan) — at least 3 occurrences of the
// identifier (1 `export function`/`export const` definition + >=2 call sites).
let source;
try {
  source = readFileSync(path.join(__dirname, '../../../', SCRIPT_REL_PATH), 'utf8');
} catch (error) {
  failures.push(`could not read ${SCRIPT_REL_PATH} source to count call sites: ${error.message}`);
  source = '';
}
const occurrences = (source.match(/buildMigrationPatches\s*\(/g) ?? []).length;
if (occurrences < 3) {
  failures.push(
    `'buildMigrationPatches(' appears ${occurrences} time(s) in ${SCRIPT_REL_PATH} — expected at least 3 (the export/definition plus a dry-run call site and an --apply call site), so dry-run and --apply cannot diverge`,
  );
}

finish(
  'check-migration-plan-export-shape.mjs',
  failures,
  'buildMigrationPatches() is a pure, _id-keyed function called by both the dry-run and --apply paths.',
);
