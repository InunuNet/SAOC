// F3 (conference-workshop-tickets, M2) — A17: buildMigrationPatches() sets active:false on
// ticketType-sunset-cocktails-couple per RETIRED_SUNSET_COCKTAILS_SLUGS (F2's new
// retirement export — team-lead's second-pass default, flagged not a resolution of
// whether this tier should exist at all). Same derived-from-constant proof technique as
// check-migration-retires-conference-slugs.mjs.
import { loadRepoModule, finish } from './_lib.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_REL_PATH = 'scripts/migrate-conference-workshop-tickets.ts';
const failures = [];

const { RETIRED_SUNSET_COCKTAILS_SLUGS } = await loadRepoModule('lib/provisional-figures.ts');

let mod;
try {
  mod = await loadRepoModule(SCRIPT_REL_PATH);
} catch (error) {
  finish('check-migration-retires-sunset-cocktails-couple.mjs', [`could not import ${SCRIPT_REL_PATH}: ${error.message}`]);
}

if (typeof mod.buildMigrationPatches !== 'function') {
  finish('check-migration-retires-sunset-cocktails-couple.mjs', [`${SCRIPT_REL_PATH} does not export buildMigrationPatches()`]);
}

const patches = mod.buildMigrationPatches();
const slugs = RETIRED_SUNSET_COCKTAILS_SLUGS ?? ['sunset-cocktails-couple'];

for (const slug of slugs) {
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
if (source && !/RETIRED_SUNSET_COCKTAILS_SLUGS/.test(source)) {
  failures.push(
    `${SCRIPT_REL_PATH} never references RETIRED_SUNSET_COCKTAILS_SLUGS — ticketType-sunset-cocktails-couple's retirement must be DERIVED from that constant, not hand-typed`,
  );
}

finish(
  'check-migration-retires-sunset-cocktails-couple.mjs',
  failures,
  'buildMigrationPatches() retires ticketType-sunset-cocktails-couple, derived from RETIRED_SUNSET_COCKTAILS_SLUGS.',
);
