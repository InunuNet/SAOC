// F5 (ticketing-conferences-and-events, M2) — second Codex GPT-5.5 defect repair (2026-08-21,
// Defect 1: UI correctness / Defect 2: backend oversell). Proves two facts about
// sanity/queries.ts by extracting each named query's actual GROQ template-literal body (between
// its own backticks), not by grepping fixed line windows with -A, which silently drifts if the
// file is reordered or a query grows/shrinks:
//
//   1. activeTicketTypesByCategoryQuery — the query CategoryTicketsPage.tsx calls to list a
//      category's products — selects capacityPool and headcountPerUnit. Without both fields,
//      CategoryTicketsPage.tsx's planPooledCapacity() call (see
//      check-ui-pool-behavior-per-unit.mjs and check-category-page-pool-wiring.mjs) would run on
//      undefined pool config for every listed product, silently degrading every pooled product
//      back to being treated as its own singleton pool.
//   2. ticketTypesByPoolQuery — the query used to fetch a pool's OTHER members (siblings not
//      necessarily present in the category's own listing) — does NOT filter on `active == true`,
//      and DOES filter on `show._ref == $showId`.
//      Regression guard for Defect 2: a sibling deactivated after selling out (or retired) still
//      holds real sold/reserved Firestore positions that getSoldCountsByTicketType() counts
//      regardless of the sibling's current `active` value; an `active == true` filter here would
//      let that sibling's sold heads silently escape the shared pool ceiling.
//   3. Third defect repair (Codex GPT-5.5 cross-model review, 2026-08-21): ticketTypesByPoolQuery
//      matched pool siblings by `capacityPool == $pool` alone, with no show scoping — any
//      published ticketType anywhere sharing the same capacityPool STRING (e.g. two unrelated
//      shows both naming a pool "workshop-hall") would be treated as a sibling, poisoning the
//      current checkout's pool config with an unrelated show's sold counts/headcount. Fixed by
//      adding `show._ref == $showId` to the filter. Regression guard for that recurring.
//
// Run as: node contracts/checks/ticketing-conferences-and-events-f5/check-ui-query-regression-guards.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUERIES_FILE = process.env.F5_CHECK_QUERIES_FILE_OVERRIDE
  ? path.resolve(process.env.F5_CHECK_QUERIES_FILE_OVERRIDE)
  : path.resolve(__dirname, '../../../sanity/queries.ts');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

let src;
try {
  src = readFileSync(QUERIES_FILE, 'utf8');
} catch {
  fail(`${QUERIES_FILE} does not exist.`);
}

function extractQueryBody(exportName) {
  const declIdx = src.indexOf(`export const ${exportName}`);
  if (declIdx === -1) {
    fail(`sanity/queries.ts never declares "export const ${exportName}".`);
  }
  const backtickStart = src.indexOf('`', declIdx);
  if (backtickStart === -1) {
    fail(`"${exportName}" has no template-literal GROQ body (no opening backtick found).`);
  }
  const backtickEnd = src.indexOf('`', backtickStart + 1);
  if (backtickEnd === -1) {
    fail(`"${exportName}" template literal is never closed (no matching backtick found).`);
  }
  return src.slice(backtickStart + 1, backtickEnd);
}

// --- Fact 1: activeTicketTypesByCategoryQuery selects both new pool fields ---
const categoryQueryBody = extractQueryBody('activeTicketTypesByCategoryQuery');
if (!/\bcapacityPool\b/.test(categoryQueryBody)) {
  fail(
    'activeTicketTypesByCategoryQuery does not select capacityPool — CategoryTicketsPage.tsx ' +
      'would build poolConfigByType with every listed product treated as unpooled.'
  );
}
if (!/\bheadcountPerUnit\b/.test(categoryQueryBody)) {
  fail(
    'activeTicketTypesByCategoryQuery does not select headcountPerUnit — CategoryTicketsPage.tsx ' +
      'would build poolConfigByType with every listed product weighted as 1 head regardless of ' +
      'its real headcount.'
  );
}

// --- Fact 2: ticketTypesByPoolQuery does NOT filter on active == true ---
const poolQueryBody = extractQueryBody('ticketTypesByPoolQuery');
if (!/capacityPool\s*==\s*\$pool/.test(poolQueryBody)) {
  fail(
    'ticketTypesByPoolQuery no longer filters on capacityPool == $pool — it would stop fetching ' +
      'the right pool\'s siblings entirely (this check expected the filter present, minus ' +
      '`active == true`, not the whole filter removed).'
  );
}
if (/active\s*==\s*true/.test(poolQueryBody)) {
  fail(
    'ticketTypesByPoolQuery filters on `active == true` — a pool sibling deactivated after ' +
      'selling out (or retired) still holds real sold/reserved positions that count against the ' +
      'shared ceiling; filtering it out here lets those heads silently escape the pool. This is ' +
      'Defect 2 (backend oversell, 2026-08-21) recurring.'
  );
}
if (!/show\._ref\s*==\s*\$showId/.test(poolQueryBody)) {
  fail(
    'ticketTypesByPoolQuery does not filter on `show._ref == $showId` — it would match pool ' +
      'siblings by capacityPool string alone across ALL shows, poisoning the current checkout\'s ' +
      'pool config with an unrelated show\'s sold counts/headcount. This is Defect 3 (show-' +
      'scoping gap, 2026-08-21) recurring.'
  );
}

console.log(
  'PASS: activeTicketTypesByCategoryQuery selects capacityPool/headcountPerUnit, and ' +
    'ticketTypesByPoolQuery filters pool siblings by capacityPool AND show._ref without an ' +
    'active == true regression.'
);
process.exit(0);
