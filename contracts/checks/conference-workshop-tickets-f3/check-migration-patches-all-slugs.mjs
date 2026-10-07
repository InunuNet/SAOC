// F3 (conference-workshop-tickets, M2) — A15: buildMigrationPatches() patches every one of
// the seven pre-existing documents F1/F2 changed (saoc-symposium, wosa-conference, vip,
// weekend-pass, day-visitor, early-bird, sunset-cocktails-couple — NOT
// weekend-pass-early-bird, which doesn't exist yet and is seed-ticketing.ts's job, see
// check-weekend-pass-early-bird-absent.mjs's sibling assertion A12), with
// ticketType-saoc-symposium/ticketType-wosa-conference's patch explicitly setting price
// 2000, capacity 80, earlyBirdCutoff null, and no tranche-named key.
import { loadRepoModule, finish } from './_lib.mjs';

const SCRIPT_REL_PATH = 'scripts/migrate-conference-workshop-tickets.ts';
const failures = [];

let mod;
try {
  mod = await loadRepoModule(SCRIPT_REL_PATH);
} catch (error) {
  finish('check-migration-patches-all-slugs.mjs', [`could not import ${SCRIPT_REL_PATH}: ${error.message}`]);
}

if (typeof mod.buildMigrationPatches !== 'function') {
  finish('check-migration-patches-all-slugs.mjs', [`${SCRIPT_REL_PATH} does not export buildMigrationPatches()`]);
}

const patches = mod.buildMigrationPatches();

const SEVEN_SLUGS = [
  'saoc-symposium',
  'wosa-conference',
  'vip',
  'weekend-pass',
  'day-visitor',
  'early-bird',
  'sunset-cocktails-couple',
];

for (const slug of SEVEN_SLUGS) {
  const id = `ticketType-${slug}`;
  if (!(id in patches)) {
    failures.push(`buildMigrationPatches() has no patch for '${id}' (one of the seven pre-existing documents F1/F2 changed)`);
  }
}

if ('ticketType-weekend-pass-early-bird' in patches) {
  failures.push(
    "buildMigrationPatches() patches 'ticketType-weekend-pass-early-bird' — this document does not exist yet (it's a brand-new product); its creation is scripts/seed-ticketing.ts's unmodified job, not this migration's",
  );
}

for (const slug of ['saoc-symposium', 'wosa-conference']) {
  const id = `ticketType-${slug}`;
  const patch = patches[id];
  if (!patch) continue; // already reported as missing above
  if (patch.price !== 2000) failures.push(`${id} patch: price is ${JSON.stringify(patch.price)}, expected 2000`);
  if (patch.capacity !== 80) failures.push(`${id} patch: capacity is ${JSON.stringify(patch.capacity)}, expected 80`);
  if (patch.earlyBirdCutoff !== null) {
    failures.push(`${id} patch: earlyBirdCutoff is ${JSON.stringify(patch.earlyBirdCutoff)}, expected null`);
  }
  const trancheKeys = Object.keys(patch).filter((k) => /tranche/i.test(k));
  if (trancheKeys.length > 0) {
    failures.push(`${id} patch: unexpected tranche-named key(s) ${JSON.stringify(trancheKeys)}`);
  }
}

finish(
  'check-migration-patches-all-slugs.mjs',
  failures,
  'buildMigrationPatches() patches exactly the seven pre-existing documents, with symposium/WOSA set to 2000/80/no-tranche.',
);
