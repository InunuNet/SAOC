// F3 (ticketing-conferences-and-events, M2) — DEFECT REPAIR (found live by @qa-apex against the
// real `production` Sanity dataset, 2026-08-21): every existing ticketType document has
// `category: null` today (the backfill migration has only ever run --dry-run). The original
// `activeTicketTypesByCategoryQuery($category)` filtered `category == $category`, and
// `null == "admission"` is false in GROQ — so /tickets, the currently-LIVE admission page,
// would render ZERO ticket cards the instant this feature ships, regardless of any other test
// in this suite passing. See contracts/golden/ticketing-purchase-pages-f3/README.md,
// "Defect repair: null-category read-time fallback".
//
// THIS CHECK EXECUTES THE REAL GROQ QUERY STRING (via groq-js, an actual GROQ parser/evaluator
// — not a text/regex match) against a synthetic in-memory dataset covering every category
// state a live document can be in: explicit "admission", explicit "conference", `category:
// null`, and the field entirely absent. It proves three things simultaneously:
//   1. A null/missing-category document IS returned when $category === "admission" (the fix —
//      this is what keeps /tickets non-empty regardless of whether the migration has run).
//   2. A null/missing-category document is NOT returned for $category === "conference" or
//      "workshop-field-trip" (the safety valve — the fallback must not silently masquerade an
//      uncategorized future document as belonging to a category it was never assigned to;
//      only "admission" gets the transitional fallback, since that's the only category with a
//      real live null-category defect today).
//   3. active === false documents are excluded regardless of category (existing behavior must
//      survive the fix).
//
// Negatively verified: this exact check, run against the query text as it existed BEFORE this
// repair (`category == $category`, no fallback clause), reproduces the live defect — the
// admission case returns only the one document with an explicit "admission" category and
// silently drops the null/missing-category documents. Confirmed by running this check with
// OLD_QUERY_FOR_REGRESSION_PROOF below substituted in place of the live extracted query.
//
// Run as: npx tsx contracts/checks/ticketing-purchase-pages-f3/check-category-query-null-fallback.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, evaluate } from 'groq-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const queriesPath = path.join(repoRoot, 'sanity/queries.ts');

function extractQuery(source, exportName) {
  const marker = `export const ${exportName} = defineQuery(\``;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Could not find "${marker}" in sanity/queries.ts`);
  }
  const bodyStart = start + marker.length;
  const end = source.indexOf('`);', bodyStart);
  if (end === -1) {
    throw new Error(`Could not find closing backtick for ${exportName}`);
  }
  return source.slice(bodyStart, end);
}

const source = readFileSync(queriesPath, 'utf8');
const QUERY = extractQuery(source, 'activeTicketTypesByCategoryQuery');

// This is the query text as it existed BEFORE this repair — kept here only so the
// negative-verification claim above is re-runnable by anyone, not just asserted in prose.
// NOT used by the pass/fail logic below.
const OLD_QUERY_FOR_REGRESSION_PROOF = `
  *[_type == "ticketType" && active == true && category == $category] | order(order asc){
    _id,
    "slug": slug.current,
    category
  }
`;
void OLD_QUERY_FOR_REGRESSION_PROOF;

const dataset = [
  { _type: 'ticketType', _id: 'null-admission', active: true, category: null, slug: { current: 'legacy-null-category' }, order: 1 },
  { _type: 'ticketType', _id: 'explicit-admission', active: true, category: 'admission', slug: { current: 'vip' }, order: 2 },
  { _type: 'ticketType', _id: 'explicit-conference', active: true, category: 'conference', slug: { current: 'saoc-symposium' }, order: 3 },
  { _type: 'ticketType', _id: 'explicit-workshop', active: true, category: 'workshop-field-trip', slug: { current: 'field-trip-single' }, order: 4 },
  { _type: 'ticketType', _id: 'inactive-null', active: false, category: null, slug: { current: 'inactive-null-category' }, order: 5 },
  { _type: 'ticketType', _id: 'field-absent', active: true, slug: { current: 'category-field-never-set' }, order: 6 },
];

async function runQuery(category) {
  const tree = parse(QUERY, { params: { category } });
  const value = await evaluate(tree, { dataset, params: { category } });
  const result = await value.get();
  return result.map((d) => d.slug).sort();
}

const failures = [];

function expectSlugs(label, actual, expected) {
  const a = JSON.stringify([...actual].sort());
  const e = JSON.stringify([...expected].sort());
  if (a !== e) failures.push(`${label}: expected ${e}, got ${a}`);
}

const admissionResult = await runQuery('admission');
// The live defect this check exists to catch: both null-category and field-absent documents
// MUST come back for "admission" now, alongside the explicitly-tagged one. If this reverts to
// text matching only `category == $category`, 'legacy-null-category' and
// 'category-field-never-set' silently disappear from this list — exactly what QA reproduced
// against the real production dataset.
expectSlugs('admission fallback', admissionResult, [
  'legacy-null-category',
  'vip',
  'category-field-never-set',
]);

const conferenceResult = await runQuery('conference');
// Safety valve: the fallback must NOT leak into other categories. A null/missing-category
// document must never masquerade as a conference product just because the admission page
// needed a transitional fallback.
expectSlugs('conference (no fallback leakage)', conferenceResult, ['saoc-symposium']);

const workshopResult = await runQuery('workshop-field-trip');
expectSlugs('workshop-field-trip (no fallback leakage)', workshopResult, ['field-trip-single']);

// inactive documents must never appear regardless of category state.
if (admissionResult.includes('inactive-null-category')) {
  failures.push('active:false document leaked into admission results');
}

if (failures.length > 0) {
  console.error('FAIL: check-category-query-null-fallback.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\nThis check executes the real GROQ query text from sanity/queries.ts via groq-js — ' +
      'it is not a source-text match. See file header for what each failure means.',
  );
  process.exit(1);
}
console.log(
  'PASS: activeTicketTypesByCategoryQuery treats null/missing category as "admission" only, ' +
    'with no leakage into other categories, and still excludes inactive documents.',
);
