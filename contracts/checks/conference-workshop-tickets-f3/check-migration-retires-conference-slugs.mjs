// F3 (conference-workshop-tickets, M2) — A16: GAP FOUND by a read-only Sanity query on the
// live dataset (2026-10-07): buildMigrationPatches() must set active:false on every one of
// the four RETIRED_CONFERENCE_SLUGS documents, with the four target _ids computed FROM the
// RETIRED_CONFERENCE_SLUGS constant (not a hand-typed duplicate list) — this is the gap
// this correction fixes. Checked two ways: (1) the real patch output sets active:false for
// every id the live constant implies, and (2) the migration script's SOURCE TEXT actually
// imports/references RETIRED_CONFERENCE_SLUGS (so the patches above are provably DERIVED
// from it, not independently hand-typed to the same four values by coincidence).
import { loadRepoModule, finish } from './_lib.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_REL_PATH = 'scripts/migrate-conference-workshop-tickets.ts';
const failures = [];

const { RETIRED_CONFERENCE_SLUGS } = await loadRepoModule('lib/provisional-figures.ts');

let mod;
try {
  mod = await loadRepoModule(SCRIPT_REL_PATH);
} catch (error) {
  finish('check-migration-retires-conference-slugs.mjs', [`could not import ${SCRIPT_REL_PATH}: ${error.message}`]);
}

if (typeof mod.buildMigrationPatches !== 'function') {
  finish('check-migration-retires-conference-slugs.mjs', [`${SCRIPT_REL_PATH} does not export buildMigrationPatches()`]);
}

const patches = mod.buildMigrationPatches();

for (const slug of RETIRED_CONFERENCE_SLUGS) {
  const id = `ticketType-${slug}`;
  const patch = patches[id];
  if (!patch) {
    failures.push(`buildMigrationPatches() has no patch for retired slug '${id}' — expected an active:false patch`);
    continue;
  }
  if (patch.active !== false) {
    failures.push(`${id} patch: active is ${JSON.stringify(patch.active)}, expected false`);
  }
}

let source;
try {
  source = readFileSync(path.join(__dirname, '../../../', SCRIPT_REL_PATH), 'utf8');
} catch (error) {
  source = '';
  failures.push(`could not read ${SCRIPT_REL_PATH} source: ${error.message}`);
}
if (source && !/RETIRED_CONFERENCE_SLUGS/.test(source)) {
  failures.push(
    `${SCRIPT_REL_PATH} never references RETIRED_CONFERENCE_SLUGS — the four retired ids above must be DERIVED from that constant, not a separately hand-typed list that could silently drift from it`,
  );
}

finish(
  'check-migration-retires-conference-slugs.mjs',
  failures,
  'buildMigrationPatches() retires all four RETIRED_CONFERENCE_SLUGS documents, derived from the live constant.',
);
