// F1 (conference-workshop-tickets, M1) — A3: RETIRED_CONFERENCE_SLUGS names the exact four
// retired Conferences SKUs (the old differential early-bird/normal price pair for each of
// SAOC Symposium and WOSA Conference, plus the SAOC/WOSA joint bundle's own early-bird/normal
// pair) — no more, no fewer, no substitute. Same identity-set pattern as
// contracts/checks/ticketing-complete-f2/check-conference-product-families.mjs, applied to
// the RETIRED list rather than the live one.
//
// Run as: node contracts/checks/conference-workshop-tickets-f1/check-retired-conference-slugs.mjs
// (also runs under `npx tsx` directly). Registers tsx's ESM loader programmatically — rather
// than relying on a `--import tsx/esm` CLI flag the contract's own `command:` string does not
// pass — so a plain `node <this file>` invocation can still resolve the target's `.ts`
// imports, same reasoning as lib/provisional-figures.ts's own relative-import comment.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { register } from 'tsx/esm/api';

register();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { RETIRED_CONFERENCE_SLUGS } = await import(
  path.join(__dirname, '../../../lib/provisional-figures.ts')
);

const failures = [];

const EXPECTED_SLUGS = [
  'saoc-symposium-early-bird',
  'wosa-conference-early-bird',
  'saoc-wosa-joint-early-bird',
  'saoc-wosa-joint',
];

if (!Array.isArray(RETIRED_CONFERENCE_SLUGS)) {
  console.error('FAIL: check-retired-conference-slugs.mjs');
  console.error('  - RETIRED_CONFERENCE_SLUGS is not an array');
  process.exit(1);
}

const actual = [...RETIRED_CONFERENCE_SLUGS];
const actualSet = new Set(actual);
const expectedSet = new Set(EXPECTED_SLUGS);

const duplicates = actual.filter((slug, i) => actual.indexOf(slug) !== i);
if (duplicates.length > 0) {
  failures.push(`duplicate slug(s) in RETIRED_CONFERENCE_SLUGS: ${JSON.stringify([...new Set(duplicates)])}`);
}

const missing = EXPECTED_SLUGS.filter((slug) => !actualSet.has(slug));
if (missing.length > 0) {
  failures.push(`missing expected retired slug(s): ${JSON.stringify(missing)}`);
}

const unexpected = actual.filter((slug) => !expectedSet.has(slug));
if (unexpected.length > 0) {
  failures.push(`unexpected slug(s) in RETIRED_CONFERENCE_SLUGS: ${JSON.stringify(unexpected)}`);
}

if (failures.length > 0) {
  console.error('FAIL: check-retired-conference-slugs.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: RETIRED_CONFERENCE_SLUGS names exactly the four retired SKUs (saoc-symposium-early-bird, ' +
    'wosa-conference-early-bird, saoc-wosa-joint-early-bird, saoc-wosa-joint) — no more, no fewer.',
);
