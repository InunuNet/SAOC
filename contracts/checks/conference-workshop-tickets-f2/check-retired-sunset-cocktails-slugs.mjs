// F2 (conference-workshop-tickets, M1) — A14: RETIRED_SUNSET_COCKTAILS_SLUGS export
// exists and names exactly ['sunset-cocktails-couple'] — new retirement list, same
// convention as RETIRED_CONFERENCE_SLUGS/RETIRED_FIELD_TRIP_SLUGS (active:false patched by
// F3's migration, never a removal from WORKSHOP_FIELD_TRIP_PRODUCTS — see
// check-sunset-cocktails-and-field-trip-unchanged.mjs for the latter).
import { loadRepoModule, finish } from './_lib.mjs';

const mod = await loadRepoModule('lib/provisional-figures.ts');
const { RETIRED_SUNSET_COCKTAILS_SLUGS } = mod;

const failures = [];

if (!Array.isArray(RETIRED_SUNSET_COCKTAILS_SLUGS)) {
  finish('check-retired-sunset-cocktails-slugs.mjs', [
    `RETIRED_SUNSET_COCKTAILS_SLUGS is ${JSON.stringify(RETIRED_SUNSET_COCKTAILS_SLUGS)}, expected an array export`,
  ]);
}

const actual = [...RETIRED_SUNSET_COCKTAILS_SLUGS];
const expected = ['sunset-cocktails-couple'];
if (actual.length !== expected.length || !expected.every((s, i) => actual[i] === s)) {
  failures.push(`RETIRED_SUNSET_COCKTAILS_SLUGS is ${JSON.stringify(actual)}, expected exactly ${JSON.stringify(expected)}`);
}

finish(
  'check-retired-sunset-cocktails-slugs.mjs',
  failures,
  "RETIRED_SUNSET_COCKTAILS_SLUGS is exactly ['sunset-cocktails-couple'].",
);
