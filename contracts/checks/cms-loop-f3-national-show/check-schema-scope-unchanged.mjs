#!/usr/bin/env node
// cms-loop-f3-national-show A5: scope-boundary check (source-level, not against the
// deployed host) enforcing the dispatch brief's "wiring data flow ONLY" constraint.
// The brief flags that the page hardcodes a Host ("Western Cape") and a Date RANGE
// ("18–21 Sep 2027") that have NO corresponding nationalShow schema field — only a
// single `location` string and a single `showDate` datetime exist, and showDate is
// currently unset in the dataset. This is a real content-model gap (see contract
// header "DIVERGENCES FOUND"), not something @dev may silently fix by adding new
// schema fields, inventing copy, or making a design call about how to reconcile it —
// that decision belongs to Brad/the National Show committee per the scope-caution
// section of the brief.
//
// This check asserts the nationalShow schema still declares exactly its original six
// fields (title, showDate, location, hero, countdownDate, exhibitorStages) — proving
// no new field was added to route around the host/date-range gap.
//
// Local file check, safe to run at any time, before or after implementation.
// Exit codes: 0 = schema field set unchanged. 1 = a field was added/removed/renamed,
// or the schema file is missing — never a skip.

import { readFileSync } from 'node:fs';

const SCHEMA_PATH = new URL('../../../sanity/schemas/documents/nationalShow.ts', import.meta.url);
const EXPECTED_FIELDS = ['title', 'showDate', 'location', 'hero', 'countdownDate', 'exhibitorStages'];

let source;
try {
  source = readFileSync(SCHEMA_PATH, 'utf8');
} catch (err) {
  console.error(`FAIL: could not read ${SCHEMA_PATH.pathname} — ${err.message}`);
  process.exit(1);
}

const found = [...source.matchAll(/defineField\(\{\s*name:\s*'([a-zA-Z0-9]+)'/g)].map((m) => m[1]);
console.log('Fields found in nationalShow schema:', found);

const missing = EXPECTED_FIELDS.filter((f) => !found.includes(f));
const extra = found.filter((f) => !EXPECTED_FIELDS.includes(f));

if (missing.length === 0 && extra.length === 0 && found.length === EXPECTED_FIELDS.length) {
  console.log('PASS: nationalShow schema still declares exactly its original six fields — no scope-creep into a schema change.');
  process.exit(0);
}
console.error(
  `FAIL: nationalShow schema field set changed — missing: ${JSON.stringify(missing)}, unexpected additions: ${JSON.stringify(extra)}. ` +
    'A schema change is out of scope for this contract (wiring data flow only) — flag this for team-lead/Brad instead of adding fields.'
);
process.exit(1);
